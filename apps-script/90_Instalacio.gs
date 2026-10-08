/**
 * FINANCES — Instal·lació i manteniment
 *
 * Ve del `90_Instalacio.gs` de JEFE, retallat al que fa servir aquesta app.
 * Funcions per executar A MÀ des de l'editor d'Apps Script:
 *
 *   instala()           → TOT D'UN COP, la primera vegada: el full, les dades
 *                         de JEFE, la clau d'accés i els automatismes.
 *   configura()         → crea el full de càlcul i l'estructura. Idempotent.
 *   comprovaCopia()     → les dades copiades de JEFE, quadren cel·la per cel·la?
 *   generaClauAcces()   → la clau que et demana la pantalla en connectar-la.
 *   instalaTriggers()   → instal·la els automatismes. Idempotent.
 *   treuTriggers()      → els desinstal·la.
 *   provaTriggers()     → hi són tots, i quants de cada?
 *   provaNotificacio()  → t'arriba un avís al mòbil?
 *
 * El banc, en aquest ordre i NOMÉS AL FINAL, quan la resta ja funcioni:
 *   provaBanc() → bancsDisponibles() → connectaBanc() → estatBanc()
 *   sincronitzaBancAra()  → baixa els moviments ara, sense esperar.
 *   provaClauBanc() · arreglaClauBanc() → la clau privada, si no signa.
 *   queSapElBanc()        → què contesta el banc, per entendre una sincronització.
 *   provaQuiCobra() · omplequiCobra() → d'on surt la identitat dels rebuts.
 *   mirarPatrimoni() · preparaFusio() → fusionaAra() · desfesLaFusio()
 *                         → els actius, i ajuntar-ne dos que són el mateix compte.
 */

/* EL FULL D'ON VENEN LES DADES. Es busca i es LLEGEIX: no s'hi escriu mai
   res. Vegeu `trobaFullJefe_` per com es reconeix. */
var NOM_FULL_JEFE = 'JEFE — Assistent';
var FULLS_FINANCES = ['Moviments', 'Categories', 'Recurrents', 'FinancesMemoria',
                      'Pressupostos', 'Patrimoni', 'PatrimoniHistoric'];

/**
 * LA PRIMERA VEGADA, AIXÒ I PROU.
 * Crea el full, s'hi porta les dades de JEFE, genera la clau i instal·la els
 * automatismes. Es pot tornar a executar: no duplica res ni torna a copiar
 * les dades si ja hi són. La clau, però, sí que la canvia; si ja la tens
 * posada a l'app, no l'executis més —fes servir les altres funcions.
 */
function instala() {
  var linies = [];
  linies.push(configura());
  linies.push(instalaTriggers());
  linies.push(generaClauAcces());
  var text = linies.join('\n\n');
  Logger.log(text);
  return text;
}

/**
 * Posada en marxa. Es pot executar tantes vegades com calgui:
 * si el full ja existeix, no en crea un altre; només posa al dia l'estructura.
 *
 * Quan el crea, abans de res s'hi porta les set pestanyes de finances del
 * full de JEFE —amb «Copia a», que deixa l'original on és i tal com és—.
 * Va ABANS d'`Esquema.sincronitza` a posta: si no, l'esquema crearia les
 * set pestanyes buides i les bones arribarien amb un altre nom al costat.
 */
function configura() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_ID_FULL);
  var ss;
  var acabatDeCrear = false;

  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create(NOM_FULL_CALCUL);
    props.setProperty(PROP_ID_FULL, ss.getId());
    acabatDeCrear = true;
  }

  var portades = portaDadesDeJefe_(ss);

  var informe = Esquema.sincronitza();
  var afegides = Config.inicialitza();
  var moduls = Moduls.sincronitzaFull();
  /* Aquí l'app del cos es portava també els ajustos de la IA del `_Config` de
     JEFE. Les finances no la fan servir per a res —classificar va per regles
     i per la memòria de comerços—, o sigui que no se'n porta cap. */

  if (acabatDeCrear) netejaFullPerDefecte_(ss);

  Log.info('instalacio', 'configura() completada', {
    creat: acabatDeCrear,
    portades: portades.copiades,
    fullsCreats: informe.fullsCreats,
    columnesAfegides: informe.columnesAfegides,
    configAfegida: afegides,
    moduls: moduls
  });

  var resum =
    (acabatDeCrear ? 'Full de càlcul creat.\n' : 'Full de càlcul ja existent, estructura posada al dia.\n') +
    'Dades de JEFE: ' + portades.text + '\n' +
    'Fulls creats: ' + (informe.fullsCreats.join(', ') || 'cap') + '\n' +
    'Columnes afegides: ' + (informe.columnesAfegides.join(', ') || 'cap') + '\n' +
    'Mòduls detectats: ' + moduls + '\n' +
    'URL: ' + ss.getUrl();

  console.log(resum);
  return resum;
}

/**
 * LES DADES ES COPIEN, NO ES MOUEN.
 *
 * Per cada pestanya que encara no és al full nou, se la copia del de JEFE
 * —`copyTo`, que és el mateix que «Copia a → Full de càlcul existent»— i li
 * torna el nom. L'original no es toca: ni es mou, ni s'esborra, ni s'hi
 * escriu. Si la pestanya ja hi és, no fa res: tornar-ho a executar no
 * duplica ni trepitja el que hagis apuntat des d'aquí.
 */
function portaDadesDeJefe_(ss) {
  var falten = FULLS_FINANCES.filter(function (n) { return !ss.getSheetByName(n); });
  if (!falten.length) return { copiades: [], text: 'ja hi eren, no s\'ha copiat res', origen: null };

  var origen = trobaFullJefe_(ss.getId());
  var copiades = [];
  falten.forEach(function (nom) {
    var full = origen.getSheetByName(nom);
    if (!full) return;   // a JEFE no hi era: l'esquema el crearà buit
    var copia = full.copyTo(ss);
    copia.setName(nom);
    copiades.push(nom + ' (' + Math.max(0, copia.getLastRow() - 1) + ' files)');
  });

  return {
    copiades: copiades,
    text: copiades.length ? 'copiades ' + copiades.join(', ') : 'cap pestanya de finances a JEFE',
    origen: origen
  };
}

/**
 * QUIN ÉS EL FULL DE JEFE.
 *
 * Primer es va buscar pel nom, «JEFE — Assistent», i no hi era: el full havia
 * tingut altres noms i el teu no es deia així. El nom no és de fiar; el que
 * hi ha a dins, sí. El full de JEFE és el que té les pestanyes de finances
 * (`Moviments`, `Categories`) i les del nucli (`_Config`, `_Moduls`).
 *
 *   1. Si a Propietats de l'script hi ha `ID_FULL_JEFE`, és aquest i prou.
 *   2. Si no, el busca pel nom de sempre i, si no hi és, pel contingut entre
 *      els fulls de càlcul del teu Drive.
 *   3. Si en surt més d'un, no en tria cap: diu quins són i com triar-lo.
 *
 * El full nou de finances (`idPropi`) no compta mai, encara que ja tingui
 * alguna d'aquestes pestanyes.
 */
function trobaFullJefe_(idPropi) {
  var posat = PropertiesService.getScriptProperties().getProperty('ID_FULL_JEFE');
  if (posat) return SpreadsheetApp.openById(posat);

  function esJefe(ss) {
    return ss.getSheetByName('Moviments') && ss.getSheetByName('Categories') &&
           ss.getSheetByName('_Config') && ss.getSheetByName('_Moduls');
  }

  function candidats(consulta, limit) {
    var trobats = [], vistos = 0;
    var it = DriveApp.searchFiles(consulta);
    while (it.hasNext() && vistos < limit) {
      var f = it.next();
      vistos++;
      if (f.getId() === idPropi) continue;
      try {
        var ss = SpreadsheetApp.openById(f.getId());
        if (esJefe(ss)) trobats.push(ss);
      } catch (e) { /* un full que no es pot obrir no és el nostre */ }
    }
    return trobats;
  }

  var FULLS = 'mimeType = "application/vnd.google-apps.spreadsheet" and trashed = false';
  var trobats = candidats(FULLS + ' and title = "' + NOM_FULL_JEFE + '"', 10);
  if (!trobats.length) {
    trobats = candidats(FULLS + ' and (title contains "JEFE" or title contains "Popu" or ' +
                        'title contains "Assistent" or title contains "Jefe")', 40);
  }
  if (!trobats.length) {
    trobats = candidats(FULLS + ' and "me" in owners', 300);
  }

  if (!trobats.length) {
    throw new Error('No trobo el full de dades de JEFE en aquest compte: cap full de càlcul teu ' +
                    'té alhora les pestanyes Moviments, Categories, _Config i _Moduls. Si és en un ' +
                    'altre compte de Google, obre aquest projecte amb aquell compte. Si el saps, posa ' +
                    'el seu identificador a Propietats de l\'script com a ID_FULL_JEFE.');
  }
  if (trobats.length > 1) {
    throw new Error('Hi ha ' + trobats.length + ' fulls que semblen el de JEFE: ' +
                    trobats.map(function (s) { return '«' + s.getName() + '»'; }).join(', ') +
                    '. No en trio cap a cegues: posa l\'identificador del bo a Propietats de ' +
                    'l\'script com a ID_FULL_JEFE i torna-ho a executar.');
  }
  return trobats[0];
}

