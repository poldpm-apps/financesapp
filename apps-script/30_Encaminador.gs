/**
 * JEFE — NUCLI · Encaminament
 *
 * Una sola porta d'entrada des del client, i SEMPRE amb la clau al davant:
 *     google.script.run.api(clau, 'habits', 'marca', {id: '...', data: '...'})
 *
 * El nucli comprova la clau, busca el mòdul, comprova que l'acció existeixi
 * i la crida. Un mòdul nou no ha de tocar res d'aquí: registrar l'acció al
 * seu descriptor ja el fa accessible.
 *
 * PER QUÈ LA CLAU TAMBÉ AQUÍ, I NO NOMÉS A `doPost`
 * -------------------------------------------------------------------------
 * El desplegament és d'accés «Qualsevol, fins i tot anònim» —ha de ser-ho
 * perquè una pàgina d'un altre domini el pugui cridar sense sessió—. Això
 * vol dir que qualsevol que tingui l'adreça pot demanar `doGet`, rebre la
 * interfície i, des d'aquella mateixa pàgina, cridar `google.script.run`.
 * Amb la clau només a `doPost`, aquell camí entrava sense ensenyar res: les
 * finances, el diari i el seguiment eren a una crida de distància de qui
 * tingués l'URL. I l'URL va estar publicada al repositori.
 *
 * Ara la comprovació és a la funció que el client crida, no al transport.
 * Cap camí se la salta perquè no hi ha cap altre camí.
 */

/** Punt d'entrada de la web app. */
function doGet(e) {
  try {
    /* TORNADES DE FORA.
       Alguns serveis externs —un banc obert per PSD2, per exemple— tornen a
       aquesta mateixa adreça amb paràmetres a la URL en comptes de cridar
       l'API. El nucli no sap res de cap servei concret: només pregunta si
       algun mòdul reclama aquesta tornada i li dona el control. Sense això,
       qualsevol integració amb una autorització externa obligaria a tocar
       aquest fitxer, que és exactament el que no ha de passar mai. */
    var tornada = Moduls.gestionaTornada(e && e.parameter);
    if (tornada) return tornada;

    var plantilla = HtmlService.createTemplateFromFile('ui_index');
    /* AQUÍ NO S'HI POSA RES QUE NO PUGUI LLEGIR UN DESCONEGUT.
       Aquesta pàgina se serveix sense clau —s'ha de servir, si no no hi ha
       on escriure-la—, o sigui que tot el que s'hi injecti és públic. Abans
       hi anava `estatSistema()` sencer, que porta l'identificador i l'URL
       del full de càlcul: l'adreça de la base de dades, regalada a qui
       obrís la pàgina. Ara hi va només la llista de mòduls, que ja és al
       repositori públic, i la resta se li demana amb la clau a la mà. */
    plantilla.estat = estatPublic_();
    return plantilla.evaluate()
      .setTitle('JEFE')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    Log.error('doGet', err);
    /* El missatge s'escapa. Avui el fa el servidor i no hi ha manera de
       ficar-hi res de fora, però és una pàgina que s'imprimeix sencera: el
       dia que un error porti un tros del que ha demanat l'usuari, això seria
       una injecció i no un missatge. */
    return HtmlService.createHtmlOutput(
      '<h1>JEFE no s\'ha pogut obrir</h1><pre>' + escapaHtml_(err.message) + '</pre>' +
      '<p>Executa <code>configuraJefe()</code> des de l\'editor d\'Apps Script.</p>'
    );
  }
}

/**
 * L'ESTAT QUE POT VEURE QUALSEVOL.
 * La llista de mòduls i prou: és el que el client necessita per pintar la
 * barra abans de la primera crida, i no diu res de ningú. Si el full encara
 * no està configurat, torna la llista buida i el client ja ho resoldrà.
 */
function estatPublic_() {
  try {
    return { moduls: Config.idFull() ? Moduls.perAlClient() : [] };
  } catch (err) {
    return { moduls: [] };
  }
}

