/**
 * JEFE — NUCLI · Notificacions al mòbil
 *
 * Això és el que converteix JEFE en una app que et busca a tu, en comptes
 * d'una que espera que l'obris. Les notificacions arriben encara que tinguis
 * l'app tancada i el navegador tancat.
 *
 * PER QUÈ FIREBASE I NO NOTIFICACIONS WEB DIRECTES
 * L'estàndard de Web Push exigeix signar amb ECDSA P-256 i xifrar el contingut
 * amb ECDH. Apps Script no té cap de les dues primitives i no es poden fer a mà
 * de manera raonable. El que sí que té és `computeRsaSha256Signature`, que és
 * exactament el que cal per autenticar-se com a compte de servei de Google.
 * Per això el camí és Firebase: no és un caprici, és l'única porta oberta.
 *
 * QUI ENVIA QUÈ
 *   Apps Script  → demana un testimoni d'accés a Google amb un JWT signat
 *                → envia el missatge a FCM
 *   FCM          → el reparteix al telèfon
 *   El navegador → el mostra encara que l'app estigui tancada
 *
 * SEGURETAT
 * El fitxer del compte de servei conté una clau privada. Va a Script Properties
 * (FIREBASE_COMPTE) i no ha d'aparèixer mai en cap fitxer del projecte.
 * La configuració web de Firebase (apiKey, appId, vapid) SÍ que és pública per
 * disseny: està pensada per anar al codi del client.
 */