/**
 * LA CÒPIA, QUADRA AMB JEFE?
 *
 * No es dona per fet que una còpia ha anat bé. `Moviments` és el full que més
 * costaria refer: el banc només dona noranta dies enrere, i el que sigui més
 * vell que això no es pot tornar a baixar.
 *
 * Per cada una de les set pestanyes compara, entre el full de JEFE i el nou:
 *   · quantes files i quantes columnes hi ha;
 *   · l'empremta de TOT el contingut —cada cel·la, en ordre—, de manera que
 *     una sola xifra canviada, una fila de menys o una de duplicada es veuen.
 *
 * Si `configura()` ha hagut d'afegir alguna columna nova al full nou, aquella
 * columna no compta: es compara només el que tots dos tenen en comú, que és
 * tot el que hi havia a JEFE.
 *
 * NOMÉS LLEGEIX. No escriu res ni a JEFE ni aquí.
 */
function comprovaCopia() {
  var l = ['=== LA CÒPIA DE LES DADES, QUADRA AMB JEFE? ==='];
  function a(t) { l.push(t); Logger.log(t); }

  var nou = SpreadsheetApp.openById(Config.idFull());
  var jefe = trobaFullJefe_(nou.getId());
  a('JEFE ....... «' + jefe.getName() + '»');
  a('Aquest ..... «' + nou.getName() + '»');
  a('');

  function empremta(valors) {
    var text = JSON.stringify(valors.map(function (fila) {
      return fila.map(function (v) { return v instanceof Date ? v.toISOString() : v; });
    }));
    return Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
  }

  var totBe = true;
  FULLS_FINANCES.forEach(function (nom) {
    var o = jefe.getSheetByName(nom), c = nou.getSheetByName(nom);
    if (!o) { a('· ' + nom + ': a JEFE no hi és, res a comparar'); return; }
    if (!c) { a('✗ ' + nom + ': NO HI ÉS al full nou'); totBe = false; return; }

    var fo = o.getLastRow(), co = o.getLastColumn();
    var fc = c.getLastRow(), cc = c.getLastColumn();
    var filesBe = fo === fc;
    var mateixes = filesBe && cc >= co && fo > 0 &&
      empremta(o.getRange(1, 1, fo, co).getValues()) === empremta(c.getRange(1, 1, fc, co).getValues());
    if (fo === 0 && fc === 0) mateixes = true;

    var dades = Math.max(0, fo - 1);
    if (filesBe && mateixes) {
      a('✓ ' + nom + ': ' + dades + ' files, idèntiques' +
        (cc > co ? ' (aquí hi ha ' + (cc - co) + ' columnes noves, buides)' : ''));
    } else {
      totBe = false;
      a('✗ ' + nom + ': JEFE en té ' + dades + ' files i ' + co + ' columnes; aquí ' +
        Math.max(0, fc - 1) + ' files i ' + cc + ' columnes' +
        (filesBe ? ', i el contingut NO és el mateix' : ''));
    }
  });

  a('');
  a(totBe ? 'TOT QUADRA. Les dades del full nou són les de JEFE.'
          : 'ALGUNA COSA NO QUADRA. No facis servir l\'app fins que s\'hagi mirat: el full ' +
            'de JEFE segueix intacte.');
  a('=== FI ===');
  return l.join('\n');
}

/**
 * Esborra el full buit «Full 1» / «Sheet1» que Google crea automàticament,
 * però NOMÉS si està completament buit i ja hi ha altres fulls.
 * Mai toca un full amb dades.
 */
function netejaFullPerDefecte_(ss) {
  var fulls = ss.getSheets();
  if (fulls.length < 2) return;

  for (var i = 0; i < fulls.length; i++) {
    var f = fulls[i];
    var nom = f.getName();
    var esPerDefecte = /^(Sheet1|Full 1|Hoja 1|Feuille 1)$/i.test(nom);
    var esBuit = f.getLastRow() === 0 && f.getLastColumn() === 0;
    if (esPerDefecte && esBuit) {
      ss.deleteSheet(f);
      Log.info('instalacio', 'Esborrat el full buit per defecte «' + nom + '»');
      return;
    }
  }
}

// ------------------------------------------------------------------ triggers

/**
 * ELS AUTOMATISMES QUE SÓN NOSTRES.
 *
 * Aquesta llista NO és decoració: és la que fa servir `treuTriggers` per
 * netejar abans de tornar-los a crear. Un automatisme que no hi surti no
 * s'esborra mai, i cada `instalaTriggers()` en deixa un de vell i en crea un
 * de nou. A JEFE va passar amb `triggerEscalfaFora` el 4 d'agost del 2026: en
 * van quedar dos, i entre tots dos es menjaven més quota diària de la que té
 * el compte sencer. Quan la quota s'acaba, Google atura TOTS els automatismes
 * sense dir res —i la quota és del compte, no d'aquest projecte: la gasten
 * també JEFE i les altres apps—.
 *
 * REGLA: si afegeixes un `newTrigger` aquí sota, el seu nom va aquí dalt. La
 * prova `eines/prova.mjs` ho comprova i peta si te'n descuides.
 */
var TRIGGERS = ['triggerManteniment', 'triggerEscalfa', 'triggerSenyals',
                'triggerBanc', 'triggerPatrimoni'];

/** Instal·la els automatismes. Esborra només els seus abans, mai els d'altri. */
function instalaTriggers() {
  treuTriggers();

  ScriptApp.newTrigger('triggerManteniment')
    .timeBased().atHour(3).everyDays(1).create();

  /* LA PANTALLA, PREPARADA. Desar-la fa que obrir l'app sigui ràpid.
     Cada deu minuts i no cada cinc com a JEFE: el que es desa dura mitja hora,
     o sigui que no caduca mai igualment, i la quota d'automatismes és de tot
     el compte —noranta minuts al dia per a JEFE i les apps que en surten—.
     Passar-se vol dir que s'atura tot, el banc inclòs, sense dir
     res. */
  ScriptApp.newTrigger('triggerEscalfa').timeBased().everyMinutes(10).create();

  /* ELS SENYALS, cada tres hores. Qui decideix si en surt cap és el
     pressupost de dos al dia —vegeu 65_Senyals.gs—, no aquesta xifra. */
  ScriptApp.newTrigger('triggerSenyals').timeBased().everyHours(3).create();

  /* EL BANC, TRES VEGADES AL DIA I CAP MÉS.
     La llei que regula això —la PSD2— limita quantes vegades al dia es pot
     anar a mirar un compte sense que en Pol hi sigui al davant, i normalment
     són quatre. Aquestes tres són TOTES les que hi ha: obrir l'app no en
     gasta cap, a posta, perquè entrar-hi vuit vegades un matí se les menjaria
     totes i a les deu ja no en quedaria ni una.

     Sis: el d'ahir ja està tancat i tu encara dorms.
     Tres: el que s'hagi mogut al matí.
     Vuit: el dia sencer, a temps que t'ho miris abans de sopar. */
  [6, 15, 20].forEach(function (h) {
    ScriptApp.newTrigger('triggerBanc').timeBased().atHour(h).everyDays(1).create();
  });

  // El patrimoni, el 28 al vespre: a temps de mirar-t'ho abans que acabi el mes.
  ScriptApp.newTrigger('triggerPatrimoni')
    .timeBased().onMonthDay(28).atHour(21).create();

  Log.info('instalacio', 'Triggers instal·lats', { triggers: TRIGGERS });
  return 'Triggers instal·lats: ' + TRIGGERS.join(', ');
}

/**
 * HI SÓN DE DEBÒ?
 *
 * Un automatisme que falta falla en silenci: te n'assabentes per no rebre
 * res. Això mira els que hi ha instal·lats ara mateix i els compara amb la
 * llista: diu els que falten i els que hi són repetits.
 */
function provaTriggers() {
  var compte = {};
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var n = t.getHandlerFunction();
    compte[n] = (compte[n] || 0) + 1;
  });
  var l = ['=== AUTOMATISMES ==='];
  var totBe = true;
  /* Del banc n'hi ha tres —a les 6, a les 15 i a les 20—; de la resta, un. */
  TRIGGERS.forEach(function (n) {
    var cal = n === 'triggerBanc' ? 3 : 1;
    var q = compte[n] || 0;
    if (q !== cal) totBe = false;
    l.push((q === cal ? '  ✓ ' : '  ✗ ') + n + (q === cal ? (cal === 1 ? '' : '  (' + q + ')') :
           '  (n\'hi ha ' + q + ', n\'hi ha d\'haver ' + cal + ')'));
  });
  l.push(totBe ? 'Tots hi són, els que toquen.' : 'Executa instalaTriggers() per arreglar-ho.');
  var text = l.join('\n');
  Logger.log(text);
  return text;
}

/**
 * Esborra els automatismes NOSTRES —els de la llista— i deixa estar els
 * d'altri. Si en trobés dos amb el mateix nom, els treu tots dos: duplicats
 * vol dir doble consum de quota, i la quota és de tot el compte.
 */