/** Text a dins d'HTML, sense sorpreses. */
function escapaHtml_(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Permet incloure fitxers HTML dins d'altres (CSS, JS, vistes de mòduls). */
function include(fitxer) {
  return HtmlService.createHtmlOutputFromFile(fitxer).getContent();
}

/**
 * PORTA D'ENTRADA DES DE FORA D'APPS SCRIPT
 *
 * Existeix per un sol motiu: Apps Script serveix les seves pàgines dins d'un
 * iframe que no delega permís de micròfon, i per tant l'escolta contínua no hi
 * pot funcionar mai. Amb la interfície servida des de fora, sí.
 *
 * SEGURETAT — llegeix-ho abans de desplegar:
 *   Perquè una pàgina d'un altre domini pugui cridar-lo, el desplegament ha de
 *   ser d'accés «Qualsevol». La porta la tanca una clau llarga que viu a
 *   Script Properties (CLAU_ACCES) i al teu navegador. Mai al repositori.
 *   Sense clau correcta, `api()` no mira ni què li demanes, i tant se val si
 *   hi arribes per aquí o per `google.script.run`: la comprovació és allà i
 *   no en aquest transport.
 *
 * Es fa servir `text/plain` a posta: així el navegador no envia cap petició
 * de comprovació prèvia, que Apps Script no sap respondre.
 */
function doPost(e) {
  var resposta = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
                         .setMimeType(ContentService.MimeType.JSON);
  };

  var peticio;
  try {
    peticio = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return resposta({ ok: false, error: 'La petició no és JSON vàlid.' });
  }

  return resposta(api(peticio.clau, peticio.modul, peticio.accio, peticio.params || {}));
}

/**
 * LA PORTA, UNA I NOMÉS UNA.
 * La feien dues funcions i només una la tancava. Ara la comprovació viu aquí
 * i tothom qui vulgui entrar hi passa: `doPost` des de fora i `api` des de
 * la pàgina que serveix el mateix desplegament.
 */
function comprovaClau_(clau, quinModul) {
  var esperada = PropertiesService.getScriptProperties().getProperty(PROP_CLAU_ACCES);
  if (!esperada) {
    return { ok: false, error: 'El servidor no té clau d\'accés configurada. ' +
                               'Executa generaClauAcces() des de l\'editor.' };
  }
  if (!clausIguals_(String(clau || ''), esperada)) {
    /* Deixar-ne constància SENSE obrir el full a cada intent.
       Abans s'hi escrivia una línia sempre, i això vol dir que qualsevol que
       trobi aquesta adreça pot fer treballar el full de càlcul tant com
       vulgui, a mig segon per petició. Ara se n'apunta una cada deu minuts:
       el senyal es conserva —si algú hi truca, ho sabràs— i el cost no.
       La resta queda al registre d'execució d'Apps Script igualment. */
    try {
      var cau = CacheService.getScriptCache();
      if (!cau.get('rebutjat')) {
        cau.put('rebutjat', '1', 600);
        Log.avis('api.rebutjat', 'Petició amb clau incorrecta', { modul: quinModul });
      }
    } catch (err) { /* sense cau: val més callar que costar mig segon */ }
    return { ok: false, error: 'Clau d\'accés incorrecta.' };
  }
  return { ok: true };
}

/**
 * Comparació de claus en temps constant.
 * Amb `===` el temps de resposta varia segons quants caràcters coincideixen,
 * i això és suficient per endevinar una clau a base d'intents cronometrats.
 *
 * ES COMPAREN ELS RESUMS, NO LES CLAUS. Sortir de seguida quan les llargades
 * no coincidien també és una resposta: deia quants caràcters té la bona
 * abans de mirar-ne cap. Un SHA-256 sempre fa 32 bytes, i així el bucle és
 * igual de llarg tant si la clau que arriba té cinc caràcters com cinquanta.
 */
function clausIguals_(a, b) {
  var ra = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(a), Utilities.Charset.UTF_8);
  var rb = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(b), Utilities.Charset.UTF_8);
  var diferencia = 0;
  for (var i = 0; i < ra.length; i++) diferencia |= (ra[i] ^ rb[i]);
  return diferencia === 0;
}

