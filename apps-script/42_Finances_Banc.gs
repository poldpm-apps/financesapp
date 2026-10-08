/**
 * JEFE — MÒDUL · Finances · connexió bancària (PSD2 · Enable Banking)
 *
 * Ve del backend de l'app antiga. La classificació està PORTADA TAL QUAL:
 * les regles i la taula de codis de comerç s'han rodat contra quatre mesos de
 * moviments reals d'en Pol, i tocar-les «de passada» seria canviar una cosa
 * que funciona sense cap dada que ho justifiqui.
 *
 * QUÈ CANVIA RESPECTE DE L'APP ANTIGA
 *   · Els moviments es desen com a files, no dins d'un bloc JSON.
 *   · Abans d'aplicar cap regla es mira la MEMÒRIA DE COMERÇOS. El que va
 *     decidir en Pol mana sobre el que endevini qualsevol regla, i per això
 *     un comerç conegut ja no torna a passar per la safata de revisió.
 *   · Quan arriben moviments nous, JEFE avisa al mòbil.
 *
 * ALTA (un sol cop, i és cosa d'en Pol):
 *   1. A enablebanking.com, afegir la URL d'aquest Web App a les redirect URLs
 *      de l'aplicació. La de l'app antiga ja no serveix.
 *   2. A Propietats de l'script:  EB_APP_ID · EB_PRIVATE_KEY · EB_REDIRECT
 *   3. bancsDisponibles('ES') → omplir MEU_BANC → connectaBanc()
 *   4. instalaTriggers() ja programa la sincronització diària.
 *
 * Cap credencial del banc passa per aquí: en Pol s'identifica a la web del seu
 * banc i el permís que dona és de NOMÉS LECTURA.
 */

var EB_BASE = 'https://api.enablebanking.com';
var PROP_BANC = 'FINANCES_BANC';        // estat de la connexió (conté la sessió)
var DIES_ACCES = 90;                    // quant dura el permís del banc

/* EL NOM DEL BANC VA A PROPIETATS DE L'SCRIPT, no aquí.
   Hi havia un `MEU_BANC` per escriure-hi, com a l'app antiga, però aquest
   fitxer es publica des del repositori amb `clasp push -f` i el que s'escrigui
   a l'editor desapareix a la següent pujada sense deixar rastre.
   Passar-lo com a argument tampoc serveix: el botó d'executar de l'editor
   només crida funcions sense paràmetres. Les propietats són de l'usuari, no
   del codi, i sobreviuen a tot. */
var PROP_BANC_NOM = 'BANC_NOM';