function treuTriggers() {
  var tots = ScriptApp.getProjectTriggers();
  var tret = 0;
  for (var i = 0; i < tots.length; i++) {
    if (TRIGGERS.indexOf(tots[i].getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(tots[i]);
      tret++;
    }
  }
  return 'Triggers eliminats: ' + tret;
}


// ------------------------------------------------- punts d'entrada dels triggers

/** Manteniment nocturn. Aquest sí que funciona des del primer dia. */
function triggerManteniment() {
  try {
    var informe = { rotades: 0, esquema: [] };

    informe.rotades = Log.rota();

    informe.esquema = Esquema.comprova();
    if (informe.esquema.length) {
      Esquema.sincronitza();
      informe.esquema = Esquema.comprova();
    }

    /* Aquí hi havia previst un reintent dels resums que haguessin fallat, i
       s'ha tret perquè seria mentida: el resum del dia es munta amb el que
       diuen els mòduls ARA, i a les tres de la matinada «ara» ja és l'endemà.
       Tornar-lo a generar li posaria a la nit de dimarts les xifres de
       dimecres. Si un vespre falla, hi ha el botó de demanar-lo a mà, i al
       registre en queda constància. */

    CacheService.getScriptCache().removeAll(['fitxa_ia']);

    Log.info('trigger.manteniment', 'Manteniment completat', informe);
  } catch (err) {
    Log.error('trigger.manteniment', err);
  }
}

/**
 * LA PANTALLA, PREPARADA ABANS QUE L'OBRIS.
 * La primera crida de cada estona costava segons: obrir el full i muntar la
 * pantalla. Això ho fa cada deu minuts —la pantalla d'inici, la de
 * l'app i la fitxa que llegeix la IA—, i quan l'obres ja hi és.
 *
 * NO FALLA MAI CAP A FORA. Escalfar és un luxe: si una pantalla peta mentre
 * es munta, es deixa estar i el registre ho diu.
 */
function triggerEscalfa() {
  var t0 = Date.now();
  var fets = [], fallats = [];

  function escalfa(nom, fn) {
    try { fn(); fets.push(nom); }
    catch (err) { fallats.push(nom + ': ' + err.message); }
  }

  var m = Moduls.actius();
  for (var i = 0; i < m.length; i++) {
    var id = m[i].id;
    var accions = m[i].accions || {};

    /* El que no surt d'un full no s'escalfa aquí: costa segons i no
       mil·lisegons. En aquesta app no n'hi ha cap, però la regla es queda. */
    if (m[i].volatil) continue;

    // Les targetes de la pantalla d'inici també, que és la primera que veus.
    if (typeof m[i].resumInici === 'function') {
      escalfa(id + ':targeta', (function (mod) {
        return function () {
          Memoria.recorda(mod.id, 'resumInici', function () { return mod.resumInici(); });
        };
      })(m[i]));
    }

    /* Cada mòdul s'escalfa per la porta per on hi entres tu, i amb els
       paràmetres de sèrie: el mes en curs, el dia d'avui. La resta —un mes
       de fa mig any, l'històric d'un hàbit— es munta quan hi vas, que és de
       tant en tant i no val la pena tenir-ho calent sempre. */
    if (typeof accions.pantalla === 'function') {
      escalfa(id, (function (a) { return function () { a({}); }; })(accions.pantalla));
    } else if (typeof accions.dia === 'function') {
      escalfa(id, (function (a) { return function () { a({}); }; })(accions.dia));
    }
  }

  /* LA FITXA QUE LLEGEIX LA IA, TAMBÉ.
     Cada cosa que li dius a JEFE —escrita o de veu— es prepara amb el que
     tenen a dir tots els mòduls. Es desa mitja hora, però no l'escalfava
     ningú: la primera pregunta de cada estona la pagava ell, i just abans de
     posar-se a esperar el model, que ja triga per si sol. Aquí no costa gairebé
     res perquè el que la fitxa mira ja acaba de quedar calent tres línies més
     amunt. */
  escalfa('fitxa de la IA', function () { Moduls.contextIA({ compacte: true }); });

  /* Es deixa dit quant ha trigat. Aquest automatisme s'executa unes cent quaranta
     vegades al dia i el pot d'automatismes és de noranta minuts: si un dia
     s'allargués, aquí es veuria abans que no pas quedant-nos sense avisos. */
  var ms = Date.now() - t0;
  if (fallats.length) {
    Log.avis('escalfa', 'Alguna pantalla no s\'ha pogut escalfar', { fallats: fallats, ms: ms });
  } else {
    Log.info('escalfa', 'Pantalles a punt', { quantes: fets.length, ms: ms });
  }
  /* Al registre de l'editor també: quan l'executes a mà des d'allà, el que
     retorna una funció no es veu enlloc, i sense això sembla que no hagi fet
     res. Va passar. */
  var resum = fets.join(', ') + '  ·  ' + ms + ' ms';
  Logger.log(resum);
  return resum;
}

/**
 * SINCRONITZACIÓ DEL BANC — cada matinada a les 6:00.
 *
 * Només avisa si hi ha alguna cosa a mirar. Un avís que diu «0 moviments
 * nous» cada matí és soroll, i el soroll fa que deixis de mirar els avisos
 * que sí que importen.
 */
function triggerBanc() {
  try {
    /* Els recurrents van AQUÍ i no en llegir una pantalla: obrir finances no
       t'ha d'escriure res al full. I van abans del banc perquè si el rebut
       que has apuntat com a recurrent també arriba del banc, el vegis com un
       possible duplicat i no com dos moviments que no tenen res a veure. */
    if (typeof Finances !== 'undefined') {
      var nous = ambBloqueig_(function () { return Finances.generaRecurrents(); });
      if (nous.length) Log.info('trigger.recurrents', nous.length + ' recurrents creats');
    }

    if (typeof FinancesBanc === 'undefined' || !FinancesBanc.disponible()) return;

    /* Amb un límit de quatre mirades al dia, dues seguides són una de perduda.
       Apps Script pot repetir un trigger si el primer intent no acaba net, i
       una hora de marge separa de sobres les tres que volem de les que no. */
    var r = ambBloqueig_(function () { return FinancesBanc.sincronitzaSiCal(60); });
    if (!r.nous) return;

    // Si tot ha entrat ja classificat, no hi ha res a decidir: no molestem.
    if (!r.perRevisar) {
      Log.info('trigger.banc', r.nous + ' moviments nous, tots ja classificats');
      return;
    }

    /* «Moviments» una vegada i prou. Deia «3 moviments per classificar. Han
       entrat 5 moviments i 2 ja sabia què eren» —tres cops la mateixa paraula
       en dues frases—, i quan tots els que entraven eren per classificar
       acabava en «1 moviment per classificar. N'han entrat 1», que és la
       segona frase dient el que ja deia la primera. */
    var cos = r.perRevisar === r.nous
      ? r.nous + (r.nous === 1 ? ' moviment nou per classificar.'
                               : ' moviments nous per classificar.')
      : r.perRevisar + (r.perRevisar === 1 ? ' moviment per classificar'
                                           : ' moviments per classificar') +
        '. N\'han entrat ' + r.nous +
        (r.jaSabuts ? ' i de ' + r.jaSabuts + ' ja sabia què eren' : '') + '.';

    Notifica.envia('Finances · banc', cos,
      { etiqueta: 'finances-banc', url: './#finances' });
  } catch (err) {
    Log.error('trigger.banc', err);
  }
}

/**
 * RECORDATORI DEL PATRIMONI — el dia 28 a les 21:00.
 *
 * Els comptes del banc s'actualitzen sols; el que no es pot llegir de cap
 * lloc —Trade Republic, accions, criptos— només el saps tu. Aquest avís
 * existeix perquè un valor de fa tres mesos no és el teu capital: és el que
 * era. A l'app antiga arribava per correu; ara és una notificació, que és on
 * mires.
 */
function triggerPatrimoni() {
  try {
    if (typeof Finances === 'undefined') return;
    var p = Finances.patrimoni();
    var manuals = p.actius.filter(function (a) { return !a.automatic; });
    if (!manuals.length) return;

    /* Els que fa menys d'una setmana que has tocat no compten: si acabes
       d'actualitzar-ho tot, no t'ha d'avisar ningú. */
    var vells = manuals.filter(function (a) { return a.dies === null || a.dies >= 7; });
    if (!vells.length) {
      Log.info('trigger.patrimoni', 'Tot actualitzat de fa poc, cap avís');
      return;
    }

    vells.sort(function (a, b) { return (b.dies === null ? 9999 : b.dies) - (a.dies === null ? 9999 : a.dies); });

    var detall = vells.slice(0, 3).map(function (a) {
      return a.dies === null ? a.nom + ' (mai)' : a.nom + ' (fa ' + a.dies + ' dies)';
    }).join(', ');

    /* AMB UN DE SOL, EL NOM SORTIA DUES VEGADES: «Toca actualitzar el pis: el
       pis (fa 40 dies)». El detall ja porta el nom, o sigui que quan n'hi ha
       un de sol l'encapçalament no l'ha de repetir. */
    var quins = vells.length === 1
      ? 'Toca actualitzar ' + detall
      : vells.length + ' valors per actualitzar: ' + detall;

    Notifica.envia(
      'Finances · patrimoni',
      quins + '. Ara mateix tens anotat ' + Finances.eur(p.total) + '.',
      { etiqueta: 'patrimoni', url: './#finances' }
    );
    Log.info('trigger.patrimoni', 'Recordatori enviat', { vells: vells.length });
  } catch (err) {
    Log.error('trigger.patrimoni', err);
  }
}


// ------------------------------------------------------------------ claus i proves

/**
 * Genera la clau d'accés per a la interfície servida des de fora.
 *
 * Executa-la un cop. Escriu la clau al registre: copia-la, enganxa-la a la
 * pantalla quan te la demani, i no la desis enlloc més.
 * Si algun dia sospites que se t'ha escapat, torna a executar-la: la vella
 * deixa de servir a l'instant.
 */
function generaClauAcces() {
  var alfabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  var clau = '';
  var bytes = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  for (var i = 0; i < 48; i++) {
    clau += alfabet.charAt((bytes.charCodeAt(i % bytes.length) * (i + 7)) % alfabet.length);
  }

  PropertiesService.getScriptProperties().setProperty(PROP_CLAU_ACCES, clau);
  Log.info('instalacio', 'Clau d\'accés generada');

  var text = [
    '',
    '=== CLAU D\'ACCÉS DE FINANCES ===',
    '',
    clau,
    '',
    'Copia-la ara. Aquesta és l\'única vegada que te la mostro còmodament.',
    '(Sempre la pots recuperar a Configuració del projecte → Propietats de l\'script.)',
    '',
    'Qui tingui aquesta clau i l\'URL del desplegament pot llegir les teves dades.',
    'No la posis en cap fitxer del projecte ni la comparteixis.',
    '============================'
  ].join('\n');
  Logger.log(text);
  return text;
}

/**
 * PROVA DE NOTIFICACIONS — executa-la i mira't el mòbil.
 *
 * Comprova la cadena sencera: compte de servei, autenticació amb Google,
 * dispositius registrats i enviament real. Si arriba la notificació, tot
 * funciona; si no, el registre diu exactament on s'ha trencat.
 */
function provaNotificacio() {
  var linies = ['=== PROVA DE NOTIFICACIONS ==='];
  function afegeix(t) { linies.push(t); Logger.log(t); }

  if (!Notifica.disponible()) {
    afegeix('FALLA: ' + Notifica.motiu());
    return linies.join('\n');
  }
  afegeix('1. Compte de servei ..... correcte');

  // La configuració web (apiKey, vapid…) no es comprova des d'aquí: viu a
  // firebase.config.json, que és del client. Si algun dispositiu s'ha
  // registrat, és que aquella configuració ja funciona. Val més comprovar
  // el resultat que no pas repetir la declaració en dos llocs.
  var d;
  try {
    d = Notifica.dispositius();
  } catch (e) {
    afegeix('2. Dispositius .......... FALLA: falta el full _Dispositius');
    afegeix('');
    afegeix('Executa configura() per crear-lo i torna a provar-ho.');
    return linies.join('\n');
  }

  afegeix('2. Dispositius actius ... ' + d.length);
  d.forEach(function (x) { afegeix('   · ' + x.nom + '  (vist ' + x.vist_el + ')'); });

  if (!d.length) {
    afegeix('');
    afegeix('Cap dispositiu registrat encara. Al mòbil: obre l\'app i prem');
    afegeix('«Activa els avisos». Si el botó et diu');
    afegeix('que Firebase no està configurat, és que firebase.config.json encara');
    afegeix('té els valors d\'exemple o que no has fet git push.');
    return linies.join('\n');
  }

  var r = Notifica.envia(
    'Prova',
    'La cadena funciona de punta a punta: l\'app et pot escriure encara que estigui tancada.',
    { etiqueta: 'prova', url: './' }
  );
  afegeix('3. Enviades ............. ' + r.enviades + ' de ' + d.length);
  (r.errors || []).forEach(function (e) {
    afegeix('   ERROR a ' + e.nom + ': codi ' + e.codi + ' — ' + e.text);
  });

  afegeix('=== FI · mira\'t el mòbil ===');
  return linies.join('\n');
}


// ------------------------------------------------------------------ el banc

/** PAS 1 — comprova que les tres propietats de l'script estan ben posades. */
function provaBanc() {
  var l = ['=== CONNEXIÓ AMB ENABLE BANKING ==='];
  function a(t) { l.push(t); Logger.log(t); }

  var r;
  try { r = FinancesBanc.comprova(); }
  catch (err) { a('FALLA: ' + err.message); return l.join('\n'); }

  a('Aplicació ..... ' + r.aplicacio);
  a('Entorn ........ ' + r.entorn + (r.produccio ? '  correcte' : '  ÉS SANDBOX: veuràs dades inventades'));
  a('Activa ........ ' + (r.activa ? 'sí' : 'NO — falta activar-la al panell d\'Enable Banking'));
  a('Adreça de tornada:');
  a('  EB_REDIRECT diu ....... ' + r.redirect);
  a('  registrada a EB ....... ' + (r.redirectRegistrada ? 'sí' : 'NO'));
  a('  qui hi contesta ....... ' + (r.quiContesta || 'no ho he pogut comprovar'));

  if (r.apuntaAJefe === false) {
    a('');
    a('ATURA\'T. Aquella adreça no és aquesta app, i el banc hi redirigirà. Si és');
    a('JEFE o l\'app antiga de finances, dirà que s\'ha connectat i desarà la sessió');
    a('al SEU lloc: aquesta app es quedarà sense connexió i no t\'ho dirà ningú.');
    a('');
    a('Ha contestat: ' + r.resposta);
    a('');
    a('Posa a EB_REDIRECT l\'adreça del desplegament d\'aquesta app (la que acaba en');
    a('/exec, la de «Implementar → Gestionar implementacions»).');
    return l.join('\n');
  }

  if (!r.redirectRegistrada) {
    a('');
    a('Aquesta adreça no està registrada a enablebanking.com. Afegeix-la a les');
    a('redirect URLs de la teva aplicació.');
    a('Registrades ara mateix: ' + JSON.stringify(r.registrades));
    return l.join('\n');
  }

  a('');
  a(r.produccio && r.activa ? 'Tot correcte. Ara: bancsDisponibles().'
                            : 'Arregla el que surt marcat abans de continuar.');
  return l.join('\n');
}

/** PAS 2 — el teu banc. Copia el nom exacte a la propietat BANC_NOM. */
function bancsDisponibles(pais) {
  var l = FinancesBanc.bancs(pais || 'ES');
  var posat = PropertiesService.getScriptProperties().getProperty('BANC_NOM');

  Logger.log('Copia el nom del teu banc, exactament com surt aquí:\n');
  l.forEach(function (b) { Logger.log('  ' + b + (b === posat ? '   ← el que tens posat' : '')); });
  Logger.log('\n' + l.length + ' entitats a ' + (pais || 'ES') + '.');
  Logger.log('');

  if (posat && l.indexOf(posat) !== -1) {
    Logger.log('BANC_NOM ja és «' + posat + '» i coincideix. Executa connectaBanc().');
  } else if (posat) {
    Logger.log('ATENCIÓ: BANC_NOM diu «' + posat + '», que no és cap dels de sobre.');
    Logger.log('Corregeix-lo a Configuració del projecte → Propietats de l\'script.');
  } else {
    Logger.log('Ara ves a Configuració del projecte → Propietats de l\'script i crea:');
    Logger.log('    BANC_NOM = el nom exacte del teu banc');
    Logger.log('Després executa connectaBanc().');
  }
  return l.length;
}

/** PAS 3 — obre l'enllaç que et doni i identifica't al teu banc. */
function connectaBanc() {
  var url = FinancesBanc.connecta();
  Logger.log('OBRE AQUEST ENLLAÇ I IDENTIFICA\'T AL TEU BANC:\n' + url);
  Logger.log('\nQuan tornis, la connexió ja quedarà feta sola.');
  return url;
}

/** Com està la connexió, i què va passar l'última sincronització. */
function estatBanc() {
  var e = FinancesBanc.estat();
  var l = ['=== BANC ==='];
  function a(t) { l.push(t); Logger.log(t); }
  a('Banc ........ ' + (e.institution || '—'));
  a('Connectat ... ' + (e.connected ? 'sí' : 'NO'));
  a('Comptes ..... ' + ((e.accounts || []).length));
  a('Caduca ...... ' + (e.caduca || '—'));
  if (!e.authId) a('\n→ Encara no has executat connectaBanc().');
  else if (!e.sessionId) a('\n→ Has demanat el permís però la tornada del banc no s\'ha desat.');
  if (e.caduca && e.caduca < Utils.avui()) a('\n→ El permís ha caducat. Torna a executar connectaBanc().');
  return l.join('\n');
}

/** Baixa els moviments ara mateix, sense esperar la matinada. */
function sincronitzaBancAra() {
  var r = FinancesBanc.sincronitza();
  Logger.log('Moviments nous ......... ' + r.nous);
  Logger.log('Ja sabia què eren ...... ' + (r.jaSabuts || 0));
  Logger.log('Per classificar ........ ' + (r.perRevisar || 0));
  Logger.log('Saldos actualitzats .... ' + (r.saldos || 0));
  (r.errors || []).forEach(function (e) { Logger.log('  ERROR: ' + e); });
  if (r.motiu) Logger.log(r.motiu);
  return r.nous;
}

/**
 * Repara la clau privada si en enganxar-la s'han perdut els salts de línia.
 * El camp de Propietats de l'script és d'una sola línia, i sense els salts el
 * PEM deixa de ser vàlid. No mostra MAI el contingut: només comptadors.
 */
function arreglaClauBanc() {
  var p = PropertiesService.getScriptProperties();
  var k = (p.getProperty('EB_PRIVATE_KEY') || '').trim();
  if (!k) throw new Error('No hi ha cap propietat EB_PRIVATE_KEY.');

  Logger.log('Com estava: ' + k.length + ' caràcters, ' + k.split('\n').length + ' línies');

  var m = k.match(/-----BEGIN ([A-Z ]+?)-----([\s\S]*?)-----END/);
  if (!m) throw new Error('No hi trobo les marques BEGIN/END. Torna a enganxar el .pem sencer.');

  var tipus = m[1].trim();
  if (tipus === 'RSA PRIVATE KEY') {
    throw new Error('La clau és PKCS#1 i Apps Script només accepta PKCS#8. Cal convertir-la amb OpenSSL.');
  }
  if (tipus !== 'PRIVATE KEY') throw new Error('Tipus de clau inesperat: ' + tipus);

  var cos = m[2].replace(/[^A-Za-z0-9+\/=]/g, '');
  if (cos.length < 100) throw new Error('El cos de la clau és massa curt: s\'ha copiat a mitges.');

  var pem = '-----BEGIN PRIVATE KEY-----\n' + cos.match(/.{1,64}/g).join('\n') +
            '\n-----END PRIVATE KEY-----\n';
  p.setProperty('EB_PRIVATE_KEY', pem);

  Utilities.computeRsaSha256Signature('prova', pem);   // prova de foc
  Logger.log('La clau ja signa correctament. Torna a executar provaBanc().');
  return 'clau reparada';
}

/**
 * LA CLAU PRIVADA DEL BANC, MIRADA DE PROP.
 *
 * Apps Script, quan una clau RSA no li serveix, diu «Invalid argument: key» i
 * res més. Ni per què, ni quina. Aquí es mira la forma de la clau abans de
 * fer-la servir —que és on es veuen els problemes de debò— i després es prova
 * de signar-hi.
 *
 * NO ENSENYA LA CLAU. Només com és: si comença i acaba com ha de començar i
 * acabar, si té salts de línia de veritat, i quant fa.
 */
function provaClauBanc() {
  var l = [];
  function a(t) { l.push(t); Logger.log(t); }

  var props = PropertiesService.getScriptProperties();
  var clau = props.getProperty('EB_PRIVATE_KEY');
  var app = props.getProperty('EB_APP_ID');

  a('LA CLAU PRIVADA DEL BANC');
  a('');

  if (!app) a('EB_APP_ID .......... NO HI ÉS');
  else a('EB_APP_ID .......... ' + app.slice(0, 8) + '…  (' + app.length + ' caràcters)');

  if (!clau) {
    a('EB_PRIVATE_KEY ..... NO HI ÉS');
    a('');
    a('Ves a Apps Script → Configuració del projecte → Propietats de l\'script');
    a('i torna-hi a posar la clau privada que et va donar Enable Banking.');
    return l.join('\n');
  }

  a('EB_PRIVATE_KEY ..... ' + clau.length + ' caràcters');
  a('');

  var comenca = /^-----BEGIN (RSA )?PRIVATE KEY-----/.test(clau.trim());
  var acaba = /-----END (RSA )?PRIVATE KEY-----\s*$/.test(clau.trim());
  var saltsDeVeritat = clau.indexOf('\n') !== -1;
  var saltsEscrits = clau.indexOf('\n') !== -1;

  a('   comença per -----BEGIN ...... ' + (comenca ? 'sí' : 'NO'));
  a('   acaba per -----END ......... ' + (acaba ? 'sí' : 'NO'));
  a('   té salts de línia de debò ... ' + (saltsDeVeritat ? 'sí' : 'NO'));
  if (saltsEscrits) a('   ← porta \n ESCRITS com a dues lletres, i això no val');
  a('');

  var problemes = [];
  if (!comenca) problemes.push('no comença per -----BEGIN PRIVATE KEY-----');
  if (!acaba) problemes.push('no acaba per -----END PRIVATE KEY-----');
  if (saltsEscrits) problemes.push('porta \n escrits en comptes de salts');

  /* I ara la prova de debò, amb la clau TAL COM ES FARÀ SERVIR.
     El quadre de Propietats de l'script és d'una sola línia i es menja els
     salts en enganxar-hi un .pem: la clau se'n va plana. Abans de signar es
     torna a plegar. Provar-la aquí sense plegar-la diria que no serveix quan
     sí que servirà, i faria perseguir un problema que ja no hi és. */
  var plana = !saltsDeVeritat;
  var signa = true, motiu = '';
  try {
    Utilities.computeRsaSha256Signature('prova', FinancesBanc.clauPem());
  } catch (err) {
    signa = false; motiu = err.message;
  }

  if (plana) {
    a('   ← el quadre de Propietats no deixa desar salts de línia. La clau');
    a('     es torna a plegar sola abans de signar-hi: no has de fer res.');
    a('');
  }
  a('   SIGNA? ..................... ' + (signa ? 'SÍ' : 'NO — ' + motiu));
  a('');

  if (signa) {
    a('La clau serveix' + (plana ? ', un cop plegada' : '') + '. Si el banc segueix sense');
    a('donar res, el problema és un altre: executa queSapElBanc() i passa-m\'ho.');
    return l.join('\n');
  }

  a('AIXÒ ÉS EL QUE FA QUE NO ENTRIN ELS MOVIMENTS.');
  a('');
  if (problemes.length) {
    a('El que li veig de mal:');
    problemes.forEach(function (p) { a('   · ' + p); });
    a('');
  }
  a('Com arreglar-ho:');
  a('   1. Apps Script → Configuració del projecte → Propietats de l\'script');
  a('   2. Esborra el valor de EB_PRIVATE_KEY i torna-hi a enganxar el fitxer');
  a('      .pem sencer que et va donar Enable Banking, TAL QUAL: amb la línia');
  a('      del BEGIN, la del END i els salts de línia de cada ratlla.');
  a('   3. Torna a executar provaClauBanc() i mira que digui SIGNA? SÍ.');
  a('');
  a('Si l\'has perduda, se\'n genera una de nova a enablebanking.com i s\'ha de');
  a('registrar allà mateix: la vella deixa de servir.');
  return l.join('\n');
}

/**
 * PER QUÈ NO M'HAS ENTRAT ELS MOVIMENTS?
 *
 * Quan al matí has gastat i a la tarda no hi ha res a l'app, hi ha cinc coses
 * que poden haver passat i des de fora totes es veuen igual. Aquesta funció
 * les mira una per una i acaba ANANT AL BANC de debò, ara mateix, per si el
 * que falla és l'automatisme i no la connexió.
 *
 * No escriu res que la sincronització normal no escrigués igualment.
 */
function queSapElBanc() {
  var l = [];
  function a(t) { l.push(t); Logger.log(t); }

  a('EL BANC, PAS PER PAS');
  a('');


  /* 0. LA CLAU. Va primer perque si no serveix, tota la resta es soroll: no
     s'arriba ni a demanar res al banc, i des de fora sembla que el banc no
     doni res. */
  var potSignar = true;
  try {
    // Amb la clau TAL COM ES FARÀ SERVIR, plegada. Provar-la en cru deia que
    // no serveix quan sí que serveix, que és mentir a l'inrevés.
    Utilities.computeRsaSha256Signature('prova', FinancesBanc.clauPem());
  } catch (errClau) { potSignar = false; }

  a('0. LA CLAU PER SIGNAR');
  a('   serveix ........... ' + (potSignar ? 'si' : 'NO'));
  if (!potSignar) {
    a('');
    a("AQUI S'ATURA TOT. Sense poder signar no s'arriba ni a demanar res al");
    a("banc, i el que es veu des de fora es que el banc no dona res.");
    a("Executa provaClauBanc(): et dira que li passa i com arreglar-ho.");
    return l.join('\n');
  }
  // 1. Hi ha connexió?
  if (typeof FinancesBanc === 'undefined') { a('El mòdul del banc no existeix.'); return l.join('\n'); }
  var e = FinancesBanc.estat();
  a('1. CONNEXIÓ');
  a('   connectat ......... ' + (FinancesBanc.disponible() ? 'sí' : 'NO'));
  a('   comptes ........... ' + ((e.accounts || []).length));
  (e.accounts || []).forEach(function (c) {
    a('       · ' + (c.iban ? '···' + String(c.iban).slice(-4) : String(c.uid).slice(0, 12)));
  });
  if (e.valid_until) {
    var dies = Utils.diesEntre(Utils.avui(), String(e.valid_until).slice(0, 10));
    a('   el permís caduca .. ' + String(e.valid_until).slice(0, 10) +
      (dies !== null ? '  (' + (dies < 0 ? 'JA HA CADUCAT' : 'd\'aquí ' + dies + ' dies') + ')' : ''));
  }
  if (!FinancesBanc.disponible()) {
    a('');
    a('Sense connexió no hi ha res a fer: torna a executar connectaBanc().');
    return l.join('\n');
  }

  // 2. Els automatismes hi són?
  a('');
  a('2. AUTOMATISMES');
  var hores = [];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'triggerBanc') hores.push(t.getUniqueId().slice(0, 6));
  });
  a('   triggers de banc .. ' + hores.length + (hores.length ? '' : '  ← CAP: executa instalaTriggers()'));
  a('   n\'hi hauria d\'haver 3 (6:00, 15:00 i 20:00)');
  if (hores.length && hores.length !== 3) {
    a('   ← el nombre no quadra: executa instalaTriggers() i torna-hi');
  }

  // 3. Quan es va mirar per última vegada?
  a('');
  a('3. ÚLTIMA MIRADA');
  var com = FinancesBanc.comEstem();
  a('   quan .............. ' + (com.quan ? com.quan + '  (' + com.fa + ')' : 'mai'));
  if (com.error) a('   últim error ....... ' + com.error);

  // 4. Què hi ha entrat últimament?
  a('');
  a('4. ELS ÚLTIMS MOVIMENTS QUE VAN ENTRAR DEL BANC');
  var delBanc = Dades.llegeix('Moviments', function (m) {
    return !m.esborrat_el && m.origen === 'banc';
  });
  delBanc.sort(function (x, y) { return String(y.data).localeCompare(String(x.data)); });
  if (!delBanc.length) a('   cap. No n\'ha entrat mai cap del banc.');
  delBanc.slice(0, 6).forEach(function (m) {
    a('   ' + m.data + '  ' + (m.tipus === 'i' ? '+' : '−') + m['import'] + '  ' +
      Utils.talla(m.descripcio, 40));
  });

  // 5. I ara s'hi va, ara mateix.
  a('');
  a('5. HI VAIG ARA');
  var r;
  try {
    r = ambBloqueig_(function () { return FinancesBanc.sincronitza(); });
  } catch (err) {
    a('   ha petat: ' + err.message);
    a('');
    a('Si diu res de quota o de 429, és el banc que no deixa mirar-hi més');
    a('vegades avui. Si diu una altra cosa, passa-m\'ho.');
    return l.join('\n');
  }

  a('   moviments nous .... ' + r.nous);
  a('   ja sabuts ......... ' + r.jaSabuts);
  a('   saldos desats ..... ' + r.saldos);
  if (r.errors && r.errors.length) r.errors.forEach(function (x) { a('   error: ' + x); });

  a('');
  if (r.errors && r.errors.length) {
    /* AMB ERRORS NO ES POT DIR QUE EL BANC NO EN TINGUI: no els hi hem
       arribat a demanar. La primera versió d'això ho deia igualment, amb
       l'error imprès dues línies més amunt, i va enviar en Pol a esperar el
       banc quan el que fallava era la clau. */
    a('NO ES POT DIR QUE EL BANC NO EN TINGUI: la petició ha fallat, o sigui');
    a('que ni els hi hem demanat. Mira l\'error de sobre.');
    a('Si parla de «key» o de signar, executa provaClauBanc().');
  } else if (r.nous) {
    a('N\'han entrat ' + r.nous + ' ara mateix.');
    /* I NO S'ACUSA L'AUTOMATISME SI JA SE SAP QUÈ FALLAVA.
       La primera versió deia sempre «el que fallava era l'automatisme», i el
       dia que va entrar bé el que havia fallat era la clau —amb el motiu
       imprès quatre línies més amunt, al punt 3—. Si hi ha un error apuntat,
       el que fallava és allò i ja està arreglat. */
    if (com.error) {
      a('Abans fallava per això que diu el punt 3, i ara ja no: aquell problema');
      a('està resolt. Els automatismes tornaran a anar sols a les 6, les 15 i');
      a('les 20 sense que hagis de fer res.');
    } else {
      a('La connexió va bé i no hi havia cap error apuntat: si a l\'hora que');
      a('tocava no van entrar, mira els automatismes del punt 2.');
    }
  } else {
    a('La petició ha anat bé i el banc no en dona cap de nou. Si tu saps que');
    a('n\'hi ha d\'aquest matí, vol dir que EL BANC encara no els ha publicat:');
    a('les targetes solen trigar hores i de vegades fins l\'endemà.');
    a('Compara les dates del punt 4 amb el que et surt a l\'app del banc.');
  }
  return l.join('\n');
}