/**
 * Encaminador únic, i porta. Retorna SEMPRE {ok: bool, dades|error}.
 * El client no ha de gestionar excepcions, només mirar `ok`.
 *
 * LA COMPROVACIÓ ÉS AQUÍ DINS, NO EN UNA FUNCIÓ QUE ENVOLTI AQUESTA.
 * La temptació era deixar l'encaminament en una funció privada —de les que
 * acaben amb guionet— i posar la clau en una altra que la cridés. Però que
 * `google.script.run` no pugui cridar les funcions amb guionet és una cosa
 * que jo em pensava i que la documentació no diu enlloc. Una porta que depèn
 * d'una cosa que et penses no és una porta. Aquí no hi ha res a saltar-se:
 * qui encamina és qui comprova.
 *
 * La clau va PRIMER a posta: així una crida antiga de tres arguments —el
 * mòdul allà on ara hi va la clau— no s'hi cola, perquè cap nom de mòdul no
 * és la clau. Fallar és exactament el que ha de fer.
 */
function api(clau, idModul, accio, params) {
  var porta = comprovaClau_(clau, idModul);
  if (!porta.ok) return { ok: false, error: porta.error, modul: idModul, accio: accio };
  var inici = Date.now();
  try {
    if (!idModul || !accio) throw new Error('Falta el mòdul o l\'acció.');

    // Accions del nucli, no d'un mòdul
    if (idModul === 'nucli') return { ok: true, dades: apiNucli_(accio, params || {}) };

    var modul = Moduls.perId(idModul);
    if (!modul) throw new Error('No existeix el mòdul «' + idModul + '».');

    var fn = modul.accions && modul.accions[accio];
    if (typeof fn !== 'function') {
      throw new Error('El mòdul «' + idModul + '» no té l\'acció «' + accio + '».');
    }

    /* ESCRIURE I TORNAR A MIRAR, EN UN SOL VIATGE.
       ------------------------------------------------------------------
       Desar una cosa i després demanar la llista refeta eren dues peticions,
       i a Apps Script la petició val un segon i mig ABANS de fer res: el
       temps no és del que li demanes, és d'arribar-hi. Apuntar una tasca de
       quatre paraules trigava tres segons, i tots dos segons i mig eren
       espera pura.

       Amb `_pantalla` als paràmetres, el client diu «i de passada torna'm la
       pantalla». Es fa aquí i no a cada mòdul perquè el problema no és de cap
       mòdul: és del transport. Així ho hereta qualsevol mòdul que es faci
       d'ara endavant sense haver-hi pensat. */
    var refresc = params && params._pantalla;
    if (refresc) delete params._pantalla;

    var resultat = fn(params || {});
    var dades = resultat === undefined ? null : resultat;

    if (refresc && accio !== 'pantalla' && modul.accions &&
        typeof modul.accions.pantalla === 'function') {
      dades = { _resultat: dades, _pantalla: modul.accions.pantalla(refresc) };
    }
    return { ok: true, dades: dades };

  } catch (err) {
    Log.error('api.' + idModul + '.' + accio, err, { params: params });
    return {
      ok: false,
      error: err.message || String(err),
      modul: idModul,
      accio: accio
    };
  } finally {
    var ms = Date.now() - inici;
    if (ms > 8000) Log.avis('api.lent', idModul + '.' + accio + ' ha trigat ' + ms + ' ms');
  }
}