var Notifica = (function () {

  var ABAST = 'https://www.googleapis.com/auth/firebase.messaging';
  var CAU_TESTIMONI = 'fcm_testimoni';

  // ------------------------------------------------------------ configuració

  function compte_() {
    var brut = PropertiesService.getScriptProperties().getProperty(PROP_FIREBASE);
    if (!brut) return null;
    var c = Utils.desJson(brut, null);
    if (!c || !c.client_email || !c.private_key || !c.project_id) return null;
    return c;
  }

  function disponible() {
    return !!compte_();
  }

  function motiu() {
    var brut = PropertiesService.getScriptProperties().getProperty(PROP_FIREBASE);
    if (!brut) return 'Falta el compte de servei de Firebase a Script Properties (FIREBASE_COMPTE).';
    if (!Utils.desJson(brut, null)) return 'El contingut de FIREBASE_COMPTE no és JSON vàlid.';
    return 'Al JSON de FIREBASE_COMPTE hi falta client_email, private_key o project_id.';
  }

  // ------------------------------------------------------------- autenticació

  /**
   * Accepta text o bytes. Amb els bytes de la signatura s'ha de passar l'array
   * TAL QUAL: convertir-lo abans a text el destrueix, perquè el text es torna
   * a codificar en UTF-8 i tot byte per sobre de 127 en surt canviat. Com que
   * una signatura és pràcticament aleatòria, mig JWT quedava corromput.
   */
  function base64url_(dades) {
    return Utilities.base64EncodeWebSafe(dades).replace(/=+$/, '');
  }

  /**
   * Testimoni d'accés de Google, signant un JWT amb la clau del compte de servei.
   * Dura una hora; es desa 55 minuts a la memòria cau per no demanar-ne un a
   * cada notificació.
   */
  function testimoni_() {
    var cache = CacheService.getScriptCache();
    var desat = cache.get(CAU_TESTIMONI);
    if (desat) return desat;

    var c = compte_();
    if (!c) throw new Error(motiu());

    var ara = Math.floor(Date.now() / 1000);
    var capcalera = base64url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    var cos = base64url_(JSON.stringify({
      iss: c.client_email,
      scope: ABAST,
      aud: 'https://oauth2.googleapis.com/token',
      iat: ara,
      exp: ara + 3600
    }));

    var signatura = Utilities.computeRsaSha256Signature(
      capcalera + '.' + cos,
      Utils.plegaPem(c.private_key)     // ve d'un JSON: porta els salts escrits
    );
    var jwt = capcalera + '.' + cos + '.' + base64url_(signatura);

    var resposta = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      },
      muteHttpExceptions: true
    });

    if (resposta.getResponseCode() !== 200) {
      var text = Utils.talla(resposta.getContentText(), 300);
      Log.error('notifica.testimoni', 'Google no ha donat testimoni',
                { codi: resposta.getResponseCode(), text: text });
      // El que diu Google ha de sortir a l'error: sense això, un problema de
      // signatura i un compte esborrat es veuen exactament igual.
      var detall = Utils.desJson(text, {});
      throw new Error('No s\'ha pogut autenticar amb Firebase (' +
        resposta.getResponseCode() + '): ' +
        (detall.error_description || detall.error || text));
    }

    var dades = Utils.desJson(resposta.getContentText(), {});
    if (!dades.access_token) throw new Error('Google ha respost sense testimoni.');

    cache.put(CAU_TESTIMONI, dades.access_token, 3300);   // 55 minuts
    return dades.access_token;
  }

  // --------------------------------------------------------------- dispositius

  function registra(fitxa, nom) {
    fitxa = String(fitxa || '').trim();
    if (fitxa.length < 20) throw new Error('La fitxa del dispositiu no és vàlida.');

    Dades.desa('_Dispositius', {
      fitxa: fitxa,
      nom: nom || 'Dispositiu',
      actiu: 'SI',
      ultim_error: '',
      vist_el: Utils.ara()
    }, ['fitxa'], 'dis');

    Log.info('notifica.registra', 'Dispositiu registrat', { nom: nom });
    return { registrat: true };
  }

  function dispositius() {
    return Dades.llegeix('_Dispositius', { actiu: 'SI' });
  }

  /** Un dispositiu que ja no existeix es desactiva; no s'esborra mai. */
  function desactiva_(fitxa, error) {
    var d = Dades.un('_Dispositius', { fitxa: fitxa });
    if (!d) return;
    Dades.actualitza('_Dispositius', d.id, { actiu: 'NO', ultim_error: Utils.talla(error, 200) });
    Log.avis('notifica.desactiva', 'Dispositiu desactivat', { nom: d.nom, error: error });
  }

  // ------------------------------------------------------------------- enviar

  /**
   * Envia una notificació a tots els dispositius registrats.
   *
   * EL TÍTOL HA DE DIR DE QUÈ VA L'AVÍS, i mai «JEFE». Android ja escriu el
   * nom de l'app a la capçalera, i no el podem treure: un títol que repeteix
   * EL TÍTOL DIU D'ON VE. EL COS DIU QUÈ PASSA.
   *
   * Aquí hi havia la regla contrària —que el títol havia de portar la
   * informació— i el resultat era que amb una sola cita del dia et sortia
   * «Montgrony 7:00-15:00» de títol i «Montgrony 7:00-15:00» de cos. Una
   * notificació que es repeteix a si mateixa no diu res dues vegades: no diu
   * res una.
   *
   *   BÉ        «Calendari»   + «07:00 · Montgrony (Ripollès)»
   *   MALAMENT  «Montgrony 7:00-15:00» + «07:00 · Montgrony»
   *   MALAMENT  «JEFE»        + qualsevol cosa
   *
   * El títol són una o dues paraules i han de dir DE QUÈ va —i, de propina,
   * on et porta en tocar-la, perquè el destí és el mateix apartat. El cos és
   * on hi ha el contingut i el següent pas.
   *
   * LA FORMA ÉS «Apartat» O «Apartat · què». La segona és per quan d'un mateix
   * apartat en surt més d'una mena de notificació i saber quina és canvia si
   * l'obres ara o després. Totes les de l'app hi caben:
   *
   *   Calendari · 3 cites      Diari · resum          Finances · banc
   *   Nutrició · tancament     Diari · revisió        Finances · patrimoni
   *   Escola · acta            El dia · demà          Seguiment FitFat
   *
   * TRES PARAULES, i el punt volat no compta. Un títol de sis paraules és una
   * frase, i una frase al títol vol dir que el cos la tornarà a dir. Això no
   * és un consell: `eines/prova.mjs` llegeix els títols escrits al codi i peta
   * si n'hi ha cap de llarg.
   *
   * QUI EL POSA. Als avisos programats i als senyals, el NUCLI: el mòdul diu
   * què passa i el nucli sap d'on ve, perquè és qui té el registre. Així cap
   * mòdul no s'ha de recordar d'aquesta regla —que és l'única manera que una
   * regla sobrevisqui al vuitè lloc on s'aplica.
   *
   * opcions: { url, etiqueta, urgent }
   *   url      — on va en tocar-la (relativa a l'app)
   *   etiqueta — les notificacions amb la mateixa etiqueta es reemplacen
   *              en comptes d'acumular-se. Sense això, set recordatoris
   *              d'hàbits deixarien set línies a la barra.
   */
  /**
   * ON HA D'ANAR UNA NOTIFICACIÓ EN TOCAR-LA.
   *
   * Això existeix perquè quatre de les nou notificacions d'aquesta app obrien
   * una pàgina 404, i totes quatre per la mateixa raó: enviaven el nom del
   * mòdul a seques —«escola», «diari», «seguiment»— i el treballador de
   * servei ho resolia contra la seva pròpia carpeta. A GitHub Pages l'app viu
   * a /jefe/, o sigui que «escola» es convertia en /jefe/escola, que no és
   * enlloc. L'app tria pantalla amb el HASH: ha de ser «./#escola».
   *
   * Es normalitza AQUÍ i no a cada crida a posta: qui envia una notificació
   * ha de poder escriure el nom de la pantalla i prou. Si això depengués de
   * recordar-se'n a cada lloc, tornaria a fallar el dia que algú n'afegeixi
   * una —que és exactament com han fallat aquestes quatre.
   *
   *   'escola'        →  './#escola'
   *   './#finances'   →  './#finances'      (ja estava bé)
   *   '#habits'       →  './#habits'
   *   './'  o buit    →  './'               (l'arrel, sense pantalla)
   */
  /**
   * EL QUE DEIA EL TÍTOL, POSAT AL DAVANT DEL COS.
   *
   * Ara que el títol és el nom de l'apartat, el que abans hi anava —què passa—
   * ha d'encapçalar el cos i no perdre's. Amb un punt pel mig, tret que ja
   * n'hi hagi un: «Bon dia, Pol!. 09:00 Claustre» es llegeix malament i és el
   * primer que va sortir en provar-ho.
   */
  function junta_(davant, darrere) {
    var a = String(davant || '').trim();
    var b = String(darrere || '').trim();
    if (!a) return b;
    if (!b) return a;
    return a + (/[.!?:;·…]$/.test(a) ? ' ' : '. ') + b;
  }

  function capOn_(url) {
    var u = String(url === undefined || url === null ? '' : url).trim();
    if (!u || u === './' || u === '.' || u === '/') return './';
    if (u.indexOf('http') === 0) return u;              // absoluta: qui la posa sap què fa
    if (u.indexOf('./#') === 0) return u;               // ja és la bona
    if (u.charAt(0) === '#') return './' + u;
    // Un nom de pantalla a seques, que és el cas que fallava
    return './#' + u.replace(/^\.?\/*/, '').replace(/^#/, '');
  }

  function envia(titol, cos, opcions) {
    opcions = opcions || {};

    if (/^\s*jefe\s*$/i.test(String(titol || ''))) {
      Log.avis('notifica.envia', 'Títol que no diu res: repeteix el nom de l\'app', { titol: titol });
    }
    if (!disponible()) {
      Log.avis('notifica.envia', 'Notificació descartada: Firebase no configurat', { titol: titol });
      return { enviades: 0, motiu: motiu() };
    }

    var llista = dispositius();
    if (!llista.length) {
      Log.avis('notifica.envia', 'Cap dispositiu registrat');
      return { enviades: 0, motiu: 'Cap dispositiu registrat.' };
    }

    var c = compte_();
    var url = 'https://fcm.googleapis.com/v1/projects/' + c.project_id + '/messages:send';
    var auth = 'Bearer ' + testimoni_();
    var enviades = 0, errors = [];

    for (var i = 0; i < llista.length; i++) {
      var missatge = {
        message: {
          token: String(llista[i].fitxa),
          // `data` en comptes de `notification`: així la pinta el nostre
          // treballador de servei i podem controlar icona, etiqueta i acció.
          data: {
            titol: String(titol),
            cos: String(cos || ''),
            url: capOn_(opcions.url),
            etiqueta: String(opcions.etiqueta || 'jefe')
          },
          webpush: {
            headers: { Urgency: opcions.urgent ? 'high' : 'normal', TTL: '86400' },
            fcm_options: { link: capOn_(opcions.url) }
          }
        }
      };

      var r = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: auth },
        payload: JSON.stringify(missatge),
        muteHttpExceptions: true
      });

      var codi = r.getResponseCode();
      if (codi === 200) {
        enviades++;
        Dades.actualitza('_Dispositius', llista[i].id, { vist_el: Utils.ara(), ultim_error: '' });
      } else {
        var text = Utils.talla(r.getContentText(), 300);
        errors.push({ nom: llista[i].nom, codi: codi, text: text });
        // 404 i 403 volen dir que la fitxa ja no serveix: el navegador la
        // renova de tant en tant, o has desinstal·lat l'app.
        if (codi === 404 || codi === 403) desactiva_(llista[i].fitxa, 'codi ' + codi);
      }
    }

    Log.info('notifica.envia', titol, { enviades: enviades, errors: errors.length });
    return { enviades: enviades, errors: errors };
  }

  return {
    capOn: capOn_,
    junta: junta_,
    disponible: disponible,
    motiu: motiu,
    registra: registra,
    dispositius: dispositius,
    envia: envia
  };
})();