/**
 * OMPLE «QUI COBRA» ALS MOVIMENTS QUE JA TENS.
 *
 * El compte de qui cobra es desa des d'avui, i els dos-cents moviments que hi
 * ha són d'abans. Això no seria greu si només afectés el futur, però les
 * propostes de rebuts fixos miren els SIS ÚLTIMS MESOS: sense reomplir-los, la
 * millora no s'aplicaria fins d'aquí a mig any.
 *
 * Torna a demanar les transaccions al banc i omple la columna a les files que
 * ja hi són. No crea res, no esborra res i no toca cap altra columna. Es pot
 * executar dues vegades sense fer mal: la segona ja no trobaria res per omplir.
 *
 * GASTA UNA DE LES MIRADES que el banc et deixa fer al dia.
 */
function omplequiCobra(dies) {
  var r = FinancesBanc.omplequiCobra(dies);
  var l = ['=== QUI COBRA, ALS MOVIMENTS QUE JA HI HA ==='];
  function a(t) { l.push(t); Logger.log(t); }

  if (r.motiu) { a(r.motiu); a(''); a('=== FI ==='); return l.join('\n'); }

  a('Sense contrapart ....... ' + r.buits);
  a('Finestres provades ..... ' + (r.provats || []).join(' · '));
  a('Transaccions mirades ... ' + r.mirats +
    (r.finestra ? ' (' + r.finestra + ' dies enrere)' : ''));
  a('Omplerts ............... ' + r.omplerts);
  a('');
  a('   amb el compte de qui cobra: ' + r.fonts.compte);
  a('   només amb el nom .........: ' + r.fonts.nom);
  a('   el banc no n\'envia cap ...: ' + r.fonts.cap);
  if (r.errors && r.errors.length) { a(''); a('El banc ha dit:'); r.errors.forEach(function (x) { a('   ' + x); }); }
  a('');

  if (r.caducat) {
    a('LA SESSIÓ AMB EL BANC S\'HA ACABAT.');
    a('   No és el període: el banc rebutja qualsevol finestra. Els permisos');
    a('   que li vas donar caduquen cada pocs mesos i s\'han de renovar.');
    a('   Executa connectaBanc() i torna a passar per la pàgina del banc.');
  } else if (r.finestra === null) {
    a('El banc no ha acceptat cap finestra. Mira el que ha dit aquí sobre.');
  } else if (r.omplerts) {
    a('Fet, i ara ja sabem que el teu banc deixa mirar ' + r.finestra + ' dies enrere.');
    a('Queda desat: la propera vegada no caldrà endevinar-ho.');
    a('Executa provaQuiCobra() per veure com ha quedat.');
    a('Els moviments més vells que aquests ' + r.finestra + ' dies no s\'ompliran mai:');
    a('aquells seguiran lligant pel text, com fins ara.');
  } else {
    a('El banc ha contestat, però no envia la contrapart de cap moviment.');
    a('Els rebuts es lligaran pel text, que és el que es feia fins ara.');
  }
  a('');
  a('=== FI ===');
  return l.join('\n');
}