function apiNucli_(accio, params) {
  switch (accio) {
    /* LA PRIMERA PANTALLA.
       No es desa sencera i és a posta: hi ha el calendari, que pot canviar
       sense que aquí s'escrigui res. El que sí que està desat és CADA TARGETA
       a casa seva —vegeu `Moduls.resumInici`—, o sigui que muntar-la ja no
       vol dir obrir un full per mòdul: només el que faci el calendari, que té
       la seva pròpia finestra. */
    case 'inici':
      return {
        avui: Utils.avui(),
        moduls: Moduls.perAlClient(),
        targetes: Moduls.resumInici(),
        ia: IA.estat()
      };

    /**
     * TOTES LES PANTALLES EN UNA ANADA.
     *
     * Cada viatge a Apps Script costa DOS SEGONS abans de fer res —mesurat el
     * 4 d'agost del 2026 amb peticions que el servidor rebutjava per clau
     * incorrecta, o sigui sense obrir res—. Amb una petició per pantalla, obrir
     * l'app i tocar quatre apartats són vuit segons d'espera pura encara que
     * cada pantalla es munti en cent mil·lisegons, que és el que passa ara.
     *
     * Això les porta totes juntes. El client se les desa i, a partir d'aquí,
     * canviar d'apartat no espera ningú: pinta el que ja té i, si de cas, es
     * posa al dia sol.
     *
     * VA EN SEGON PLA i no bloqueja res: quan arriba, arriba. Si falla, cada
     * pantalla segueix sabent demanar la seva com abans.
     *
     * Les que costen car —calendari, tasques, escola— ja les té escalfades el
     * trigger, o sigui que aquí no es paguen: es recullen.
     */
    case 'paquet': {
      var quines = (params && params.quines) || [];
      var out = {};
      var mm = Moduls.actius();
      for (var i = 0; i < mm.length; i++) {
        var mod = mm[i];
        if (quines.length && quines.indexOf(mod.id) === -1) continue;
        if (!mod.accions || typeof mod.accions.pantalla !== 'function') continue;
        /* Un mòdul que peta no s'emporta els altres: qui falti, la seva
           pantalla ja se'l demanarà quan hi entris. */
        try { out[mod.id] = mod.accions.pantalla({}); }
        catch (err) { Log.avis('paquet', mod.id + ': ' + err.message); }
      }
      /* La pàgina del dia, amb la mateixa forma exacta que demana la seva
         pantalla: si aquí es tornés una altra cosa, el client desaria una
         forma que la vista no sap pintar. */
      try { out._dia = Conversa.elDia(Utils.avui()); } catch (err) {}
      return { avui: Utils.avui(), pantalles: out };
    }

    /* NOMÉS EL REGISTRE DE MÒDULS.
       El tauler d'apartats de la conversa el necessita, i abans només el
       tenia qui hagués passat per l'inici: qui obria l'app i anava directe a
       parlar-li, obria el tauler i no hi trobava res. Això no llegeix cap
       full ni gasta res de la quota: és el registre i prou. */
    case 'moduls':
      return { moduls: Moduls.perAlClient() };

    case 'estat':
      return estatSistema();

    case 'config':
      return Config.tot();

    case 'registre':
      return Log.ultimes(params.n || 30, params.nivell);

    case 'ping':
      return { ara: Utils.ara(), versio: VERSIO_JEFE };

    /* Només l'estat. La configuració web de Firebase viu a
       firebase.config.json, que comparteixen la pàgina i el treballador de
       servei: és pública per disseny. El compte de servei —que sí que té
       clau privada— no surt mai d'Script Properties. */
    case 'notificacions':
      return {
        disponible: Notifica.disponible(),
        motiu: Notifica.disponible() ? null : Notifica.motiu(),
        dispositius: Notifica.dispositius().length
      };

    case 'registraDispositiu':
      return Notifica.registra(params.fitxa, params.nom);

    default:
      throw new Error('Acció de nucli desconeguda: «' + accio + '».');
  }
}

/** Diagnòstic complet. El fa servir la pantalla d'estat i el manteniment nocturn. */
function estatSistema() {
  var estat = {
    versio: VERSIO_JEFE,
    ara: Utils.ara(),
    configurat: !!Config.idFull(),
    idFull: null,
    urlFull: null,
    moduls: [],
    problemesEsquema: [],
    ia: null,
    triggers: [],
    error: null
  };

  try {
    if (!estat.configurat) return estat;

    var ss = Config.full();
    estat.idFull = ss.getId();
    estat.urlFull = ss.getUrl();
    estat.moduls = Moduls.perAlClient();
    estat.problemesEsquema = Esquema.comprova();
    estat.ia = IA.estat();

    var t = ScriptApp.getProjectTriggers();
    for (var i = 0; i < t.length; i++) estat.triggers.push(t[i].getHandlerFunction());

  } catch (err) {
    estat.error = err.message;
  }
  return estat;
}