var FinancesBanc = (function () {

  // --------------------------------------------------------- estat i secrets

  function prop_(k) {
    var v = PropertiesService.getScriptProperties().getProperty(k);
    if (!v) throw new Error('Falta la propietat de l\'script: ' + k);
    return v;
  }

  /* L'estat de la connexió porta l'identificador de sessió, que és una
     credencial. Va a Script Properties i no al full de càlcul. */
  function estat() {
    var brut = PropertiesService.getScriptProperties().getProperty(PROP_BANC);
    return Utils.desJson(brut, {}) || {};
  }

  function desaEstat(e) {
    PropertiesService.getScriptProperties().setProperty(PROP_BANC, JSON.stringify(e));
  }

  function disponible() {
    var e = estat();
    return !!(e.connected && e.accounts && e.accounts.length);
  }

  // ------------------------------------------------------------ autenticació

  function b64url_(dades) {
    return Utilities.base64EncodeWebSafe(dades).replace(/=+$/, '');
  }

  /* La clau tal com es fara servir. El quadre de Propietats de l'script es
     d'una sola linia i es menja els salts en enganxar-hi un .pem; vegeu
     `Utils.plegaPem`. */
  function clauPem_() { return Utils.plegaPem(prop_('EB_PRIVATE_KEY')); }

  function jwt_() {
    var cache = CacheService.getScriptCache();
    var t = cache.get('eb_jwt');
    if (t) return t;

    var iat = Math.floor(Date.now() / 1000);
    var capcalera = { typ: 'JWT', alg: 'RS256', kid: prop_('EB_APP_ID') };
    var cos = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: iat, exp: iat + 3600 };

    var sense = b64url_(Utilities.newBlob(JSON.stringify(capcalera)).getBytes()) + '.' +
                b64url_(Utilities.newBlob(JSON.stringify(cos)).getBytes());

    /* SI LA CLAU NO SERVEIX, QUE ES NOTI AQUÍ.
       Apps Script diu «Invalid argument: key» i prou, i aquell missatge pujava
       fins a la pantalla com si fos una resposta del banc: es va perdre una
       tarda buscant per què el banc no publicava els moviments quan el que
       passava és que no els arribàvem ni a demanar. */
    var signatura;
    try {
      signatura = Utilities.computeRsaSha256Signature(sense, clauPem_());
    } catch (err) {
      var e = new Error('No he pogut signar la petició al banc: la clau privada ' +
                        '(EB_PRIVATE_KEY, a Propietats de l\'script) no serveix. ' +
                        'Apps Script diu: ' + err.message + '. Executa provaClauBanc().');
      e.clauDolenta = true;
      throw e;
    }

    var token = sense + '.' + b64url_(signatura);
    cache.put('eb_jwt', token, 3300);
    return token;
  }

  function eb_(cami, opcions) {
    opcions = opcions || {};
    opcions.muteHttpExceptions = true;
    opcions.headers = { Authorization: 'Bearer ' + jwt_() };
    if (opcions.payload) opcions.contentType = 'application/json';

    var r = UrlFetchApp.fetch(EB_BASE + cami, opcions);
    var text = r.getContentText();
    if (r.getResponseCode() >= 300) {
      throw new Error(cami + ' → ' + r.getResponseCode() + ' ' + Utils.talla(text, 300));
    }
    return Utils.desJson(text, {});
  }

  // ------------------------------------------------------------------- alta

  function comprova() {
    var r = eb_('/application', { method: 'get' });
    var redirect = prop_('EB_REDIRECT');
    var urls = r.redirect_urls || [];

    /* QUE ESTIGUI REGISTRADA NO VOL DIR QUE SIGUI LA NOSTRA.
       L'app antiga de finances també tenia la seva adreça registrada aquí, i
       en copiar les propietats és la que ve. Si es deixa passar, el banc
       redirigeix cap allà, l'app antiga diu «Banc connectat» i desa la sessió
       al seu full: JEFE es queda sense connectar i ningú avisa de res.

       Es comprova ANANT-HI i mirant qui contesta, no comparant
       identificadors. El primer intent comparava EB_REDIRECT amb
       `ScriptApp.getService().getUrl()`, que des de l'editor retorna la URL
       /dev: dos desplegaments del mateix projecte, dos identificadors
       diferents, i una alarma falsa sobre una configuració correcta.
       Qui contesta no admet interpretacions. */
    var quiContesta = null, respostaCurta = '';
    try {
      var resp = UrlFetchApp.fetch(redirect, { muteHttpExceptions: true, followRedirects: true });
      var cos = resp.getContentText();
      respostaCurta = Utils.talla(cos.replace(/\s+/g, ' '), 120);
      if (/<title>\s*JEFE\s*<\/title>/i.test(cos)) quiContesta = 'jefe';
      else if (/Finances backend actiu/i.test(cos)) quiContesta = 'app antiga de finances';
      else quiContesta = 'algú altre';
    } catch (e) {
      quiContesta = null;                 // sense xarxa: no acusem ningú
      respostaCurta = e.message;
    }

    return {
      aplicacio: r.name,
      entorn: r.environment,
      produccio: r.environment === 'PRODUCTION',
      activa: !!r.active,
      redirect: redirect,
      redirectRegistrada: urls.indexOf(redirect) >= 0,
      quiContesta: quiContesta,
      apuntaAJefe: quiContesta === null ? null : (quiContesta === 'jefe'),
      resposta: respostaCurta,
      registrades: urls
    };
  }

  function bancs(pais) {
    var r = eb_('/aspsps?country=' + (pais || 'ES'), { method: 'get' });
    return (r.aspsps || []).map(function (b) { return String(b.name); });
  }

  function connecta(nom) {
    nom = String(nom ||
      PropertiesService.getScriptProperties().getProperty(PROP_BANC_NOM) || '').trim();

    if (!nom) {
      throw new Error('Falta el nom del banc.\n' +
        'Executa bancsDisponibles(), i a Configuració del projecte → Propietats de ' +
        'l\'script crea la propietat BANC_NOM amb el nom exacte que surti.');
    }

    /* El nom ha de ser EXACTE. Si no ho és, l'API contesta amb un error que no
       diu què li passa, i et quedes mirant-lo. Val més comprovar-ho abans i
       dir-li quins s'hi assemblen. */
    var disponibles = (eb_('/aspsps?country=ES', { method: 'get' }).aspsps || [])
      .map(function (b) { return b.name; });
    if (disponibles.indexOf(nom) === -1) {
      var busca = nom.toUpperCase();
      var semblants = disponibles.filter(function (n) {
        return n.toUpperCase().indexOf(busca) !== -1 || busca.indexOf(n.toUpperCase()) !== -1;
      });
      throw new Error('«' + nom + '» no és cap nom exacte d\'entitat.' +
        (semblants.length
          ? ' Volies dir algun d\'aquests?\n  ' + semblants.join('\n  ') +
            '\nPosa\'l a la propietat de l\'script BANC_NOM.'
          : ' Executa bancsDisponibles() i copia\'n el nom exacte a BANC_NOM.'));
    }

    var fins = new Date(Date.now() + DIES_ACCES * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');

    /* EL `state` ES GUARDA, QUE PER AIXÒ EXISTEIX.
       Se'n generava un de nou a cada connexió i no es desava enlloc, o sigui
       que quan el banc tornava amb el codi ningú comprovava que aquell
       viatge fos el que havíem començat nosaltres. L'adreça de tornada és
       oberta —ha de ser-ho, hi arriba el banc—, i sense aquesta comprovació
       un codi de l'autorització d'algú altre entrava igual i es desava com
       si fos el compte d'en Pol. Ara el que torna ha de dur el mateix bitllet
       que vam donar a l'anada. */
    var bitllet = Utilities.getUuid();

    var r = eb_('/auth', {
      method: 'post',
      payload: JSON.stringify({
        access: { valid_until: fins },
        aspsp: { name: nom, country: 'ES' },
        state: bitllet,
        redirect_url: prop_('EB_REDIRECT'),
        psu_type: 'personal'
      })
    });

    var e = estat();
    e.proveidor = 'enablebanking';
    e.institution = nom;
    e.connected = false;
    e.authId = r.authorization_id;
    e.state = bitllet;
    e.since = Utils.ara();
    desaEstat(e);

    return r.url;
  }

  /**
   * QUI TORNA ÉS QUI VA MARXAR?
   * Es compara amb el bitllet desat a l'anada. Si no n'hi ha cap de desat
   * —una connexió començada abans que existís això— es deixa passar: val més
   * això que deixar en Pol sense poder reconnectar el banc amb una connexió
   * a mig fer. En canvi, si n'hi ha un i no coincideix, no es passa.
   */
  function bitlletValid(state) {
    var desat = estat().state;
    if (!desat) return true;
    return String(state || '') === String(desat);
  }

  /** La crida el nucli quan el banc torna amb ?code=… No s'executa a mà. */
  function creaSessio(codi) {
    var r = eb_('/sessions', { method: 'post', payload: JSON.stringify({ code: codi }) });

    // El uid és el que fa servir /accounts/{uid}/transactions
    var comptes = (r.accounts || []).map(function (a, i) {
      var d = (r.accounts_data || [])[i] || {};
      return { uid: d.uid || a.uid || a,
               iban: (a.account_id && a.account_id.iban) || d.iban || '' };
    }).filter(function (a) { return a.uid && typeof a.uid === 'string'; });

    if (!comptes.length) throw new Error('El banc no ha retornat cap compte.');

    var e = estat();
    e.proveidor = 'enablebanking';
    e.sessionId = r.session_id;
    e.accounts = comptes;
    e.connected = true;
    e.caduca = Utils.aText(new Date(Date.now() + DIES_ACCES * 864e5));
    desaEstat(e);

    Log.info('banc.sessio', 'Banc connectat', { comptes: comptes.length });
    return { comptes: comptes.length };
  }

  // --------------------------------------------------------- sincronització

  /**
   * Baixa els moviments nous i els desa.
   *
   * La deduplicació és per `id_banc`: el mateix moviment mai no entra dues
   * vegades encara que la sincronització es repeteixi o es solapi.
   */
  /* L'IDENTIFICADOR AMB QUÈ SABEM SI UN MOVIMENT JA HI ÉS.
     Viu aquí i no dins de `sincronitza` perquè el reompliment de «qui cobra»
     ha de calcular-lo EXACTAMENT igual: si les dues fórmules es separessin,
     el reompliment no trobaria cap fila i diria que ho ha fet tot sense haver
     tocat res. */
  function idBanc_(b, uid, quan, imp, desc) {
    return b.entry_reference || b.transaction_id ||
           (uid + '|' + quan + '|' + imp + '|' + String(desc).slice(0, 24));
  }

  /** El que cal de cada transacció per desar-la o per retrobar-la. */
  function llegeixTransaccio_(b, uid) {
    var imp = parseFloat((b.transaction_amount && b.transaction_amount.amount) || '0');
    if (!imp) return null;
    var esIngres = b.credit_debit_indicator === 'CRDT';
    var quan = String(b.booking_date || b.value_date || b.transaction_date ||
                      Utils.avui()).slice(0, 10);
    var desc = FinancesRegles.descripcio(b);
    return { imp: imp, esIngres: esIngres, quan: quan, desc: desc,
             id: idBanc_(b, uid, quan, imp, desc) };
  }

  /**
   * ══════════════════════════════════════════════════════════════════════
   * OMPLE «QUI COBRA» ALS MOVIMENTS QUE JA HI HA
   * ══════════════════════════════════════════════════════════════════════
   *
   * El compte de qui cobra es desa des que es desa, i els moviments d'abans no
   * en tenen cap. Això no seria greu si només afectés el futur, però afecta el
   * present: les propostes de rebuts fixos miren els SIS ÚLTIMS MESOS, i tots
   * són d'abans. O sigui que sense això, la millora no s'aplicaria fins d'aquí
   * a mig any.
   *
   * Es tornen a demanar les transaccions al banc i s'omple la columna a les
   * files que ja hi són, lligant-les pel mateix identificador amb què es va
   * decidir que no eren noves. No crea res, no esborra res i no toca cap altra
   * columna: si el banc no envia la contrapart d'una, aquella es queda igual.
   *
   * GASTA UNA MIRADA de les que el banc et deixa fer al dia. Per això és a mà
   * i no automàtic.
   */
  function omplequiCobra(dies) {
    var e = estat();
    if (!disponible()) return { motiu: 'El banc encara no està connectat.' };

    var perId = {}, buits = 0;
    Dades.llegeix('Moviments').forEach(function (f) {
      if (f.esborrat_el || !f.id_banc) return;
      if (String(f.contrapart || '')) return;        // ja el té
      perId[String(f.id_banc)] = f.id;
      buits++;
    });
    if (!buits) return { buits: 0, omplerts: 0, motiu: 'Ja el tenen tots.' };

    /* ELS DIES QUE EL TEU BANC DEIXA MIRAR ENRERE NO ELS SAP NINGÚ.
       La primera vegada es van demanar cent vuitanta i el banc va contestar
       «WRONG_TRANSACTIONS_PERIOD»: no és que la sessió estigui morta, és que
       aquell període no el deixa. Cada banc en té un de diferent i no ho diu
       enlloc, o sigui que es baixa fins que un funciona. Quan un funciona es
       desa, i a partir d'aquí ja no s'endevina més. */
    var escala = [];
    if (Number(dies)) escala.push(Number(dies));
    if (e.finestraDies) escala.push(Number(e.finestraDies));
    [90, 60, 30, 10].forEach(function (d) { if (escala.indexOf(d) === -1) escala.push(d); });

    var trobats = {}, fonts = { compte: 0, nom: 0, cap: 0 };
    var mirats = 0, errors = [], provats = [], finestra = null;

    for (var i = 0; i < escala.length && finestra === null; i++) {
      var desde = Utils.aText(new Date(Date.now() - escala[i] * 864e5));
      var falla = null;
      mirats = 0; trobats = {}; fonts = { compte: 0, nom: 0, cap: 0 };

      (e.accounts || []).forEach(function (compte) {
        if (falla) return;
        var continuacio = null, voltes = 0;
        do {
          var q = '?date_from=' + desde +
                  (continuacio ? '&continuation_key=' + encodeURIComponent(continuacio) : '');
          var dades;
          try {
            dades = eb_('/accounts/' + compte.uid + '/transactions' + q, { method: 'get' });
          } catch (err) {
            falla = err.message;
            return;
          }

          (dades.transactions || []).forEach(function (b) {
            var t = llegeixTransaccio_(b, compte.uid);
            if (!t) return;
            mirats++;
            var idFila = perId[t.id];
            if (!idFila) return;                     // o és nova, o ja el tenia
            var qui = FinancesRegles.contrapart(b, t.esIngres);
            fonts[qui.font === 'compte' ? 'compte' : qui.font === 'nom' ? 'nom' : 'cap']++;
            if (!qui.valor) return;
            trobats[idFila] = qui.valor;
          });

          continuacio = dades.continuation_key;
        } while (continuacio && ++voltes < 20);
      });

      provats.push(escala[i] + (falla ? ' ✗' : ' ✓'));
      if (!falla) { finestra = escala[i]; break; }
      errors.push(escala[i] + ' dies: ' + Utils.talla(falla, 160));
      /* Si el problema NO és el període, baixar-lo no arreglarà res: la
         sessió està morta i el que cal és tornar a connectar el banc. */
      if (!/WRONG_TRANSACTIONS_PERIOD|period/i.test(falla)) break;
    }

    if (finestra !== null && finestra !== e.finestraDies) {
      e = estat();
      e.finestraDies = finestra;
      desaEstat(e);
    }

    var ids = Object.keys(trobats);
    var omplerts = 0;
    if (ids.length) {
      /* D'un sol viatge al full i no un per fila: dues-centes escriptures
         d'una en una es mengen el temps d'execució senceres. */
      omplerts = Dades.actualitzaMoltes('Moviments', ids, function (actual) {
        return { contrapart: trobats[actual.id] };
      });
    }

    Log.info('banc.contrapart', 'Reompliment de qui cobra',
             { buits: buits, mirats: mirats, omplerts: omplerts, fonts: fonts,
               finestra: finestra });

    return { buits: buits, mirats: mirats, omplerts: omplerts, fonts: fonts,
             errors: errors, finestra: finestra, provats: provats,
             caducat: finestra === null && errors.length &&
                      !/WRONG_TRANSACTIONS_PERIOD|period/i.test(errors[errors.length - 1]) };
  }

  function sincronitza() {
    var e = estat();
    if (!disponible()) return { nous: 0, motiu: 'El banc encara no està connectat.' };

    var vistos = {};
    var primera = true;
    Dades.llegeix('Moviments').forEach(function (f) {
      if (f.id_banc) vistos[String(f.id_banc)] = true;
      if (f.origen === 'banc') primera = false;
    });

    /* La primera vegada, 90 dies enrere; després només els últims 10. Si el
       banc ja ens ha dit que no arriba a 90 —ho aprèn `omplequiCobra`—, es
       demana el que accepta: demanar-ne més fa que rebutgi la petició sencera
       i no entri res, que és pitjor que entrar-ne menys. */
    var maxim = Number(e.finestraDies) || 90;
    var desde = Utils.aText(new Date(Date.now() - (primera ? Math.min(90, maxim) : 10) * 864e5));

    var nous = 0, errors = [];
    var perDesar = [];

    e.accounts.forEach(function (compte) {
      var continuacio = null, voltes = 0;
      do {
        var q = '?date_from=' + desde +
                (continuacio ? '&continuation_key=' + encodeURIComponent(continuacio) : '');
        var dades;
        try {
          dades = eb_('/accounts/' + compte.uid + '/transactions' + q, { method: 'get' });
        } catch (err) {
          errors.push('Compte ' + Utils.talla(compte.uid, 8) + ': ' + err.message);
          return;
        }

        (dades.transactions || []).forEach(function (b) {
          var t = llegeixTransaccio_(b, compte.uid);
          if (!t) return;
          var imp = t.imp, esIngres = t.esIngres, quan = t.quan, desc = t.desc;
          var idBanc = t.id;
          if (vistos[idBanc]) return;
          vistos[idBanc] = true;

          /* QUI HI HA A L'ALTRE COSTAT, guardat en entrar i no deduït després.
             El compte de qui cobra ve dins de la transacció i no torna mai
             més: si no es desa aquí, l'única manera de saber si dos rebuts són
             el mateix és comparar el text que es mostra, i aquell text porta
             el mes a dins. Vegeu `FinancesRegles.contrapart`. */
          var qui = FinancesRegles.contrapart(b, esIngres);

          perDesar.push({
            data: quan,
            tipus: esIngres ? 'i' : 'd',
            'import': Math.abs(imp),
            categoria: FinancesRegles.categoria(b, esIngres),
            descripcio: desc,
            metode: FinancesRegles.metode(b, esIngres),
            origen: 'banc',
            id_banc: idBanc,
            contrapart: qui.valor,
            pendent: b.status !== 'BOOK'
          });
          nous++;
        });

        continuacio = dades.continuation_key;
      } while (continuacio && ++voltes < 20);
    });

    /* Un a un i per `Finances.afegeix`, no en bloc: és aquesta funció la que
       consulta la memòria de comerços i decideix si el moviment ja entra
       classificat i revisat. Saltar-se-la per anar més de pressa tornaria a
       omplir la safata de coses que ja sabem. */
    var jaSabuts = 0;
    perDesar.forEach(function (m) {
      var fila = Finances.afegeix(m);
      if (String(fila.revisat).toUpperCase() === 'SI') jaSabuts++;
    });

    var saldos = actualitzaSaldos_(e);

    // De quan és el que veus. Es desa passi el que passi, encara que no hagi
    // entrat res: el que interessa saber és quan es va MIRAR, no quan va canviar.
    var ara = Utils.ara();
    e = estat();
    e.ultimaMirada = ara;
    e.ultimError = errors.length ? Utils.talla(errors[0], 200) : '';
    desaEstat(e);

    Log.info('banc.sincronitza', 'Sincronització', {
      nous: nous, jaSabuts: jaSabuts, saldos: saldos, errors: errors.length
    });

    return { nous: nous, jaSabuts: jaSabuts, perRevisar: nous - jaSabuts,
             saldos: saldos, errors: errors, quan: ara };
  }

  /* ------------------------------------------------------------------------
     SEMPRE AL DIA, PERÒ SENSE ABUSAR-NE

     El banc no ens avisa quan passa res: s'hi ha d'anar a mirar. I la llei
     que regula això —la PSD2— limita quantes vegades al dia s'hi pot anar
     sense que tu hi siguis al davant. O sigui que «sempre actualitzat» no vol
     dir preguntar-ho cada minut: vol dir preguntar-ho quan obres l'app, que
     és quan te'n serveix de res, i no tornar-hi si fa quatre minuts que s'ha
     mirat.

     Si el banc diu prou, no passa res de dolent: es queda el que hi havia i
     la pantalla diu de quan és. Val més un número amb la seva hora que un
     número que sembla d'ara i no ho és.
     ------------------------------------------------------------------------ */

  var MINUTS_ENTRE_MIRADES = 10;

  function ultimaMirada() {
    var e = estat();
    return e.ultimaMirada || null;
  }

  /** Quants minuts fa que no s'hi mira. Null si no s'hi ha mirat mai. */
  function minutsDesDeLaMirada_() {
    var q = ultimaMirada();
    if (!q) return null;
    var d = new Date(q);
    if (isNaN(d.getTime())) return null;
    return (new Date().getTime() - d.getTime()) / 60000;
  }

  /**
   * Mira el banc si fa prou estona que no s'hi mira. Si no cal, no fa res.
   * No llança mai: això ho crida una pantalla en obrir-se, i que el banc
   * estigui de mal humor no pot deixar-te sense pantalla.
   */
  function sincronitzaSiCal(minuts) {
    minuts = minuts === undefined ? MINUTS_ENTRE_MIRADES : minuts;

    if (!disponible()) {
      return { mirat: false, motiu: 'sense connexió amb el banc', quan: ultimaMirada() };
    }

    var fa = minutsDesDeLaMirada_();
    if (fa !== null && fa < minuts) {
      return { mirat: false, motiu: 'mirat fa poc', quan: ultimaMirada(), minuts: Math.round(fa) };
    }

    try {
      var r = sincronitza();
      r.mirat = true;
      return r;
    } catch (err) {
      /* Una negativa del banc no és una errada nostra: passa, i el que toca
         és seguir ensenyant el que teníem dient de quan és. */
      Log.avis('banc.mirada', 'No he pogut mirar el banc: ' + err.message);
      var e = estat();
      e.ultimError = Utils.talla(err.message, 200);
      desaEstat(e);
      return { mirat: false, motiu: 'el banc no ha contestat', error: err.message,
               quan: ultimaMirada() };
    }
  }

  /** De quan és el que es veu, per ensenyar-ho sense mentir. */
  function comEstem() {
    var e = estat();
    return {
      connectat: disponible(),
      quan: e.ultimaMirada || null,
      fa: e.ultimaMirada ? Utils.faQuant(e.ultimaMirada) : null,
      error: e.ultimError || ''
    };
  }

  /**
   * El saldo de cada compte, desat com a valor de patrimoni.
   * Un valor per dia: si es sincronitza dues vegades, la segona corregeix la
   * primera en comptes d'inflar l'històric.
   */
  function actualitzaSaldos_(e) {
    var avui = Utils.avui();
    var fets = 0;

    (e.accounts || []).forEach(function (compte) {
      var saldo = null;
      try {
        var r = eb_('/accounts/' + compte.uid + '/balances', { method: 'get' });
        var b = (r.balances || [])[0];
        (r.balances || []).forEach(function (x) {
          var t = String(x.balance_type || '').toUpperCase();
          if (t.indexOf('AVAILABLE') >= 0 || t === 'CLBD' || t === 'XPCD') b = x;
        });
        if (b && b.balance_amount) saldo = parseFloat(b.balance_amount.amount);
      } catch (err) {
        Log.avis('banc.saldo', 'No he pogut llegir un saldo', { error: err.message });
        return;
      }
      if (saldo === null || isNaN(saldo)) return;

      /* EL PROVEÏDOR CANVIA D'IDENTIFICADOR QUAN LI TORNES A DONAR PERMÍS.
         L'actiu es deia com aquell identificador, o sigui que el dia que la
         connexió caducava i la refeies, el compte naixia de nou al costat del
         vell: dos comptes iguals, un de congelat amb el saldo d'aquell dia i
         l'altre viu. El número de compte, en canvi, no canvia mai, i per això
         és el que mana ara. Els que ja existien es reconeixen igual i se'ls hi
         apunta el número: així no en neix cap de tercer. */
      var num = String(compte.iban || '').replace(/\s/g, '').slice(-10);
      var idNum = num ? 'auto_ib' + num : null;
      var idVell = 'auto_' + String(compte.uid).slice(0, 12);

      /* Un actiu arxivat no compta com a trobat. Si en Pol ha ajuntat dos
         comptes duplicats, el vell queda arxivat: tornar-hi a escriure el
         ressuscitaria a mitges —rebent saldos però sense sortir enlloc, que
         és el filtre de la pantalla— i el compte bo es quedaria congelat. */
      var viu = function (x) { return x && !x.esborrat_el ? x : null; };

      var actiu = idNum ? viu(Dades.perId('Patrimoni', idNum)) : null;
      if (!actiu && num) {
        actiu = Dades.llegeix('Patrimoni', function (x) {
          return !x.esborrat_el && String(x.automatic).toUpperCase() === 'SI' &&
                 String(x.iban || '') === num;
        })[0] || null;
      }
      if (!actiu) actiu = viu(Dades.perId('Patrimoni', idVell));

      var id;
      if (actiu) {
        id = actiu.id;
        if (num && String(actiu.iban || '') !== num) {
          Dades.actualitza('Patrimoni', id, { iban: num });
        }
      } else {
        id = idNum || idVell;
        Dades.insereix('Patrimoni', {
          id: id,
          nom: 'Compte' + (compte.iban ? ' ···' + String(compte.iban).slice(-4) : ''),
          tipus: 'banc',
          automatic: 'SI',
          iban: num
        }, 'act');
      }

      Dades.desa('PatrimoniHistoric', {
        id: 'val_' + id + '_' + avui,
        id_actiu: id, data: avui, valor: saldo
      }, ['id'], 'val');
      fets++;
    });

    return fets;
  }

  return {
    estat: estat,
    disponible: disponible,
    comprova: comprova,
    bancs: bancs,
    connecta: connecta,
    creaSessio: creaSessio,
    bitlletValid: bitlletValid,
    clauPem: clauPem_,        // per a provaClauBanc()
    sincronitza: sincronitza,
    omplequiCobra: omplequiCobra,
    sincronitzaSiCal: sincronitzaSiCal,
    ultimaMirada: ultimaMirada,
    comEstem: comEstem
  };
})();