/**
 * EL TEU BANC, DIU QUI COBRA?
 *
 * La identitat d'un rebut es busca per esglaons: el compte de qui cobra, el
 * seu nom, i com a últim recurs el text que es mostra. Quin esglaó fa servir el
 * teu banc no ho diu la documentació —tot és opcional i cada banc envia el que
 * vol—: només es pot saber mirant el que ha entrat de debò.
 *
 * Els moviments d'abans d'aquest canvi no en porten cap: no es desava. Si surt
 * que no en té cap, sincronitza el banc i torna-hi.
 */
function provaQuiCobra() {
  var l = ['=== D\'ON SURT LA IDENTITAT DELS TEUS REBUTS ==='];
  function a(t) { l.push(t); Logger.log(t); }

  var files;
  try {
    files = Dades.llegeix('Moviments', function (f) { return !f.esborrat_el; });
  } catch (err) {
    a('No he pogut llegir els moviments: ' + err.message);
    return l.join('\n');
  }

  files.sort(function (x, y) { return String(x.data) < String(y.data) ? 1 : -1; });
  var mira = files.slice(0, 200);
  if (!mira.length) { a('Encara no hi ha cap moviment.'); return l.join('\n'); }

  var compte = 0, nom = 0, cap = 0, delBanc = 0;
  mira.forEach(function (m) {
    if (String(m.origen) !== 'banc') return;
    delBanc++;
    var c = String(m.contrapart || '');
    if (c.indexOf('ib|') === 0) compte++;
    else if (c.indexOf('nm|') === 0) nom++;
    else cap++;
  });

  a('Mirats ................. ' + delBanc + ' moviments del banc (dels ' + mira.length + ' últims)');
  a('Amb el compte de qui cobra  ' + compte);
  a('Només amb el nom ........... ' + nom);
  a('Sense res .................. ' + cap);
  a('');

  /* ═══════════════════════════════════════════════════════════════════════
     I ARA EL NÚMERO QUE DE DEBÒ IMPORTA.

     «55 de 289» sembla dolent i no ho és: els 234 que el banc no identifica
     són compres amb targeta —el súper, la benzinera— i aquelles no seran mai
     un rebut fix. El que cal saber no és quants moviments porten identitat,
     sinó quants dels que SEMBLEN un rebut fix en porten. Comptar el total
     era comptar el que és fàcil en comptes del que decideix.
     ═══════════════════════════════════════════════════════════════════════ */
  var fiables = null, candidats = 0;
  try {
    var c = Finances.candidatsRecurrents();
    var L = c.llindars;
    var linia = function (g) {
      return '   ' + (g.fiable ? '✓' : '·') + ' ' + Utils.talla(g.descripcio, 32) +
             '  (' + g.font + ', ' + g.mesos + '/' + g.mesosMirats + ' mesos)';
    };

    /* LES QUE ES PROPOSARIEN, I LA RESTA A PART.
       La primera versió d'això barrejava les propostes de debò amb tot el que
       tingués tres mesos, i llavors la llista ensenyava dotze coses que no es
       proposaran mai. Semblava que el detector fos generós quan el que passava
       és que la comprovació mentia. */
    var quants = c.tots.length ? c.tots[0].mesosMirats : 0;
    a('MESOS D\'HISTÒRIA QUE HI HA ... ' + quants +
      (quants < L.finestra ? '  (el banc no en deixa consultar més)' : ''));
    a('ES PROPOSARIEN ARA .......... ' + c.propostes.length);
    c.propostes.forEach(function (g) { a(linia(g)); });
    if (!c.propostes.length && quants) {
      a('   (cap: n\'hi ha d\'haver a ' + Math.ceil(quants * L.presencia) +
        ' dels ' + quants + ' mesos)');
    }
    a('');

    var aprop = c.tots.filter(function (g) {
      return c.propostes.indexOf(g) === -1 && g.mesos >= L.mesosMinims;
    });
    if (aprop.length) {
      a('HI SÓN A PROP, PERÒ NO HI ARRIBEN .. ' + aprop.length);
      aprop.slice(0, 10).forEach(function (g) {
        a(linia(g) + '  → ' + (g.perQueNo || '?'));
      });
      if (aprop.length > 10) a('   … i ' + (aprop.length - 10) + ' més');
      a('');
    }

    a('   ✓ = el banc diu qui cobra: no es perdrà encara que li canviïn');
    a('       el concepte cada mes.');
    a('   · = va pel text, que ara ja no porta ni números ni noms de mes.');
    a('');

    var mirem = c.propostes.concat(aprop);
    candidats = mirem.length;
    fiables = mirem.filter(function (g) { return g.fiable; }).length;
  } catch (err) {
    a('No he pogut mirar els candidats: ' + err.message);
    a('');
  }

  if (cap === delBanc && delBanc) {
    a('CAP EN TÉ. Si són d\'abans d\'avui és normal: no es desava.');
    a('   Executa omplequiCobra() i es demanaran de nou al banc per omplir-los.');
    a('');
    a('=== FI ===');
    return l.join('\n');
  }

  /* EL VEREDICTE ES DONA PEL NÚMERO QUE DECIDEIX, i abans es donava pel fàcil.
     «43 de 200» sonava a fluix i no ho era: els 157 que el banc no identifica
     són compres amb targeta, i d'aquelles no en portarà mai. El que cal jutjar
     és si els que SEMBLEN un rebut fix van identificats. */
  if (!delBanc) {
    a('Cap moviment ve del banc: la identitat sortirà sempre del text.');
  } else if (fiables !== null && candidats) {
    if (fiables >= candidats * 0.5) {
      a('BÉ: dels que semblen un rebut fix, ' + fiables + ' de ' + candidats +
        ' els identifica el banc.');
      a('   Aquests no es perdran encara que els canviïn el concepte cada mes.');
      a('   Els altres van pel text, que ja no porta números ni noms de mes.');
    } else {
      a('EL TEU BANC IDENTIFICA POCS REBUTS (' + fiables + ' de ' + candidats + ').');
      a('   La resta aniran pel text. No és greu: el text ja no porta números');
      a('   ni noms de mes, o sigui que el concepte pot canviar cada mes.');
    }
  } else {
    a('Encara no hi ha prou història per dir-ho.');
  }
  a('');
  a('Els moviments amb targeta no porten mai qui cobra, i és normal: no hi ha');
  a('cap emissor darrere. Els rebuts domiciliats i les transferències sí, i');
  a('són justament els que aquest apartat busca.');

  a('');
  a('=== FI ===');
  return l.join('\n');
}


/* ==========================================================================
   EL MATEIX COMPTE DUES VEGADES

   Quan la connexió amb el banc caduca i la refàs, el proveïdor et dona un
   identificador nou per al mateix compte. Fins ara l'actiu es deia com aquell
   identificador, i per això en naixia un de nou al costat del vell: el vell es
   quedava congelat amb el saldo de l'últim dia que va funcionar.

   Això ja no tornarà a passar —ara mana el número de compte, que no canvia—,
   però el que ja ha passat s'ha d'arreglar a mà, i aquí hi ha les dues eines.
   Cap de les dues esborra res: la primera només mira, i la segona COPIA
   l'històric del vell al bo i després ARXIVA el vell, que és recuperable
   traient-li la data de la columna `esborrat_el`.
   ========================================================================== */

/** Què tens al patrimoni, amb els identificadors, per saber què és què. */
function mirarPatrimoni() {
  var l = [];
  function a(t) { l.push(t); Logger.log(t); }

  var actius = Dades.llegeix('Patrimoni');
  var hist = {};
  Dades.llegeix('PatrimoniHistoric').forEach(function (v) {
    var k = String(v.id_actiu);
    if (!hist[k]) hist[k] = [];
    hist[k].push({ data: String(v.data), valor: Number(v.valor) || 0 });
  });

  a('PATRIMONI — ' + actius.length + ' actius');
  a('');

  actius.forEach(function (x) {
    var h = (hist[x.id] || []).sort(function (p, q) { return p.data.localeCompare(q.data); });
    var ultim = h.length ? h[h.length - 1] : null;
    a((x.esborrat_el ? '[ARXIVAT] ' : '') + x.nom);
    a('    id ................ ' + x.id);
    a('    automàtic ......... ' + (String(x.automatic).toUpperCase() === 'SI' ? 'sí' : 'no'));
    if (x.iban) a('    número de compte .. ···' + x.iban);
    a('    últim valor ....... ' + (ultim ? ultim.valor + ' € del ' + ultim.data : 'cap'));
    a('    històric .......... ' + h.length + (h.length ? ' valors, des del ' + h[0].data : ''));
    a('');
  });

  a('Per ajuntar-ne dos:  fusionaPatrimoni("id del vell", "id del bo")');
  a('Digues-ho al revés i et quedaràs el saldo vell: mira bé quin és quin.');
  return l.join('\n');
}

/**
 * Ajunta dos actius: l'històric del vell passa al bo i el vell queda arxivat.
 *
 * No s'esborra res. Els valors del vell es COPIEN al bo, i només els dies que
 * el bo encara no tingui: si tots dos tenen un valor del mateix dia, mana el
 * del bo, que és el que està viu. Les files velles es queden on són.
 */
function fusionaPatrimoni(idVell, idBo) {
  var l = [];
  function a(t) { l.push(t); Logger.log(t); }

  if (!idVell || !idBo) return 'Falten identificadors. Fes primer mirarPatrimoni().';
  if (idVell === idBo) return 'Són el mateix. No hi ha res a ajuntar.';

  var vell = Dades.perId('Patrimoni', idVell);
  var bo = Dades.perId('Patrimoni', idBo);
  if (!vell) return 'No trobo cap actiu amb l\'id ' + idVell;
  if (!bo) return 'No trobo cap actiu amb l\'id ' + idBo;

  var tots = Dades.llegeix('PatrimoniHistoric');
  var delVell = tots.filter(function (v) { return String(v.id_actiu) === idVell; });
  var jaTe = {};
  tots.forEach(function (v) { if (String(v.id_actiu) === idBo) jaTe[String(v.data)] = true; });

  a('AJUNTANT');
  a('  vell: ' + vell.nom + '  (' + idVell + ')  · ' + delVell.length + ' valors');
  a('  bo:   ' + bo.nom + '  (' + idBo + ')' + (bo.esborrat_el ? '  [estava arxivat]' : ''));
  a('');

  /* El que es queda no pot quedar-se arxivat. Si ho estava —perquè una fusió
     anterior es va equivocar de compte— aquesta el torna a treure. */
  if (bo.esborrat_el) Dades.actualitza('Patrimoni', idBo, { esborrat_el: '' });

  var copiats = 0, saltats = 0;
  delVell.forEach(function (v) {
    var data = String(v.data);
    if (jaTe[data]) { saltats++; return; }
    Dades.desa('PatrimoniHistoric', {
      id: 'val_' + idBo + '_' + data,
      id_actiu: idBo, data: data, valor: Number(v.valor) || 0
    }, ['id'], 'val');
    jaTe[data] = true;
    copiats++;
  });

  Dades.actualitza('Patrimoni', idVell, { esborrat_el: Utils.ara() });

  // Es deixa constància de qui s'ha arxivat, per poder-ho desfer si m'he
  // equivocat de compte. Vegeu `desfesLaFusio()`.
  PropertiesService.getScriptProperties().setProperty(PROP_FUSIO_FETA,
    JSON.stringify({ vell: idVell, bo: idBo, copiats: copiats, quan: Utils.ara() }));

  a('  ' + copiats + ' valors copiats al bo');
  a('  ' + saltats + ' saltats perquè el bo ja tenia aquell dia');
  a('  «' + vell.nom + '» arxivat (no esborrat: treu-li la data d\'`esborrat_el` per recuperar-lo)');
  a('');
  a('Obre finances → patrimoni i mira que la línia sigui la que esperaves.');
  return l.join('\n');
}


/* --------------------------------------------------------------------------
   SENSE HAVER D'ESCRIURE CAP IDENTIFICADOR

   El botó d'executar de l'editor només crida funcions sense paràmetres, o
   sigui que `fusionaPatrimoni("a", "b")` des d'allà no es pot fer. Aquestes
   dues sí: la primera busca els duplicats i ensenya què faria, i la segona ho
   fa. Dos passos i no un, perquè res que toqui dades no ha de passar de cop
   pel primer botó que premis.
   -------------------------------------------------------------------------- */

var PROP_FUSIO = 'FUSIO_PATRIMONI_PREVISTA';
var PROP_FUSIO_FETA = 'FUSIO_PATRIMONI_FETA';

/** Busca comptes duplicats i diu què faria. NO toca res. */
function preparaFusio() {
  var l = [];
  function a(t) { l.push(t); Logger.log(t); }

  /* Els arxivats també entren. Una fusió mal feta deixa el compte BO arxivat,
     i si aquí no es miren, la manera d'arreglar-ho seria escriure identificadors
     a mà, que és justament el que no ha de caldre. */
  var actius = Dades.llegeix('Patrimoni');
  var hist = {};
  Dades.llegeix('PatrimoniHistoric').forEach(function (v) {
    var k = String(v.id_actiu);
    if (!hist[k]) hist[k] = [];
    hist[k].push({ data: String(v.data), valor: Number(v.valor) || 0 });
  });

  function ultim(id) {
    var h = (hist[id] || []).sort(function (p, q) { return p.data.localeCompare(q.data); });
    return h.length ? h[h.length - 1] : null;
  }

  /* Dos comptes són el mateix si ho diu el número de compte; i si encara no
     el tenen apuntat, si es diuen igual —el nom el fa el banc a partir del
     número, o sigui que dos comptes iguals es diuen igual. */
  var grups = {};
  actius.forEach(function (x) {
    if (String(x.automatic).toUpperCase() !== 'SI') return;
    var clau = x.iban ? 'n:' + x.iban : 'x:' + String(x.nom).trim().toLowerCase();
    if (!grups[clau]) grups[clau] = [];
    grups[clau].push(x);
  });

  /* QUI ÉS EL COMPTE VIU HO DIU LA CONNEXIÓ, NO JO.
     El primer intent el triava pel valor més recent, i això falla just el dia
     que es refà la connexió: aquell dia els DOS tenen valor, el vell del matí
     i el nou de la tarda, i llavors el desempat era l'ordre de la llista. Va
     arxivar el bo. La sessió del banc porta els comptes que està llegint ara
     mateix: el que hi surt és el viu i no hi ha res a endevinar. */
  var vius = {};
  try {
    var e = FinancesBanc.estat();
    (e.accounts || []).forEach(function (c) {
      vius['auto_' + String(c.uid).slice(0, 12)] = true;
      var num = String(c.iban || '').replace(/\s/g, '').slice(-10);
      if (num) vius['auto_ib' + num] = true;
    });
  } catch (err) { /* sense banc connectat: es decidirà com es pugui */ }

  var parelles = [], dubtes = [];
  Object.keys(grups).forEach(function (k) {
    var g = grups[k];
    if (g.length < 2) return;

    /* Un grup ja arreglat —un de sol sense arxivar i la resta apartats— no té
       res a proposar. Sense això, cada vegada tornaria a oferir la mateixa
       fusió que ja es va fer. */
    var sencers = g.filter(function (x) { return !x.esborrat_el; });
    if (sencers.length === 1 && vius[sencers[0].id]) return;
    if (sencers.length === 1 && !Object.keys(vius).length) return;

    var elsVius = g.filter(function (x) { return vius[x.id]; });

    if (elsVius.length === 1) {
      var bo = elsVius[0];
      g.forEach(function (x) { if (x.id !== bo.id) parelles.push({ vell: x.id, bo: bo.id, per: 'la connexió' }); });
      return;
    }

    /* Si la connexió no en reconeix cap —o en reconeix més d'un—, es mira el
       valor més recent. I si empaten, NO s'endevina: es pregunta. Equivocar-se
       de compte vol dir arxivar el bo, i això ja ha passat un cop. */
    g.sort(function (p, q) {
      var up = ultim(p.id), uq = ultim(q.id);
      return String(uq ? uq.data : '').localeCompare(String(up ? up.data : ''));
    });
    var d0 = ultim(g[0].id), d1 = ultim(g[1].id);
    if (elsVius.length > 1 || (d0 && d1 && d0.data === d1.data)) {
      dubtes.push(g);
      return;
    }
    for (var i = 1; i < g.length; i++) parelles.push({ vell: g[i].id, bo: g[0].id, per: 'la data' });
  });

  if (dubtes.length) {
    a('NO ME N\'ACABO DE FIAR, i per això no proposo res.');
    a('');
    dubtes.forEach(function (g) {
      g.forEach(function (x) {
        var u = ultim(x.id);
        a('  ' + x.nom + '  (' + x.id + ')');
        a('      ' + (u ? u.valor + ' € del ' + u.data : 'sense valors') +
          ' · ' + (hist[x.id] || []).length + ' valors');
      });
      a('');
    });
    a('Tots dos tenen valor del mateix dia i la connexió del banc no em diu quin');
    a('està llegint ara. Digue\'m tu quin és el bo —el del saldo que tens de debò—');
    a('i executa:  fusionaPatrimoni("id del vell", "id del bo")');
    a('...o digue-m\'ho a mi i t\'ho deixo preparat en un botó.');
    PropertiesService.getScriptProperties().deleteProperty(PROP_FUSIO);
    return l.join('\n');
  }

  if (!parelles.length) {
    a('No trobo cap compte duplicat.');
    a('');
    a('Si en veus un que jo no veig, fes mirarPatrimoni() i digue-m\'ho:');
    a('vol dir que els dos comptes no s\'assemblen en res que jo pugui comparar.');
    PropertiesService.getScriptProperties().deleteProperty(PROP_FUSIO);
    return l.join('\n');
  }

  a('HE TROBAT ' + parelles.length + (parelles.length === 1 ? ' duplicat' : ' duplicats'));
  a('');
  parelles.forEach(function (p) {
    var vell = Dades.perId('Patrimoni', p.vell);
    var bo = Dades.perId('Patrimoni', p.bo);
    var uv = ultim(p.vell), ub = ultim(p.bo);
    a('  Es queda:  ' + bo.nom + '  (' + p.bo + ')');
    a('             ' + (ub ? ub.valor + ' € del ' + ub.data : 'sense valors') +
      ' · ' + (hist[p.bo] || []).length + ' valors');
    a('             el trio per ' + p.per);
    a('  S\'hi ajunta: ' + vell.nom + '  (' + p.vell + ')');
    a('             ' + (uv ? uv.valor + ' € del ' + uv.data : 'sense valors') +
      ' · ' + (hist[p.vell] || []).length + ' valors, que passen al que es queda');
    a('');
  });

  PropertiesService.getScriptProperties()
    .setProperty(PROP_FUSIO, JSON.stringify(parelles));

  a('Si això és el que vols, executa ara:  fusionaAra');
  a('Si no ho és, no executis res i digue\'m què hauria de sortir.');
  return l.join('\n');
}

/** Fa el que ha dit `preparaFusio()`. Cal haver-la executat abans. */
function fusionaAra() {
  var brut = PropertiesService.getScriptProperties().getProperty(PROP_FUSIO);
  var parelles = Utils.desJson(brut, null);
  if (!parelles || !parelles.length) {
    return 'Primer executa preparaFusio() i mira que el que digui sigui el que vols.';
  }

  var l = [];
  parelles.forEach(function (p) {
    l.push(fusionaPatrimoni(p.vell, p.bo));
    l.push('');
  });

  PropertiesService.getScriptProperties().deleteProperty(PROP_FUSIO);
  l.push('Fet. Obre finances → patrimoni i mira que la línia sigui la que esperaves.');
  var text = l.join('\n');
  Logger.log(text);
  return text;
}


/**
 * DESFÀ L'ÚLTIMA FUSIÓ.
 *
 * Treu l'arxivat al compte que es va apartar. Els valors que s'haguessin
 * copiat es queden on són —aquí no s'esborra res mai— però com que el que
 * mana és l'últim valor de cada compte, tornar a fer la fusió al dret els
 * torna a deixar bé.
 */
function desfesLaFusio() {
  var l = [];
  function a(t) { l.push(t); Logger.log(t); }

  var props = PropertiesService.getScriptProperties();
  var feta = Utils.desJson(props.getProperty(PROP_FUSIO_FETA), null);

  if (!feta || !feta.vell) {
    a('No tinc constància de cap fusió feta per mi.');
    a('');
    a('Si n\'hi ha una per desfer, fes mirarPatrimoni() i digue-m\'ho: al full');
    a('es recupera treient la data de la columna `esborrat_el` de la fila.');
    return l.join('\n');
  }

  var vell = Dades.perId('Patrimoni', feta.vell);
  if (!vell) { a('L\'actiu ' + feta.vell + ' ja no hi és.'); return l.join('\n'); }

  Dades.actualitza('Patrimoni', feta.vell, { esborrat_el: '' });
  props.deleteProperty(PROP_FUSIO_FETA);
  props.deleteProperty(PROP_FUSIO);

  a('«' + vell.nom + '» (' + feta.vell + ') ja no està arxivat.');
  if (feta.copiats) {
    a('');
    a(feta.copiats + ' valors s\'havien copiat a l\'altre compte i s\'hi queden.');
    a('No molesten: el que mana és l\'últim valor de cada compte.');
  }
  a('');
  a('Ara torna a fer preparaFusio() i mira bé quin es queda.');
  return l.join('\n');
}

