/**
 * JEFE — proves del nucli
 *
 *   npm run prova     (i també des de `npm run puja`)
 *
 * Executa el codi de debò dels fitxers del nucli fora d'Apps Script, amb
 * dobles a sota en lloc de Google Sheets. No toca cap dada teva.
 *
 * Aquí hi va el que es pot comprovar sense el full: decisions de codi amb
 * regles clares. El que depèn de dades reals es comprova a l'app.
 */
import fs from 'fs';
import vm from 'vm';
import zlib from 'zlib';

let falles = 0;
function cal(nom, cond, extra) {
  console.log((cond ? '  ok   ' : '  FALLA') + '  ' + nom + (cond ? '' : '  → ' + extra));
  if (!cond) falles++;
}

/* EL PANY. El de debò el posa Apps Script; aquí n'hi ha prou amb un que digui
   que sí i porti el compte de quantes vegades l'han demanat, que és el que
   les proves d'escriptura volen mirar: que cap escriptura no hi passi per
   sobre. `panys.demanats` es posa a zero quan una prova vol comptar. */
const panys = { demanats: 0, alliberats: 0 };
function panyFals() {
  return {
    getScriptLock: () => ({
      tryLock: () => { panys.demanats++; return true; },
      releaseLock: () => { panys.alliberats++; }
    })
  };
}


/**
 * Carrega TOT el servidor en un sol espai global, com fa Apps Script.
 *
 * Els blocs d aquest fitxer solen carregar un fitxer sol, i n hi ha prou. Per
 * a les coses que travessen el nucli i un modul —els avisos programats, per
 * exemple— no: alla el que es comprova es precisament que es trobin.
 */
function carregaTotElServidor() {
  const ctx = {
    console, Date, JSON, Math, RegExp, Number, String, Object, Array,
    isFinite, isNaN, parseFloat, parseInt, encodeURIComponent, decodeURIComponent,
    Utilities: {}, DriveApp: {}, SpreadsheetApp: {}, UrlFetchApp: {}, CacheService: {},
    LockService: panyFals(), Session: {}, HtmlService: {}, CalendarApp: {}, MailApp: {},
    ContentService: {}, Logger: { log() {} }, ScriptApp: {},
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  fs.readdirSync('apps-script').filter((f) => f.endsWith('.gs')).sort()
    .forEach((f) => vm.runInContext(fs.readFileSync('apps-script/' + f, 'utf8'), ctx, { filename: f }));
  return ctx;
}

// ---------------------------------------------------------------- encaminador
console.log('\nEncaminador: escriure i tornar la pantalla en una sola crida');
{
  const CLAU = 'la-clau-bona-de-quaranta-vuit-caracters-exactes';
  const ctx = {
    Date, Log: { error() {}, avis() {} },
    Utils: { avui: () => '2026-08-01', ara: () => 'ara' },
    Moduls: null, Config: null, IA: null, Esquema: null, ScriptApp: null,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => CLAU }) },
    ContentService: null, HtmlService: null,
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    /* El resum de debò el fa Apps Script. Aquí n'hi ha prou amb un que
       torni bytes diferents per a textos diferents i sempre la mateixa
       llargada, que és el que la comparació dona per fet. */
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_alg, text) => {
        const b = new Array(32).fill(0);
        for (let i = 0; i < String(text).length; i++) {
          b[i % 32] = (b[i % 32] + String(text).charCodeAt(i) * (i + 7)) % 251;
        }
        return b;
      }
    },
    VERSIO_JEFE: 'prova', PROP_CLAU_ACCES: 'CLAU_ACCES'
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/30_Encaminador.gs', 'utf8'), ctx);

  let vistos = null;
  ctx.Moduls = {
    perId: () => ({
      accions: {
        captura: (p) => { vistos = JSON.parse(JSON.stringify(p)); return { id: 'tsk_1' }; },
        pantalla: (p) => ({ soc: 'la pantalla', params: p })
      }
    })
  };

  const r = ctx.api(CLAU, 'tasques', 'captura', { text: 'comprar pa', _pantalla: {} });
  cal('respon ok', r.ok === true, JSON.stringify(r));
  cal('torna el resultat de l\'escriptura', r.dades._resultat.id === 'tsk_1', JSON.stringify(r.dades));
  cal('torna la pantalla refeta', r.dades._pantalla.soc === 'la pantalla', JSON.stringify(r.dades));
  cal('l\'acció NO veu `_pantalla`', vistos && vistos._pantalla === undefined, JSON.stringify(vistos));
  cal('l\'acció sí que veu els seus paràmetres', vistos.text === 'comprar pa', JSON.stringify(vistos));

  // Sense demanar-la, tot ha de quedar exactament com abans.
  const r2 = ctx.api(CLAU, 'tasques', 'captura', { text: 'x' });
  cal('sense `_pantalla`, resposta de tota la vida', r2.dades.id === 'tsk_1', JSON.stringify(r2.dades));

  // `pantalla` demanant-se a si mateixa no s'ha de duplicar.
  const r3 = ctx.api(CLAU, 'tasques', 'pantalla', { _pantalla: {} });
  cal('`pantalla` no es crida a si mateixa', r3.dades.soc === 'la pantalla', JSON.stringify(r3.dades));

  // Un mòdul sense `pantalla` no ha de petar.
  ctx.Moduls.perId = () => ({ accions: { fes: () => 'fet' } });
  const r4 = ctx.api(CLAU, 'qualsevol', 'fes', { _pantalla: {} });
  cal('mòdul sense pantalla: no peta', r4.ok === true && r4.dades === 'fet', JSON.stringify(r4));
}

/* ---------------------------------------------------------------- la porta
   El desplegament és anònim: qualsevol que tingui l'adreça rep la pàgina i
   pot cridar el servidor des de la consola. La clau era només a `doPost`,
   o sigui que aquell camí entrava sense ensenyar-la. Això ho vigila. */
console.log('\nLa porta: cap crida sense clau, vingui d\'on vingui');
{
  const CLAU = 'la-clau-bona-de-quaranta-vuit-caracters-exactes';
  const apuntat = [];
  const ctx = {
    Date, Log: { error() {}, avis: (q, t, d) => apuntat.push(q) },
    Utils: { avui: () => '2026-08-01', ara: () => 'ara' },
    Moduls: { perId: () => ({ accions: { llegeix: () => 'les teves dades' } }) },
    Config: { idFull: () => 'FULL-123' },
    IA: null, Esquema: null, ScriptApp: null,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => CLAU }) },
    ContentService: null, HtmlService: null,
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_alg, text) => {
        const b = new Array(32).fill(0);
        for (let i = 0; i < String(text).length; i++) {
          b[i % 32] = (b[i % 32] + String(text).charCodeAt(i) * (i + 7)) % 251;
        }
        return b;
      }
    },
    VERSIO_JEFE: 'prova', PROP_CLAU_ACCES: 'CLAU_ACCES'
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/30_Encaminador.gs', 'utf8'), ctx);

  const bona = ctx.api(CLAU, 'finances', 'llegeix', {});
  cal('amb la clau bona, entra', bona.ok === true && bona.dades === 'les teves dades', JSON.stringify(bona));

  const dolenta = ctx.api('una-clau-inventada-qualsevol-de-48-caracters', 'finances', 'llegeix', {});
  cal('amb una clau dolenta, no entra', dolenta.ok === false, JSON.stringify(dolenta));
  cal('i no diu res del que hi havia a dins',
      !/les teves dades/.test(JSON.stringify(dolenta)), JSON.stringify(dolenta));
  cal('i ho deixa apuntat', apuntat.indexOf('api.rebutjat') !== -1, JSON.stringify(apuntat));

  cal('sense clau, no entra', ctx.api(undefined, 'finances', 'llegeix', {}).ok === false);
  cal('amb la clau buida, tampoc', ctx.api('', 'finances', 'llegeix', {}).ok === false);

  /* LA CRIDA D'ABANS TENIA TRES ARGUMENTS i el primer era el mòdul. Si algun
     client vell sobreviu en una pestanya oberta, ha de fallar i no colar-se
     pel forat: cap nom de mòdul no és mai la clau. */
  cal('una crida de les d\'abans no s\'hi cola',
      ctx.api('finances', 'llegeix', {}).ok === false);

  /* La llargada de la clau bona tampoc s'ha de poder endevinar provant. */
  cal('una clau d\'una lletra es rebutja igual', ctx.api('x', 'finances', 'llegeix', {}).ok === false);

  // El servidor sense clau posada ho ha de dir, no callar.
  ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  const sense = ctx.api(CLAU, 'finances', 'llegeix', {});
  cal('servidor sense clau configurada: ho diu', sense.ok === false && /generaClauAcces/.test(sense.error), JSON.stringify(sense));

  /* EL QUE S'INJECTA A LA PÀGINA QUE SE SERVEIX SENSE CLAU.
     Hi anava `estatSistema()` sencer, amb l'identificador i l'URL del full. */
  ctx.Moduls.perAlClient = () => [{ id: 'finances', nom: 'Finances' }];
  const pub = ctx.estatPublic_();
  cal('la pàgina pública porta els mòduls', pub.moduls.length === 1, JSON.stringify(pub));
  cal('i no porta l\'adreça del full', !/FULL-123/.test(JSON.stringify(pub)), JSON.stringify(pub));

  cal('el text d\'un error s\'escapa', ctx.escapaHtml_('<script>x</script>').indexOf('<') === -1,
      ctx.escapaHtml_('<script>x</script>'));
}

// ------------------------------------------------------------- actualitzaMoltes
console.log('\nDades.actualitzaMoltes: escriu per trams seguits');
{
  const escriptures = [];
  const capcalera = ['id', 'estat', 'esborrat_el'];
  const files = [];
  for (let i = 1; i <= 10; i++) files.push(['t' + i, 'feta', '']);

  const fulla = {
    getDataRange: () => ({ getValues: () => [capcalera].concat(files) }),
    getRange: (fila, c, n) => ({
      setValues: (v) => { escriptures.push({ fila, n, v }); }
    }),
    getMaxRows: () => 100
  };

  const ctx = {
    Utils: { nouId: () => 'x', ara: () => 'ARA' },
    Config: { full: () => ({ getSheetByName: () => fulla }) },
    LockService: panyFals(), Moduls: undefined
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/10_Dades.gs', 'utf8'), ctx);

  // t2,t3,t4 seguits · t7 sol · t9,t10 seguits  →  3 escriptures, no 6
  const n = ctx.Dades.actualitzaMoltes('Tasques', ['t3', 't10', 't2', 't7', 't4', 't9'],
                                       { esborrat_el: 'ARA' });
  cal('diu quantes n\'ha tocat', n === 6, String(n));
  cal('agrupa en 3 escriptures i no 6', escriptures.length === 3,
      escriptures.map(e => e.fila + '×' + e.n).join(' '));
  cal('els trams són els que toca',
      escriptures.map(e => e.fila + '×' + e.n).sort().join(' ') === '10×2 3×3 8×1',
      escriptures.map(e => e.fila + '×' + e.n).sort().join(' '));
  cal('escriu el canvi', escriptures[0].v[0][2] === 'ARA', JSON.stringify(escriptures[0].v[0]));
  cal('no toca el que no li han dit',
      escriptures.every(e => e.v.every(f => ['t2','t3','t4','t7','t9','t10'].indexOf(f[0]) !== -1)),
      JSON.stringify(escriptures.map(e => e.v.map(f => f[0]))));

  // Un id que no hi és no ha de fer caure res.
  escriptures.length = 0;
  const n2 = ctx.Dades.actualitzaMoltes('Tasques', ['no_existeix'], { estat: 'x' });
  cal('id inexistent: no escriu res', n2 === 0 && escriptures.length === 0, String(n2));

  // Amb una funció, cada fila rep uns canvis diferents. És el que fa possible
  // reordenar una llista: el mateix camp amb un valor per fila.
  escriptures.length = 0;
  const capcalera2 = ['id', 'ordre'];
  const files2 = [['a', 9], ['b', 9], ['c', 9]];
  const fulla2 = {
    getDataRange: () => ({ getValues: () => [capcalera2].concat(files2) }),
    getRange: (fila, c, n) => ({ setValues: (v) => { escriptures.push({ fila, n, v }); } }),
    getMaxRows: () => 100
  };
  ctx.Config.full = () => ({ getSheetByName: () => fulla2 });
  ctx.Dades.invalida();

  const n3 = ctx.Dades.actualitzaMoltes('Habits', ['c', 'a', 'b'],
                                        (h, i) => ({ ordre: i + 1 }));
  const escrits = escriptures.flatMap(e => e.v).map(f => f[0] + ':' + f[1]).sort().join(' ');
  cal('amb funció, cada fila rep el seu valor', n3 === 3 && escrits === 'a:2 b:3 c:1', escrits);
}

/* ------------------------------------------------------- cap escriptura sola
   «Mirar on acaba el full» i «escriure-hi» eren dos moments i entremig hi
   cabia una altra pestanya: totes dues escrivien a la mateixa fila i la
   segona es menjava la primera. El pany hi era —`ambBloqueig_`— però només
   el demanaven els automatismes de la nit, no el que toques tu. */
console.log('\nEscriure al full: cap escriptura no va sola');
{
  const capcalera = ['id', 'text', 'creat_el'];
  const files = [['t1', 'una', 'ARA']];
  const fulla = {
    getDataRange: () => ({ getValues: () => [capcalera].concat(files) }),
    getRange: () => ({ setValues: () => {} }),
    getLastRow: () => files.length + 1,
    getMaxRows: () => 100,
    insertRowsAfter: () => {}
  };
  const ctx = {
    Utils: { nouId: () => 'nou', ara: () => 'ARA' },
    Config: { full: () => ({ getSheetByName: () => fulla }) },
    LockService: panyFals(), Moduls: undefined
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/10_Dades.gs', 'utf8'), ctx);

  const prova = (nom, fn) => {
    panys.demanats = 0; panys.alliberats = 0;
    ctx.Dades.invalida();
    fn();
    cal(nom + ' demana el pany', panys.demanats === 1, String(panys.demanats));
    cal(nom + ' el torna', panys.alliberats === 1, String(panys.alliberats));
  };

  prova('inserir', () => ctx.Dades.insereix('Tasques', { text: 'dues' }));
  prova('actualitzar', () => ctx.Dades.actualitza('Tasques', 't1', { text: 'canviada' }));
  prova('desar', () => ctx.Dades.desa('Tasques', { id: 't1', text: 'x' }, ['id']));
  prova('inserir-ne moltes', () => ctx.Dades.insereixMoltes('Tasques', [{ text: 'a' }, { text: 'b' }]));
  prova('actualitzar-ne moltes', () => ctx.Dades.actualitzaMoltes('Tasques', ['t1'], { text: 'y' }));

  /* UN DINS DE L'ALTRE NO EN SÓN DOS. `desa` acaba cridant `insereix`, i els
     resums de la nit ja s'executen dins d'un bloqueig: si cadascú en demanés
     un de nou, el fil s'esperaria a si mateix. */
  panys.demanats = 0; ctx.Dades.invalida();
  ctx.Dades.desa('Tasques', { id: 'cap', text: 'nova' }, ['id']);
  cal('un pany dins d\'un altre no en demana dos', panys.demanats === 1, String(panys.demanats));

  panys.demanats = 0; ctx.Dades.invalida();
  ctx.ambBloqueig_(function () {
    ctx.Dades.insereix('Tasques', { text: 'dins' });
    ctx.Dades.insereix('Tasques', { text: 'dins també' });
  });
  cal('i el de fora val per a tot el que hi passi', panys.demanats === 1, String(panys.demanats));

  /* I quan el pany no es pot agafar, l'escriptura no es fa d'amagat. */
  ctx.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock() {} }) };
  let peta = false;
  try { ctx.Dades.insereix('Tasques', { text: 'sense pany' }); }
  catch (e) { peta = /ocupat/.test(e.message); }
  cal('si el pany no s\'agafa, no s\'escriu i es diu', peta === true);
}

// ----------------------------------- ajuntar el compte duplicat sense perdre res
console.log("");
console.log("Patrimoni: ajuntar dos comptes no ha de perdre cap valor");
{
  const actius = [
    { id: 'auto_vell', nom: 'Compte ···4471', tipus: 'banc', automatic: 'SI', esborrat_el: '' },
    { id: 'auto_ib0004471', nom: 'Compte ···4471', tipus: 'banc', automatic: 'SI', esborrat_el: '' }
  ];
  const hist = [
    { id: 'v1', id_actiu: 'auto_vell', data: '2026-05-01', valor: 4100 },
    { id: 'v2', id_actiu: 'auto_vell', data: '2026-06-01', valor: 4353 },
    { id: 'v3', id_actiu: 'auto_vell', data: '2026-07-01', valor: 4353 },
    { id: 'v4', id_actiu: 'auto_ib0004471', data: '2026-07-01', valor: 4090 },
    { id: 'v5', id_actiu: 'auto_ib0004471', data: '2026-08-01', valor: 4052 }
  ];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Logger: { log: () => {} },
    Log: { info() {}, avis() {}, error() {} },
    Utils: { ara: () => '2026-08-02T10:00:00+02:00', avui: () => '2026-08-02' },
    Dades: {
      llegeix: (full) => (full === 'Patrimoni' ? actius : hist).slice(),
      perId: (full, id) => (full === 'Patrimoni' ? actius : hist).filter(x => x.id === id)[0] || null,
      desa: (full, fila) => {
        const j = hist.findIndex(x => x.id === fila.id);
        if (j === -1) hist.push(fila); else hist[j] = fila;
        return fila;
      },
      actualitza: (full, id, canvis) => {
        const x = actius.filter(y => y.id === id)[0];
        if (x) Object.keys(canvis).forEach(k => { x[k] = canvis[k]; });
        return x || null;
      }
    },
    Config: {}, Esquema: {}, Moduls: {}, IA: {}, Notifica: {}, Calendari: {},
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null,
      setProperty: () => {}, deleteProperty: () => {} }) },
    ScriptApp: { getProjectTriggers: () => [] },
    SpreadsheetApp: {}, CacheService: {}, Utilities: {}, Session: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), CalendarApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8'), ctx);

  // Al revés del que toca: ha de dir que no.
  cal('sense identificadors, no fa res',
      /Falten identificadors/.test(ctx.fusionaPatrimoni('', 'auto_vell')), 'ho ha fet');
  cal("un id que no existeix, tampoc",
      /No trobo/.test(ctx.fusionaPatrimoni('no_hi_es', 'auto_ib0004471')), 'ho ha fet');

  ctx.fusionaPatrimoni('auto_vell', 'auto_ib0004471');

  const delBo = hist.filter(x => x.id_actiu === 'auto_ib0004471')
                    .sort((a, b) => a.data.localeCompare(b.data));
  cal("el bo es queda tota la línia, del maig a l'agost",
      delBo.map(x => x.data).join(' ') === '2026-05-01 2026-06-01 2026-07-01 2026-08-01',
      delBo.map(x => x.data).join(' '));
  cal('el dia que tots dos tenien, mana el del compte viu',
      delBo.filter(x => x.data === '2026-07-01')[0].valor === 4090,
      String(delBo.filter(x => x.data === '2026-07-01')[0].valor));
  cal("l'últim valor segueix sent el bo",
      delBo[delBo.length - 1].valor === 4052, String(delBo[delBo.length - 1].valor));
  cal("el vell queda arxivat, no esborrat",
      !!actius.filter(x => x.id === 'auto_vell')[0].esborrat_el, "no l'ha arxivat");
  cal("i les seves files es queden on eren, per si de cas",
      hist.filter(x => x.id_actiu === 'auto_vell').length === 3,
      String(hist.filter(x => x.id_actiu === 'auto_vell').length));
}

// ------------------------------------ el que has gastat avui, a la pagina del dia
console.log("");
console.log("Finances: el dia son moviments, no mitjanes");
{
  const AVUI = '2026-08-02';
  const categories = [
    { id: 'c_menjar', nom: 'Menjar', ordre: 1, exclou: '', esborrat_el: '' },
    { id: 'c_feina', nom: 'Feina', ordre: 2, exclou: '', esborrat_el: '' },
    { id: 'c_traspas', nom: 'Traspassos', ordre: 9, exclou: 'SI', esborrat_el: '' }
  ];
  const moviments = [
    { id: 'm1', data: AVUI, tipus: 'd', 'import': 48.2, categoria: 'c_menjar',
      descripcio: 'Supermercat', revisat: 'SI', esborrat_el: '' },
    { id: 'm2', data: AVUI, tipus: 'i', 'import': 1842, categoria: 'c_feina',
      descripcio: 'Nomina', revisat: 'SI', esborrat_el: '' },
    { id: 'm3', data: AVUI, tipus: 'd', 'import': 4.35, categoria: '',
      descripcio: 'Cafe', revisat: 'NO', esborrat_el: '' },
    // Un traspas: canviar diners de butxaca no es ni gastar ni guanyar.
    { id: 'm4', data: AVUI, tipus: 'd', 'import': 500, categoria: 'c_traspas',
      descripcio: 'A l estalvi', revisat: 'SI', esborrat_el: '' },
    // I un d ahir, que no hi pinta res.
    { id: 'm5', data: '2026-08-01', tipus: 'd', 'import': 99, categoria: 'c_menjar',
      descripcio: 'D ahir', revisat: 'SI', esborrat_el: '' }
  ];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, isFinite, parseFloat, parseInt, RegExp,
    Log: { info() {}, avis() {}, error() {} },
    Utilities: {
      formatDate: (d, tz, patro) => patro.indexOf('T') === -1
        ? [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-')
        : d.toISOString()
    },
    Config: { zonaHoraria: () => 'Europe/Madrid', get: () => null },
    Dades: {
      llegeix: (full, filtre) => {
        const files = full === 'Categories' ? categories : full === 'Moviments' ? moviments : [];
        if (typeof filtre === 'function') return files.filter(filtre);
        return files.slice();
      },
      un: () => null, perId: () => null, insereix: () => null,
      actualitza: () => null, desa: () => null
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
    SpreadsheetApp: {}, CacheService: { getScriptCache: () => null }, Session: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), CalendarApp: {}, ScriptApp: {},
    Moduls: { registra: () => {} }, Esquema: {}, IA: {}, Notifica: {},
    FinancesRegles: {}, FinancesImport: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  ctx.Utils.avui = () => AVUI;
  vm.runInContext(fs.readFileSync('apps-script/40_Mod_Finances.gs', 'utf8'), ctx);

  const b = ctx.Finances.elDia(AVUI);
  const linia = b.coses[0];

  cal("el bloc porta el nom i on va a parar", b.titol === 'Finances' && b.accio === 'finances',
      b.titol + '/' + b.accio);
  cal('la primera linia son els totals del dia',
      linia.text === 'Gastat 52,55 € · guanyat 1842,00 €', linia.text);
  cal('el traspas no compta ni com a despesa ni com a guany',
      linia.menut === '3 moviments', linia.menut);
  cal("el d'ahir no hi surt",
      b.coses.every(c => c.text.indexOf('ahir') === -1), JSON.stringify(b.coses.map(c => c.text)));
  cal('els grossos primer', b.coses[1].text === 'Nomina' && b.coses[2].text === 'Supermercat',
      b.coses[1].text + '/' + b.coses[2].text);
  cal('un ingres es marca amb el signe', b.coses[1].menut.indexOf('+1842,00 €') === 0,
      b.coses[1].menut);
  cal("el que encara no esta classificat, ho diu",
      b.coses[3].menut.indexOf('per classificar') !== -1, b.coses[3].menut);

  // Un dia sense res no ha de dir «Gastat 0,00 €».
  const buit = ctx.Finances.elDia('2026-07-15');
  cal('un dia sense res ho diu i prou',
      buit.coses.length === 1 && buit.coses[0].text === 'Res apuntat avui',
      JSON.stringify(buit.coses));
}

// ----------------------- el banc, sempre al dia pero sense passar-se de mirades
console.log("");
console.log("Banc: mirar-hi quan cal, i que una negativa no trenqui res");
{
  const props = {};
  let peticions = 0;
  let respon = () => { throw new Error('429 Too many requests'); };

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, isFinite, parseFloat, parseInt, RegExp,
    Log: { info() {}, avis() {}, error() {} },
    Utilities: {
      formatDate: (d, tz, patro) => patro.indexOf('T') === -1
        ? [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-')
        : d.toISOString(),
      base64EncodeWebSafe: () => 'x', computeRsaSha256Signature: () => [1],
      newBlob: (t) => ({ getBytes: () => t })
    },
    Config: { zonaHoraria: () => 'Europe/Madrid', get: () => null },
    Dades: { llegeix: () => [], un: () => null, perId: () => null,
             insereix: () => null, actualitza: () => null, desa: () => null },
    Finances: { afegeix: (m) => m },
    FinancesRegles: { descripcio: () => 'x', categoria: () => '', metode: () => '' },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props[k] === undefined ? null : props[k]),
      setProperty: (k, v) => { props[k] = v; }
    }) },
    UrlFetchApp: { fetch: () => { peticions++; return respon(); } },
    SpreadsheetApp: {}, Session: {},
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
    HtmlService: {}, LockService: panyFals(), CalendarApp: {}, ScriptApp: {},
    Moduls: { registra: () => {} }, Esquema: {}, IA: {}, Notifica: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('apps-script/42_Finances_Banc.gs', 'utf8'), ctx);

  // Sense banc connectat, ni ho intenta.
  let r = ctx.FinancesBanc.sincronitzaSiCal();
  cal('sense banc connectat no va enlloc',
      r.mirat === false && peticions === 0, JSON.stringify(r));

  // Ara sí, connectat. El banc contesta que no: no pot petar.
  props.FINANCES_BANC = JSON.stringify({ connected: true, accounts: [{ uid: 'u1' }] });
  props.EB_APP_ID = 'a'; props.EB_PRIVATE_KEY = 'k'; props.EB_REDIRECT = 'r';

  let hoIntenta = true;
  try { r = ctx.FinancesBanc.sincronitzaSiCal(); } catch (e) { hoIntenta = false; }
  cal("una negativa del banc no llança: la pantalla no es pot quedar sense res",
      hoIntenta === true, 'ha llançat');
  cal('i ho apunta, per poder-ho dir', /429/.test(ctx.FinancesBanc.comEstem().error),
      JSON.stringify(ctx.FinancesBanc.comEstem()));

  // Ara el banc contesta bé.
  respon = () => ({ getResponseCode: () => 200, getContentText: () => '{"transactions":[],"balances":[]}' });
  ctx.FinancesBanc.sincronitzaSiCal();
  const quan = ctx.FinancesBanc.ultimaMirada();
  cal("desa de quan es l'ultima mirada", !!quan, String(quan));

  // I ara la part que protegeix el limit diari: no s'hi torna abans d'hora.
  const abans = peticions;
  r = ctx.FinancesBanc.sincronitzaSiCal();
  cal('mirat fa un moment, no s hi torna',
      r.mirat === false && peticions === abans, JSON.stringify(r) + ' · ' + peticions);

  // LES MIRADES DEL DIA SÓN COMPTADES.
  // Cap pantalla les pot gastar: només els tres automatismes i el botó de mà.
  // (La pàgina del dia era de JEFE i aquí no hi és: es mira si algun dia torna.)
  const dolents = [];
  ['apps-script/vista_finances.html', 'apps-script/vista_dia.html',
   'apps-script/40_Mod_Finances.gs'].filter((f) => fs.existsSync(f)).forEach(function (f) {
    const t = fs.readFileSync(f, 'utf8');
    if (/refrescaBanc|sincronitzaSiCal/.test(t)) dolents.push(f);
  });
  cal('cap pantalla mira el banc en obrir-se', dolents.length === 0, dolents.join(' '));

  const inst = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  cal('els automatismes del banc són tres i a les 6, 15 i 20',
      inst.indexOf('[6, 15, 20].forEach') !== -1, 'no hi són');

  // Si li dius que amb zero minuts n'hi ha prou, sí que hi torna.
  r = ctx.FinancesBanc.sincronitzaSiCal(0);
  cal('i si se li demana expressament, hi torna',
      r.mirat === true && peticions > abans, JSON.stringify(r.mirat) + ' · ' + peticions);

  /* LA TORNADA DEL BANC. L'adreça on torna és oberta i el codi hi arriba per
     la URL: qualsevol pot trucar-hi amb un codi seu. El bitllet és l'única
     cosa que diu si aquell viatge el vam començar nosaltres. */
  props['FINANCES_BANC'] = JSON.stringify({ authId: 'a1', state: 'el-bitllet-bo' });
  cal('la tornada amb el bitllet bo es deixa passar',
      ctx.FinancesBanc.bitlletValid('el-bitllet-bo') === true);
  cal('la tornada amb un altre bitllet, no',
      ctx.FinancesBanc.bitlletValid('el-bitllet-d-un-altre') === false);
  cal('i sense bitllet, tampoc', ctx.FinancesBanc.bitlletValid('') === false);

  /* Una connexió començada abans que existís el bitllet no ha de quedar
     bloquejada per sempre: si no n'hi ha cap de desat, es deixa passar. */
  props['FINANCES_BANC'] = JSON.stringify({ authId: 'a1' });
  cal('una connexió d\'abans del bitllet no es queda encallada',
      ctx.FinancesBanc.bitlletValid('qualsevol') === true);
}

// --------------------------- trobar el compte duplicat sol, sense escriure cap id
console.log("");
console.log("Patrimoni: trobar el duplicat sense haver de dir-li quin es");
{
  const props = {};
  const actius = [
    // El congelat: l'ultim valor es de fa mesos.
    { id: 'auto_vell', nom: 'Compte ···4471', automatic: 'SI', iban: '', esborrat_el: '' },
    // El viu.
    { id: 'auto_ib0004471', nom: 'Compte ···4471', automatic: 'SI', iban: '', esborrat_el: '' },
    // I un de manual, que no te res a veure amb aixo.
    { id: 'act_tr', nom: 'Trade Republic', automatic: 'NO', iban: '', esborrat_el: '' }
  ];
  const hist = [
    { id: 'v1', id_actiu: 'auto_vell', data: '2026-05-01', valor: 4100 },
    { id: 'v2', id_actiu: 'auto_vell', data: '2026-06-01', valor: 4353 },
    { id: 'v3', id_actiu: 'auto_ib0004471', data: '2026-08-01', valor: 4052 },
    { id: 'v4', id_actiu: 'act_tr', data: '2026-08-01', valor: 9000 }
  ];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Logger: { log: () => {} },
    Log: { info() {}, avis() {}, error() {} },
    Utils: { ara: () => '2026-08-02T10:00:00+02:00', avui: () => '2026-08-02',
             desJson: (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } } },
    Dades: {
      llegeix: (full, filtre) => {
        const files = full === 'Patrimoni' ? actius : hist;
        return typeof filtre === 'function' ? files.filter(filtre) : files.slice();
      },
      perId: (full, id) => (full === 'Patrimoni' ? actius : hist).filter(x => x.id === id)[0] || null,
      desa: (full, fila) => {
        const j = hist.findIndex(x => x.id === fila.id);
        if (j === -1) hist.push(fila); else hist[j] = fila;
        return fila;
      },
      actualitza: (full, id, canvis) => {
        const x = actius.filter(y => y.id === id)[0];
        if (x) Object.keys(canvis).forEach(k => { x[k] = canvis[k]; });
        return x || null;
      }
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props[k] === undefined ? null : props[k]),
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: (k) => { delete props[k]; }
    }) },
    ScriptApp: { getProjectTriggers: () => [] },
    Config: {}, Esquema: {}, Moduls: {}, IA: {}, Notifica: {}, Calendari: {},
    SpreadsheetApp: {}, CacheService: {}, Utilities: {}, Session: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), CalendarApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8'), ctx);

  // Sense haver preparat res, no ha de fer res.
  cal('sense preparar-ho abans, no toca res',
      /Primer executa preparaFusio/.test(ctx.fusionaAra()), 'ho ha fet');

  const previsio = ctx.preparaFusio();
  cal("troba el duplicat sol", /HE TROBAT 1 duplicat/.test(previsio), previsio.slice(0, 60));
  cal('es queda el que te el valor mes recent',
      previsio.indexOf('Es queda:  Compte ···4471  (auto_ib0004471)') !== -1 &&
      previsio.indexOf('4052 € del 2026-08-01') !== -1, previsio);
  cal("i hi ajunta el congelat", previsio.indexOf("S'hi ajunta: Compte ···4471  (auto_vell)") !== -1 &&
      previsio.indexOf('4353 € del 2026-06-01') !== -1, previsio);
  cal('el manual no hi te res a veure', previsio.indexOf('Trade Republic') === -1, previsio);
  cal('mirar-ho NO ha tocat res', !actius.filter(x => x.esborrat_el).length, 'ha tocat alguna cosa');

  ctx.fusionaAra();
  const delBo = hist.filter(x => x.id_actiu === 'auto_ib0004471')
                    .sort((a, b) => a.data.localeCompare(b.data));
  cal('despres de fer-ho, la linia del bo va del maig a l agost',
      delBo.map(x => x.data).join(' ') === '2026-05-01 2026-06-01 2026-08-01',
      delBo.map(x => x.data).join(' '));
  cal("i l'ultim valor segueix sent el viu", delBo[delBo.length - 1].valor === 4052,
      String(delBo[delBo.length - 1].valor));
  cal('el congelat queda arxivat', !!actius.filter(x => x.id === 'auto_vell')[0].esborrat_el,
      'no l ha arxivat');

  // I no s'ha de poder repetir sense tornar-ho a preparar.
  cal('fer-ho dues vegades no torna a passar',
      /Primer executa preparaFusio/.test(ctx.fusionaAra()), 'ho ha tornat a fer');

  // I ara ja no queda cap duplicat per trobar.
  cal('un cop fet, ja no en troba cap',
      /No trobo cap compte duplicat/.test(ctx.preparaFusio()), 'encara en troba');
}

// ------------------- el dia que es refa la connexio, tots dos tenen valor d avui
console.log("");
console.log("Patrimoni: qui es el compte viu ho diu la connexio, no la data");
{
  const props = {};
  // El cas de debo: el vell porta 12 valors i encara en va rebre un l'1 d'agost;
  // el nou va neixer aquell mateix dia. Per data empaten.
  const actius = [
    { id: 'auto_6d32636a-4c5', nom: 'Banc', automatic: 'SI', iban: '', esborrat_el: '' },
    { id: 'auto_02786e6a-89d', nom: 'Banc', automatic: 'SI', iban: '', esborrat_el: '' }
  ];
  const hist = [];
  ['2026-07-21','2026-07-25','2026-07-30','2026-08-01'].forEach((d, n) =>
    hist.push({ id: 'v' + n, id_actiu: 'auto_6d32636a-4c5', data: d, valor: 4353.91 }));
  hist.push({ id: 'vn', id_actiu: 'auto_02786e6a-89d', data: '2026-08-01', valor: 4052.89 });

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Logger: { log: () => {} },
    Log: { info() {}, avis() {}, error() {} },
    Utils: { ara: () => '2026-08-02T12:00:00+02:00', avui: () => '2026-08-02',
             desJson: (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } } },
    Dades: {
      llegeix: (full, filtre) => {
        const files = full === 'Patrimoni' ? actius : hist;
        return typeof filtre === 'function' ? files.filter(filtre) : files.slice();
      },
      perId: (full, id) => (full === 'Patrimoni' ? actius : hist).filter(x => x.id === id)[0] || null,
      desa: (full, fila) => {
        const j = hist.findIndex(x => x.id === fila.id);
        if (j === -1) hist.push(fila); else hist[j] = fila;
        return fila;
      },
      actualitza: (full, id, canvis) => {
        const x = actius.filter(y => y.id === id)[0];
        if (x) Object.keys(canvis).forEach(k => { x[k] = canvis[k]; });
        return x || null;
      }
    },
    // La connexio esta llegint el compte nou: aixo es el que mana.
    FinancesBanc: { estat: () => ({ accounts: [{ uid: '02786e6a-89d4-4c1a-9f3e-000000000000', iban: '' }] }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props[k] === undefined ? null : props[k]),
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: (k) => { delete props[k]; }
    }) },
    ScriptApp: { getProjectTriggers: () => [] },
    Config: {}, Esquema: {}, Moduls: {}, IA: {}, Notifica: {}, Calendari: {},
    SpreadsheetApp: {}, CacheService: {}, Utilities: {}, Session: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), CalendarApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8'), ctx);

  const previsio = ctx.preparaFusio();
  cal('es queda el compte que la connexio esta llegint, no el de mes historic',
      previsio.indexOf('Es queda:  Banc  (auto_02786e6a-89d)') !== -1, previsio);
  cal('i ho diu, per que el tria', previsio.indexOf('el trio per la connexió') !== -1, previsio);

  ctx.fusionaAra();
  const viu = actius.filter(x => x.id === 'auto_02786e6a-89d')[0];
  const apartat = actius.filter(x => x.id === 'auto_6d32636a-4c5')[0];
  cal('el viu es queda sense arxivar', !viu.esborrat_el, 'l ha arxivat');
  cal("i el congelat s'aparta", !!apartat.esborrat_el, 'no l ha apartat');

  const seus = hist.filter(x => x.id_actiu === 'auto_02786e6a-89d')
                   .sort((a, b) => a.data.localeCompare(b.data));
  cal('el viu hereta la linia sencera', seus.length === 4, String(seus.length));
  cal("i el saldo d'avui segueix sent el bo",
      seus[seus.length - 1].valor === 4052.89, String(seus[seus.length - 1].valor));

  // I si m'equivoco, s'ha de poder desfer.
  ctx.desfesLaFusio();
  cal('desfer-ho torna a treure l arxivat',
      !actius.filter(x => x.id === 'auto_6d32636a-4c5')[0].esborrat_el, 'segueix arxivat');
  cal('i sense res a desfer, no fa res',
      /No tinc constància/.test(ctx.desfesLaFusio()), 'ha fet alguna cosa');
}

// ------------------------------------- i si no hi ha manera de saber quin es viu
console.log("");
console.log("Patrimoni: quan no se sap quin es el bo, es pregunta");
{
  const props = {};
  const actius = [
    { id: 'auto_a', nom: 'Banc', automatic: 'SI', iban: '', esborrat_el: '' },
    { id: 'auto_b', nom: 'Banc', automatic: 'SI', iban: '', esborrat_el: '' }
  ];
  const hist = [
    { id: 'x1', id_actiu: 'auto_a', data: '2026-08-01', valor: 4353.91 },
    { id: 'x2', id_actiu: 'auto_b', data: '2026-08-01', valor: 4052.89 }
  ];
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Logger: { log: () => {} }, Log: { info() {}, avis() {}, error() {} },
    Utils: { ara: () => '2026-08-02T12:00:00+02:00', avui: () => '2026-08-02',
             desJson: (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } } },
    Dades: {
      llegeix: (full, filtre) => {
        const files = full === 'Patrimoni' ? actius : hist;
        return typeof filtre === 'function' ? files.filter(filtre) : files.slice();
      },
      perId: (full, id) => (full === 'Patrimoni' ? actius : hist).filter(x => x.id === id)[0] || null,
      desa: () => null,
      actualitza: (full, id, canvis) => {
        const x = actius.filter(y => y.id === id)[0];
        if (x) Object.keys(canvis).forEach(k => { x[k] = canvis[k]; });
        return x || null;
      }
    },
    // Sense connexio que ho aclareixi.
    FinancesBanc: { estat: () => ({ accounts: [] }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props[k] === undefined ? null : props[k]),
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: (k) => { delete props[k]; }
    }) },
    ScriptApp: { getProjectTriggers: () => [] },
    Config: {}, Esquema: {}, Moduls: {}, IA: {}, Notifica: {}, Calendari: {},
    SpreadsheetApp: {}, CacheService: {}, Utilities: {}, Session: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), CalendarApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8'), ctx);

  const r = ctx.preparaFusio();
  cal('amb un empat i sense connexio, no proposa res',
      /NO ME N'ACABO DE FIAR/.test(r), r.slice(0, 80));
  cal('i ensenya els dos amb el seu numero', r.indexOf('4353.91') !== -1 && r.indexOf('4052.89') !== -1, r);
  cal('i no deixa res preparat per executar',
      /Primer executa preparaFusio/.test(ctx.fusionaAra()), 'ha deixat alguna cosa preparada');
  cal('i sobretot NO ha tocat res', !actius.filter(x => x.esborrat_el).length, 'ha arxivat alguna cosa');
}

// ------------------------- arreglar una fusio que es va equivocar de compte
console.log("");
console.log("Patrimoni: el compte bo arxivat per error es recupera sol");
{
  const props = {};
  // L'estat en que va quedar el full: el bo (4052,89) ARXIVAT i el congelat viu.
  const actius = [
    { id: 'auto_6d32636a-4c5', nom: 'Banc', automatic: 'SI', iban: '', esborrat_el: '' },
    { id: 'auto_02786e6a-89d', nom: 'Banc', automatic: 'SI', iban: '',
      esborrat_el: '2026-08-02T12:44:00+02:00' }
  ];
  const hist = [];
  ['2026-07-21','2026-07-25','2026-07-30','2026-08-01'].forEach((d, n) =>
    hist.push({ id: 'v' + n, id_actiu: 'auto_6d32636a-4c5', data: d, valor: 4353.91 }));
  hist.push({ id: 'vn', id_actiu: 'auto_02786e6a-89d', data: '2026-08-01', valor: 4052.89 });

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Logger: { log: () => {} }, Log: { info() {}, avis() {}, error() {} },
    Utils: { ara: () => '2026-08-02T13:00:00+02:00', avui: () => '2026-08-02',
             desJson: (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } } },
    Dades: {
      llegeix: (full, filtre) => {
        const files = full === 'Patrimoni' ? actius : hist;
        return typeof filtre === 'function' ? files.filter(filtre) : files.slice();
      },
      perId: (full, id) => (full === 'Patrimoni' ? actius : hist).filter(x => x.id === id)[0] || null,
      desa: (full, fila) => {
        const j = hist.findIndex(x => x.id === fila.id);
        if (j === -1) hist.push(fila); else hist[j] = fila;
        return fila;
      },
      actualitza: (full, id, canvis) => {
        const x = actius.filter(y => y.id === id)[0];
        if (x) Object.keys(canvis).forEach(k => { x[k] = canvis[k]; });
        return x || null;
      }
    },
    FinancesBanc: { estat: () => ({ accounts: [{ uid: '02786e6a-89d4-4c1a-9f3e-000000000000', iban: '' }] }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props[k] === undefined ? null : props[k]),
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: (k) => { delete props[k]; }
    }) },
    ScriptApp: { getProjectTriggers: () => [] },
    Config: {}, Esquema: {}, Moduls: {}, IA: {}, Notifica: {}, Calendari: {},
    SpreadsheetApp: {}, CacheService: {}, Utilities: {}, Session: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), CalendarApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8'), ctx);

  const previsio = ctx.preparaFusio();
  cal('veu el compte bo encara que estigui arxivat',
      previsio.indexOf('Es queda:  Banc  (auto_02786e6a-89d)') !== -1, previsio);

  ctx.fusionaAra();
  const bo = actius.filter(x => x.id === 'auto_02786e6a-89d')[0];
  const dolent = actius.filter(x => x.id === 'auto_6d32636a-4c5')[0];
  cal("el bo deixa d'estar arxivat", !bo.esborrat_el, 'segueix arxivat');
  cal('i el congelat passa a estar-ho', !!dolent.esborrat_el, 'no l ha apartat');

  const seus = hist.filter(x => x.id_actiu === 'auto_02786e6a-89d')
                   .sort((a, b) => a.data.localeCompare(b.data));
  cal('el bo es queda la linia sencera, del 21 de juliol a l 1 d agost',
      seus.map(x => x.data).join(' ') === '2026-07-21 2026-07-25 2026-07-30 2026-08-01',
      seus.map(x => x.data).join(' '));
  cal("i el saldo d'avui es el de debo, no el congelat",
      seus[seus.length - 1].valor === 4052.89, String(seus[seus.length - 1].valor));

  // I un cop arreglat, ja no ha de proposar res mes.
  cal('un cop arreglat, ja no en troba cap',
      /No trobo cap compte duplicat/.test(ctx.preparaFusio()), 'encara en troba');
}

// -------------------- parlar amb en JEFE no ha d'esborrar la fitxa que el fa rapid
console.log("");
console.log("La fitxa de la IA: nomes es llenca quan canvia alguna cosa que hi surt");
{
  const moduls = [
    { id: 'conversa', nom: 'JEFE',
      fulls: [{ nom: 'Converses' }] },                       // sense contextIA
    { id: 'habits', nom: 'Habits',
      fulls: [{ nom: 'Habits' }, { nom: 'Registres' }],
      contextIA: function () { return 'habits'; } },
    { id: 'calendari', nom: 'Calendari',
      fulls: [{ nom: 'Calendaris' }],
      contextIA: function () { return 'calendari'; } }
  ];

  let esborrades = 0;
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Log: { info() {}, avis() {}, error() {} },
    CacheService: { getScriptCache: () => ({
      get: () => null, getAll: () => ({}), put: () => {}, putAll: () => {},
      remove: () => { esborrades++; },
      removeAll: (ks) => { if (ks.length) esborrades++; } }) },
    Config: { full: () => ({ getSheetByName: () => null }) },
    Dades: null, Esquema: {}, IA: {}, Utils: { ara: () => 'ara', avui: () => '2026-08-02' },
    SpreadsheetApp: {}, PropertiesService: {}, ScriptApp: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), Session: {}, Utilities: {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/20_Moduls.gs', 'utf8'), ctx);
  // Els mòduls es descobreixen per `globalThis`: se n'hi posen tres de mentida.
  moduls.forEach(function (m) { ctx['MODUL_' + m.id.toUpperCase()] = function () { return m; }; });

  cal('el full de converses NO alimenta la fitxa',
      ctx.Moduls.alimentaContext('Converses') === false, 'diu que sí');
  cal('els registres d hàbits SÍ', ctx.Moduls.alimentaContext('Registres') === true, 'diu que no');
  cal('els calendaris SÍ', ctx.Moduls.alimentaContext('Calendaris') === true, 'diu que no');
  cal('els aparells de les notificacions NO',
      ctx.Moduls.alimentaContext('_Dispositius') === false, 'diu que sí');
  cal('el registre NO', ctx.Moduls.alimentaContext('_Registre') === false, 'diu que sí');
  cal('la configuració SÍ, que allà hi ha els objectius',
      ctx.Moduls.alimentaContext('_Config') === true, 'diu que no');
  cal('un full que no és de ningú, sí: davant del dubte, es torna a muntar',
      ctx.Moduls.alimentaContext('UnFullQueNoConec') === true, 'diu que no');

  // I ara el camí de debò: escriure passa per Dades.invalida.
  const dadesCtx = {
    Utils: { nouId: () => 'x', ara: () => 'ARA' },
    Config: { full: () => ({ getSheetByName: () => ({
      getDataRange: () => ({ getValues: () => [['id']] }),
      getRange: () => ({ setValues: () => {} }), getMaxRows: () => 10 }) }) },
    LockService: panyFals(), Moduls: ctx.Moduls
  };
  vm.createContext(dadesCtx);
  vm.runInContext(fs.readFileSync('apps-script/10_Dades.gs', 'utf8'), dadesCtx);

  esborrades = 0;
  dadesCtx.Dades.invalida('Converses');
  cal('escriure una conversa no llença la fitxa', esborrades === 0, String(esborrades));

  dadesCtx.Dades.invalida('_Dispositius');
  cal('obrir l app tampoc', esborrades === 0, String(esborrades));

  dadesCtx.Dades.invalida('Registres');
  cal('marcar un hàbit sí que la llença', esborrades === 1, String(esborrades));

  dadesCtx.Dades.invalida();
  cal('i sense dir quin full, també: no se sap què ha canviat', esborrades === 2, String(esborrades));
}

// --------------- la fitxa es munta per trossos: marcar un habit no toca finances
console.log("");
console.log("La fitxa de la IA: per trossos, no d'una peca");
{
  const muntats = [];
  const moduls = [
    { id: 'conversa', fulls: [{ nom: 'Converses' }] },
    { id: 'habits', fulls: [{ nom: 'Habits' }, { nom: 'Registres' }],
      contextIA: function () { muntats.push('habits'); return 'HABITS: en falten 3'; } },
    { id: 'finances', fulls: [{ nom: 'Moviments' }, { nom: 'Categories' }],
      contextIA: function () { muntats.push('finances'); return 'FINANCES: 400 EUR'; } },
    { id: 'calendari', fulls: [{ nom: 'Calendaris' }],
      contextIA: function () { muntats.push('calendari'); return 'CALENDARI: res'; } }
  ];

  const memoria = {};
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Log: { info() {}, avis() {}, error() {} },
    CacheService: { getScriptCache: () => ({
      get: (k) => (memoria[k] === undefined ? null : memoria[k]),
      getAll: (ks) => { const o = {}; ks.forEach(k => { if (memoria[k] !== undefined) o[k] = memoria[k]; }); return o; },
      put: (k, v) => { memoria[k] = v; },
      putAll: (o) => { Object.keys(o).forEach(k => { memoria[k] = o[k]; }); },
      remove: (k) => { delete memoria[k]; },
      removeAll: (ks) => { ks.forEach(k => { delete memoria[k]; }); }
    }) },
    Config: { full: () => ({ getSheetByName: () => null }) },
    Dades: null, Esquema: {}, IA: {}, Utils: { ara: () => 'ara', avui: () => '2026-08-02' },
    SpreadsheetApp: {}, PropertiesService: {}, ScriptApp: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), Session: {}, Utilities: {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/20_Moduls.gs', 'utf8'), ctx);
  moduls.forEach(function (m) { ctx['MODUL_' + m.id.toUpperCase()] = function () { return m; }; });

  const primera = ctx.Moduls.contextIA();
  cal('el primer cop els munta tots', muntats.sort().join(' ') === 'calendari finances habits',
      muntats.join(' '));
  cal('i la fitxa porta els tres', primera.indexOf('HABITS') !== -1 &&
      primera.indexOf('FINANCES') !== -1 && primera.indexOf('CALENDARI') !== -1, primera);

  muntats.length = 0;
  ctx.Moduls.contextIA();
  cal('el segon cop no en munta cap', muntats.length === 0, muntats.join(' '));

  // AIXO ES EL QUE IMPORTA: marcar un habit no ha de tornar a llegir finances.
  muntats.length = 0;
  ctx.Moduls.invalidaContext('Registres');
  const desprès = ctx.Moduls.contextIA();
  cal('marcar un habit nomes torna a muntar habits',
      muntats.join(' ') === 'habits', muntats.join(' ') || '(cap)');
  cal('i la fitxa segueix sencera', desprès.indexOf('FINANCES') !== -1 &&
      desprès.indexOf('CALENDARI') !== -1, desprès);

  // Una despesa nomes toca finances.
  muntats.length = 0;
  ctx.Moduls.invalidaContext('Moviments');
  ctx.Moduls.contextIA();
  cal('apuntar una despesa nomes torna a muntar finances',
      muntats.join(' ') === 'finances', muntats.join(' ') || '(cap)');

  // Un full de ningu no se sap que ha tocat: es tomben tots.
  muntats.length = 0;
  ctx.Moduls.invalidaContext('_Config');
  ctx.Moduls.contextIA();
  cal('un full que no es de cap modul els tomba tots',
      muntats.sort().join(' ') === 'calendari finances habits', muntats.join(' '));

  // I sense dir quin full, tambe.
  muntats.length = 0;
  ctx.Moduls.invalidaContext();
  ctx.Moduls.contextIA();
  cal('i sense dir res, tambe', muntats.length === 3, String(muntats.length));

  // El full de converses no ha de tombar res.
  muntats.length = 0;
  if (ctx.Moduls.alimentaContext('Converses')) ctx.Moduls.invalidaContext('Converses');
  ctx.Moduls.contextIA();
  cal('parlar segueix sense tombar res', muntats.length === 0, muntats.join(' '));
}

// ------------------- el que s'envia a Gemini: audio, eines i que no rumii per res
console.log("");
console.log("Transport a Gemini: la forma de la peticio");
{
  let enviat = null;
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp, encodeURIComponent,
    Log: { info() {}, avis() {}, error() {} },
    Config: {
      get: (k) => ({ model_bo: 'gemini-2.5-flash', model_barat: 'gemini-2.5-flash',
                     proveidor_ia: 'gemini', ia_activa: 'SI' })[k] || null,
      getNum: (k, d) => (k === 'pensa_tokens' ? 0 : d),
      esSi: () => true
    },
    Utils: { desJson: (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } },
             talla: (t, n) => String(t).slice(0, n), ara: () => 'ara', avui: () => '2026-08-02' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'clau-de-mentida' }) },
    UrlFetchApp: { fetch: (url, o) => {
      enviat = { url: url, cos: JSON.parse(o.payload), capcaleres: o.headers };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'fet' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, thoughtsTokenCount: 314 } }) };
    } },
    CacheService: { getScriptCache: () => null },
    SpreadsheetApp: {}, Session: {}, HtmlService: {}, LockService: panyFals(),
    Utilities: {}, ScriptApp: {}, Dades: {}, Moduls: {}, Esquema: {}
  };
  vm.createContext(ctx);
  ctx.PROP_CLAU_IA = 'CLAU_IA';
  vm.runInContext(fs.readFileSync('apps-script/50_IA.gs', 'utf8'), ctx);

  const r0 = ctx.IA.genera({
    sistema: 'ets en JEFE',
    missatges: [
      { rol: 'usuari', text: 'hola' },
      { role: 'user', parts: [{ text: 'aixo t ha dit de veu:' },
                              { inline_data: { mime_type: 'audio/wav', data: 'UklGRg==' } }] }
    ],
    eines: [{ nom: 'mostra_el_dia', descripcio: 'obre el dia',
              esquema: { type: 'object', properties: { data: { type: 'string' } } } }],
    model: 'bo', maxTokens: 1200, temperatura: 0
  });

  cal('la clau va a la capcalera i mai a l url',
      !!ctx.IA && enviat.capcaleres['x-goog-api-key'] === 'clau-de-mentida' &&
      enviat.url.indexOf('clau-de-mentida') === -1, enviat.url);

  cal('diu quant ha rumiat, amb la xifra de Google i no una suposada',
      r0.tokensPensats === 314, JSON.stringify(r0.tokensPensats));

  const parts = enviat.cos.contents[1].parts;
  cal("l'audio arriba tal qual, sense passar per cap transcripcio",
      parts[1].inline_data.mime_type === 'audio/wav' && parts[1].inline_data.data === 'UklGRg==',
      JSON.stringify(parts));
  cal('i el torn de text d abans hi segueix sent',
      enviat.cos.contents[0].parts[0].text === 'hola', JSON.stringify(enviat.cos.contents[0]));

  cal("amb l'audio hi van les EINES: les ordres d'accio han de seguir anant",
      enviat.cos.tools[0].functionDeclarations[0].name === 'mostra_el_dia',
      JSON.stringify(enviat.cos.tools));

  // AIXO ES EL QUE COSTAVA DEU SEGONS.
  cal('no se li deixa rumiar abans de contestar',
      enviat.cos.generationConfig.thinkingConfig.thinkingBudget === 0,
      JSON.stringify(enviat.cos.generationConfig));

  // I amb un model que no ho enten, aquest camp fa petar l'API: no s hi ha de posar.
  enviat = null;
  ctx.Config.get = (k) => ({ model_bo: 'gemini-1.5-pro', proveidor_ia: 'gemini', ia_activa: 'SI' })[k] || null;
  ctx.IA.genera({ sistema: 'x', missatges: [{ rol: 'usuari', text: 'hola' }], model: 'bo' });
  // I si el model es queixa, s'hi torna sense i se'n recorda.
  var intents = 0;
  ctx.UrlFetchApp.fetch = (url, o) => {
    intents++;
    enviat = { url: url, cos: JSON.parse(o.payload) };
    if (enviat.cos.generationConfig.thinkingConfig) {
      return { getResponseCode: () => 400,
               getContentText: () => JSON.stringify({ error: { message: 'invalid argument' } }) };
    }
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'fet' }] } }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }) };
  };
  ctx.Config.get = (k) => ({ model_bo: 'gemini-2.5-pro', proveidor_ia: 'gemini', ia_activa: 'SI' })[k] || null;
  var r2 = ctx.IA.genera({ sistema: 'x', missatges: [{ rol: 'usuari', text: 'hola' }], model: 'bo' });
  cal('si no accepta el zero, baixa al minim i respon igual',
      intents === 3 && r2.text === 'fet', intents + ' intents');
  cal('i si ni amb el minim, es deixa corrent',
      enviat.cos.generationConfig.thinkingConfig === undefined,
      JSON.stringify(enviat.cos.generationConfig));

  // EL CAS QUE IMPORTA: n'hi ha que accepten el minim encara que no el zero.
  // Abans queien directament a «rumia el que vulguis» i alla se n'anaven els
  // segons que preteniem estalviar.
  intents = 0;
  ctx.UrlFetchApp.fetch = (url, o) => {
    intents++;
    enviat = { url: url, cos: JSON.parse(o.payload) };
    var t = enviat.cos.generationConfig.thinkingConfig;
    if (t && t.thinkingBudget === 0) {
      return { getResponseCode: () => 400,
               getContentText: () => JSON.stringify({ error: { message: 'budget must be >= 128' } }) };
    }
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'fet' }] } }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }) };
  };
  ctx.Config.get = (k) => ({ model_bo: 'un-altre-model', proveidor_ia: 'gemini', ia_activa: 'SI' })[k] || null;
  ctx.IA.genera({ sistema: 'x', missatges: [{ rol: 'usuari', text: 'hola' }], model: 'bo' });
  cal('amb un que vol un minim, s hi queda i no el deixa lliure',
      intents === 2 && enviat.cos.generationConfig.thinkingConfig.thinkingBudget === 128,
      intents + ' intents · ' + JSON.stringify(enviat.cos.generationConfig.thinkingConfig));

  intents = 0;
  ctx.IA.genera({ sistema: 'x', missatges: [{ rol: 'usuari', text: 'i ara' }], model: 'bo' });
  cal('i la seguent ja va directa al minim',
      intents === 1 && enviat.cos.generationConfig.thinkingConfig.thinkingBudget === 128,
      intents + ' intents');

  // I la seguent pregunta al mateix model ja no ho torna a provar.
  intents = 0;
  ctx.IA.genera({ sistema: 'x', missatges: [{ rol: 'usuari', text: 'i ara' }], model: 'bo' });
  cal('i no ho torna a provar cada vegada', intents === 1, intents + ' intents');
}

// ------------------- una ordre dita de veu no ha de passar pel model
console.log("");
console.log("Veu: les ordres es reconeixen despres de transcriure, sense preguntar");
{
  const moduls = [
    { id: 'conversa', fulls: [{ nom: 'Converses' }],
      dreceres: [{ vista: 'dia', frases: ['pagina del dia', 'pagina d avui', 'full del dia'] }] },
    { id: 'habits', fulls: [{ nom: 'Habits' }], contextIA: function () { return 'habits'; } }
  ];
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp,
    Log: { info() {}, avis() {}, error() {} },
    CacheService: { getScriptCache: () => null },
    Config: { full: () => ({ getSheetByName: () => null }), zonaHoraria: () => 'Europe/Madrid' },
    Utilities: { formatDate: () => '2026-08-02' },
    Dades: { llegeix: () => [] }, Esquema: {}, IA: {},
    SpreadsheetApp: {}, PropertiesService: {}, ScriptApp: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), Session: {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('apps-script/20_Moduls.gs', 'utf8'), ctx);
  moduls.forEach(function (m) { ctx['MODUL_' + m.id.toUpperCase()] = function () { return m; }; });

  const d = (t) => { const r = ctx.Moduls.drecera(t); return r ? r.vista : null; };

  cal("amb accents i apostrof, com ho diu una persona",
      d("Ensenya'm la pàgina del dia") === 'dia', String(d("Ensenya'm la pàgina del dia")));
  cal('sense accents, igual', d('obre la pagina del dia') === 'dia', String(d('obre la pagina del dia')));
  cal('en majuscules, igual', d("ENSENYA LA PÀGINA D'AVUI") === 'dia',
      String(d("ENSENYA LA PÀGINA D'AVUI")));
  cal('amb signes pel mig, igual', d("va, ensenya-m'ho: la pàgina del dia!") === 'dia',
      String(d("va, ensenya-m'ho: la pàgina del dia!")));

  cal('una pregunta de debo NO es una ordre', d('quants cigarros he fumat avui') === null,
      String(d('quants cigarros he fumat avui')));
  cal('ni aquesta', d('com ha anat el dia') === null, String(d('com ha anat el dia')));
  cal('ni res buit', d('') === null && d(null) === null, 'diu que si');

  // La bessona del client ha de fer exactament el mateix.
  cal("l'aixafat treu accents, signes i espais de mes",
      ctx.Utils.aixafa("  Ensenya'm  la PÀGINA del dia!! ") === 'ensenya m la pagina del dia',
      ctx.Utils.aixafa("  Ensenya'm  la PÀGINA del dia!! "));
}

// ------------ una clau que no serveix no pot semblar que el banc no doni res
console.log("");
console.log("Banc: si no es pot signar, que ho digui i no acusi el banc");
{
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseInt, parseFloat,
    Log: { info() {}, avis() {}, error() {} },
    Utils: { avui: () => '2026-08-02', ara: () => 'ara', talla: (t, n) => String(t).slice(0, n),
             desJson: (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } },
             diesEntre: () => 30 },
    Config: { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, d) => d },
    Utilities: {
      base64EncodeWebSafe: () => 'x',
      newBlob: (t) => ({ getBytes: () => t }),
      formatDate: (d) => d.getFullYear() + '-01-01',
      // Aixo es exactament el que fa Apps Script amb una clau que no li serveix.
      computeRsaSha256Signature: () => { throw new Error('Invalid argument: key'); }
    },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => ({ FINANCES_BANC: JSON.stringify({ connected: true, accounts: [{ uid: 'u1' }] }),
                             EB_APP_ID: 'app', EB_PRIVATE_KEY: 'una-clau-que-no-serveix',
                             EB_REDIRECT: 'r' })[k] || null,
      setProperty: () => {} }) },
    UrlFetchApp: { fetch: () => { throw new Error('no hi hauria d hagut d arribar'); } },
    Dades: { llegeix: () => [], perId: () => null, insereix: () => null,
             actualitza: () => null, desa: () => null },
    Finances: { afegeix: (m) => m },
    FinancesRegles: { descripcio: () => 'x', categoria: () => '', metode: () => '' },
    SpreadsheetApp: {}, Session: {}, HtmlService: {}, LockService: panyFals(), ScriptApp: {},
    Moduls: { registra: () => {} }, Esquema: {}, IA: {}, Notifica: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('apps-script/42_Finances_Banc.gs', 'utf8'), ctx);

  const r = ctx.FinancesBanc.sincronitza();
  const err = (r.errors || []).join(' ');

  cal("l'error diu que es la clau, no un misteri d'Apps Script",
      /clau privada/.test(err) && /EB_PRIVATE_KEY/.test(err), err);
  cal('i diu on mirar-ho', /provaClauBanc/.test(err), err);
  cal("i no s'ha arribat a demanar res al banc", r.nous === 0, String(r.nous));
}

// ------- la clau del banc, tal com la deixa el quadre de propietats d'Apps Script
console.log("");
console.log("Banc: una clau desada en una sola linia s'ha de tornar a plegar");
{
  const crypto = await import('crypto');
  // Una clau RSA de debo, generada aqui: no n'hi ha cap de cap altre lloc.
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).trim();
  // I la mateixa, tal com queda quan la desa el quadre de propietats.
  const plana = pem.split(String.fromCharCode(10)).join('');

  const signaAmb = (clau) => {
    const c = crypto.createSign('RSA-SHA256');
    c.update('prova');
    return c.sign(clau);
  };

  function ambClau(valor) {
    const ctx = {
      Date, Math, JSON, String, Number, Object, Array, RegExp,
      Log: { info() {}, avis() {}, error() {} },
      Utils: { avui: () => '2026-08-02', ara: () => 'ara', talla: (t, n) => String(t).slice(0, n),
               desJson: (t, d) => d },
      Config: { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, d) => d },
      Utilities: {
        base64EncodeWebSafe: () => 'x',
        newBlob: (t) => ({ getBytes: () => t }),
        formatDate: () => '2026-08-02',
        computeRsaSha256Signature: (text, clau) => {
          try { return signaAmb(clau); }
          catch (e) { throw new Error('Invalid argument: key'); }
        }
      },
      CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
      PropertiesService: { getScriptProperties: () => ({
        getProperty: (k) => ({ EB_PRIVATE_KEY: valor, EB_APP_ID: 'app' })[k] || null,
        setProperty: () => {} }) },
      UrlFetchApp: {}, Dades: {}, Finances: {}, FinancesRegles: {},
      SpreadsheetApp: {}, Session: {}, HtmlService: {}, LockService: panyFals(), ScriptApp: {},
      Moduls: { registra: () => {} }, Esquema: {}, IA: {}, Notifica: {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
    ctx.Utils.avui = () => '2026-08-02';
    vm.runInContext(fs.readFileSync('apps-script/42_Finances_Banc.gs', 'utf8'), ctx);
    return ctx;
  }

  // Primer, que la premissa sigui certa i no una idea meva.
  let planaFalla = false;
  try { signaAmb(plana); } catch (e) { planaFalla = true; }
  cal('una clau en una sola linia NO serveix per signar', planaFalla, 'doncs si que serveix');

  const plegada = ambClau(plana).FinancesBanc.clauPem();

  // I la peca compartida directament, que la fa servir tambe el JWT de les
  // notificacions, on la clau ve d'un JSON amb els salts escrits.
  const ctxU = { RegExp, String, Array, Math, Date, Utilities: {}, Config: {} };
  vm.createContext(ctxU);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctxU);
  const ambBarres = pem.split(String.fromCharCode(10)).join(String.fromCharCode(92) + 'n');
  cal('una clau amb els salts ESCRITS tambe es desfa',
      ctxU.Utils.plegaPem(ambBarres) === pem, 'no coincideix');
  cal('i una que no es cap PEM es torna tal qual',
      ctxU.Utils.plegaPem('aixo no es una clau') === 'aixo no es una clau', 'l ha tocada');
  cal('i res, res', ctxU.Utils.plegaPem('') === '' && ctxU.Utils.plegaPem(null) === '', 'peta');
  cal('plegada, torna a tenir salts de linia', plegada.indexOf(String.fromCharCode(10)) !== -1, 'no en te');
  var ratlles = plegada.split(String.fromCharCode(10));
  cal('les ratlles del cos fan 64', ratlles[1].length === 64, String(ratlles[1].length));
  cal('i queda EXACTAMENT com el fitxer original', plegada === pem, 'no coincideix');

  let signa = false;
  try { signaAmb(plegada); signa = true; } catch (e) {}
  cal('i amb la plegada SI que es pot signar', signa, 'segueix sense poder');

  cal('una clau que ja ve amb salts es queda igual',
      ambClau(pem).FinancesBanc.clauPem() === pem, 'l ha tocada');
}

// --------- les pantalles desades: rapides, pero mai amb una dada vella
console.log("");
console.log("Memoria de pantalles: desar sense mentir");
{
  const memoria = {};
  const cau = {
    get: (k) => (memoria[k] === undefined ? null : memoria[k]),
    getAll: (ks) => { const o = {}; ks.forEach(k => { if (memoria[k] !== undefined) o[k] = memoria[k]; }); return o; },
    put: (k, v) => { memoria[k] = v; },
    putAll: (o) => { Object.keys(o).forEach(k => { memoria[k] = o[k]; }); },
    remove: (k) => { delete memoria[k]; },
    removeAll: (ks) => { ks.forEach(k => { delete memoria[k]; }); }
  };

  const moduls = [
    { id: 'tasques', fulls: [{ nom: 'Tasques' }] },
    { id: 'finances', fulls: [{ nom: 'Moviments' }, { nom: 'Categories' }] }
  ];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp,
    Log: { info() {}, avis() {}, error() {} },
    CacheService: { getScriptCache: () => cau },
    Config: { full: () => ({ getSheetByName: () => null }) },
    Utils: { avui: () => '2026-08-02', ara: () => 'ara' },
    Dades: null, Esquema: {}, IA: {}, SpreadsheetApp: {}, PropertiesService: {},
    ScriptApp: {}, HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), Session: {}, Utilities: {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/20_Moduls.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('apps-script/25_Memoria.gs', 'utf8'), ctx);
  moduls.forEach(function (m) { ctx['MODUL_' + m.id.toUpperCase()] = function () { return m; }; });

  let muntades = 0;
  const pantalla = (modul, nom, valor) =>
    ctx.Memoria.recorda(modul, nom, () => { muntades++; return { v: valor }; });

  // 1. La segona vegada no es torna a muntar.
  cal('la primera vegada la munta', pantalla('tasques', 'pantalla', 1).v === 1 && muntades === 1,
      String(muntades));
  muntades = 0;
  cal('la segona ja no', pantalla('tasques', 'pantalla', 1).v === 1 && muntades === 0,
      String(muntades));

  // 2. Dues pantalles diferents del mateix modul no es trepitgen.
  muntades = 0;
  const a = pantalla('finances', 'pantalla:mes:2026-08', 'agost');
  const b = pantalla('finances', 'pantalla:mes:2026-07', 'juliol');
  cal('cada pantalla te la seva clau', a.v === 'agost' && b.v === 'juliol' && muntades === 2,
      a.v + '/' + b.v + ' · ' + muntades);

  // 3. I ARA EL QUE IMPORTA: escriure ha de tombar el que sigui d'aquell modul.
  const dadesCtx = {
    Utils: { nouId: () => 'x', ara: () => 'ARA' },
    Config: { full: () => ({ getSheetByName: () => ({
      getDataRange: () => ({ getValues: () => [['id']] }),
      getRange: () => ({ setValues: () => {} }), getMaxRows: () => 10 }) }) },
    LockService: panyFals(), Moduls: ctx.Moduls, Memoria: ctx.Memoria
  };
  vm.createContext(dadesCtx);
  vm.runInContext(fs.readFileSync('apps-script/10_Dades.gs', 'utf8'), dadesCtx);

  muntades = 0;
  dadesCtx.Dades.invalida('Moviments');
  pantalla('finances', 'pantalla:mes:2026-08', 'agost NOU');
  cal('apuntar un moviment tomba la pantalla de finances', muntades === 1, String(muntades));
  cal('i la torna a muntar amb el que hi ha ara',
      pantalla('finances', 'pantalla:mes:2026-08', 'x').v === 'agost NOU', 'ensenya la vella');

  // 4. I no ha de tombar la del vei.
  muntades = 0;
  pantalla('tasques', 'pantalla', 'no importa');
  cal('i no toca la de tasques, que no ha canviat', muntades === 0, String(muntades));

  // 5. Un full de ningu no se sap que ha tocat: cauen totes.
  muntades = 0;
  dadesCtx.Dades.invalida('_Config');
  pantalla('tasques', 'pantalla', 'z');
  pantalla('finances', 'pantalla:mes:2026-08', 'z');
  cal('canviar la configuracio les tomba totes', muntades === 2, String(muntades));

  // 6. I sense dir quin full, tambe.
  muntades = 0;
  dadesCtx.Dades.invalida();
  pantalla('tasques', 'pantalla', 'w');
  cal('i sense dir res, tambe', muntades === 1, String(muntades));

  // 7. EL CALAIX COMU: el que suma tots els moduls cau amb qualsevol escriptura.
  muntades = 0;
  ctx.Memoria.recordaComu('inici', () => { muntades++; return { v: 1 }; });
  ctx.Memoria.recordaComu('inici', () => { muntades++; return { v: 1 }; });
  cal('el calaix comu tambe es desa', muntades === 1, String(muntades));

  muntades = 0;
  dadesCtx.Dades.invalida('Tasques');          // una escriptura d'un modul qualsevol
  ctx.Memoria.recordaComu('inici', () => { muntades++; return { v: 2 }; });
  cal("qualsevol escriptura tomba el comu, sigui d'on sigui", muntades === 1, String(muntades));

  // I no ha de durar mitja hora: hi ha el calendari a dins, que no surt de cap full.
  const abansPut = memoria['gen_nucli'];
  cal('el comu te el seu calaix a part', typeof abansPut === 'string', String(abansPut));

  // 8. Sense memoria cau, ha de seguir funcionant.
  ctx.CacheService.getScriptCache = () => { throw new Error('sense cau'); };
  muntades = 0;
  const r = pantalla('tasques', 'pantalla', 'sense cau');
  cal('sense memoria cau munta igual i no peta', r.v === 'sense cau' && muntades === 1,
      String(muntades));
}

// ----------- les targetes d'inici es desen, menys les del que no surt d'un full
console.log("");
console.log("Inici: cada targeta desada a casa seva, i el calendari mai");
{
  const memoria = {};
  const cau = {
    get: (k) => (memoria[k] === undefined ? null : memoria[k]),
    getAll: (ks) => { const o = {}; ks.forEach(k => { if (memoria[k] !== undefined) o[k] = memoria[k]; }); return o; },
    put: (k, v) => { memoria[k] = v; }, putAll: (o) => { Object.keys(o).forEach(k => { memoria[k] = o[k]; }); },
    remove: (k) => { delete memoria[k]; }, removeAll: (ks) => { ks.forEach(k => { delete memoria[k]; }); }
  };

  const comptador = { finances: 0, calendari: 0, tasques: 0 };
  const moduls = [
    { id: 'finances', nom: 'Finances', fulls: [{ nom: 'Moviments' }],
      resumInici: function () { comptador.finances++; return { etiqueta: 'Balanç', valor: '400 €' }; } },
    { id: 'tasques', nom: 'Tasques', fulls: [{ nom: 'Tasques' }],
      resumInici: function () { comptador.tasques++; return { etiqueta: 'Per fer', valor: 3 }; } },
    // El calendari NO surt del seu full: no s'ha de desar mai.
    { id: 'calendari', nom: 'Calendari', volatil: true, fulls: [{ nom: 'Calendaris' }],
      resumInici: function () { comptador.calendari++; return { etiqueta: 'El següent', valor: '17:00' }; } }
  ];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp,
    Log: { info() {}, avis() {}, error() {} },
    CacheService: { getScriptCache: () => cau },
    Config: { full: () => ({ getSheetByName: () => null }) },
    Utils: { avui: () => '2026-08-02', ara: () => 'ara' },
    Dades: { llegeix: () => [] }, Esquema: {}, IA: {},
    SpreadsheetApp: {}, PropertiesService: {}, ScriptApp: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), Session: {}, Utilities: {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/25_Memoria.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('apps-script/20_Moduls.gs', 'utf8'), ctx);
  moduls.forEach(function (m) { ctx['MODUL_' + m.id.toUpperCase()] = function () { return m; }; });

  const t1 = ctx.Moduls.resumInici();
  cal('la primera vegada les munta totes',
      comptador.finances === 1 && comptador.tasques === 1 && comptador.calendari === 1,
      JSON.stringify(comptador));
  cal('i surten totes tres', t1.length === 3, String(t1.length));
  cal('amb el mòdul a dins', t1[0].modul === 'finances', JSON.stringify(t1[0]));

  ctx.Moduls.resumInici();
  cal('la segona no torna a muntar les que surten del full',
      comptador.finances === 1 && comptador.tasques === 1, JSON.stringify(comptador));
  cal('PERO EL CALENDARI SI: el que ensenya no surt del seu full',
      comptador.calendari === 2, String(comptador.calendari));

  // I escriure a finances no ha de tocar la targeta de tasques.
  ctx.Memoria.oblida('finances');
  ctx.Moduls.resumInici();
  cal('escriure a finances només torna a muntar la de finances',
      comptador.finances === 2 && comptador.tasques === 1, JSON.stringify(comptador));
}


// ------------------------------- els rebuts fixos: Bonpreu fora, assegurança dins
/* EL CRITERI EL VA DIR ELL, I ÉS EL QUE ES PROVA AQUÍ:
   «a Bonpreu hi compro cada mes, però no la mateixa quantitat ni gasto, i no
   m'interessa marcar-lo com a cada mes... però del segur del cotxe cada mes
   igual i empresa la mateixa, aquest sí que m'interessa».

   O sigui que sortir cada mes NO és el criteri. Si algú relaxa els filtres,
   això peta abans que la pantalla se li ompli de supermercats. */
console.log('\nRebuts fixos: sortir cada mes no és ser un rebut');
{
  const font = fs.readFileSync('apps-script/40_Mod_Finances.gs', 'utf8');
  const srvFont = font.slice(font.indexOf('var Finances = (function ()'),
                             font.lastIndexOf('})();') + 5);

  const mesos = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
  const movs = [];
  let n = 0;
  const posa = (mes, dia, desc, imp, tipus) => {
    movs.push({ id: 'm' + (++n), data: mes + '-' + String(dia).padStart(2, '0'),
                tipus: tipus || 'd', import: imp, categoria: 'c_casa',
                descripcio: desc, metode: 'domic', origen: 'banc', revisat: 'SI' });
  };

  mesos.forEach((m, i) => {
    // L'ASSEGURANÇA: cada mes, mateixa empresa, mateix import.
    posa(m, 5, 'SEGUROS CATALANA OCC', 42.9);
    // EL SÚPER: cada mes, però tres cops i imports que no s'assemblen.
    posa(m, 3, 'BONPREU ESCLAT 4412', 18.4 + i * 3);
    posa(m, 12, 'BONPREU ESCLAT 4419', 62.15 - i * 2);
    posa(m, 24, 'BONPREU ESCLAT 4412', 91.3 + i);
    // LA NÒMINA: ingrés fix.
    posa(m, 28, 'NOMINA ESCOLA VEDRUNA', 1840, 'i');
    // EL GIMNÀS: fix però només tres mesos dels sis.
    if (i >= 3) posa(m, 8, 'GIMNAS VIC SL', 31);
  });
  // UN CÀRREC SOLT: una vegada i prou.
  posa('2026-05', 14, 'IKEA BADALONA', 249.9);
  // I una quota que puja un cèntim: segueix sent la mateixa quota.
  mesos.forEach((m, i) => posa(m, 18, 'SPOTIFY AB', 10.99 + i * 0.002));

  const ctx = {
    Utils: { avui: () => '2026-08-08', ara: () => '2026-08-08T10:00:00+02:00',
             talla: (s, x) => String(s).slice(0, x), esDataValida: () => true,
             nouId: (p) => p + (++n) },
    Dades: {
      llegeix: (full, filtre) => {
        const l = full === 'Moviments' ? movs : [];
        return l.filter((f) => !filtre || filtre(f));
      },
      un: () => null, perId: () => null,
      insereix: (full, fila, p) => Object.assign({ id: p + (++n) }, fila),
      actualitza: () => ({}), desa: (f, fila, c, p) => ({ id: p + (++n) })
    },
    Config: { get: () => '', getNum: (k, d) => d, esSi: () => false },
    Log: { info() {}, avis() {}, error() {} },
    Memoria: { recorda: (a, b, fer) => fer(), oblida() {} },
    Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array, RegExp
  };
  vm.createContext(ctx);
  vm.runInContext(srvFont, ctx);

  const c = ctx.Finances.candidatsRecurrents('2026-08-08');
  const noms = c.propostes.map((p) => p.descripcio);

  cal('l\'assegurança del cotxe es proposa',
      noms.some((x) => /CATALANA/.test(x)), noms.join(' | '));
  cal('i la nòmina també, que és un ingrés fix',
      noms.some((x) => /NOMINA/.test(x)), noms.join(' | '));
  cal('i una quota que puja dos cèntims segueix sent la mateixa quota',
      noms.some((x) => /SPOTIFY/.test(x)), noms.join(' | '));

  cal('BONPREU NO es proposa, encara que hi compri cada mes',
      !noms.some((x) => /BONPREU/.test(x)), noms.join(' | '));
  cal('ni el gimnàs, que només surt a tres dels sis mesos',
      !noms.some((x) => /GIMNAS/.test(x)), noms.join(' | '));
  cal('ni un càrrec que ha passat una vegada',
      !noms.some((x) => /IKEA/.test(x)), noms.join(' | '));

  /* I els dos filtres han de fer fora Bonpreu CADASCUN PEL SEU COMPTE: si un
     dia es relaxa l'altre, ha de seguir quedant fora. */
  const bonpreu = c.tots.filter((g) => /BONPREU/.test(g.descripcio))[0];
  cal('Bonpreu queda fora per import que balla', bonpreu && bonpreu.variacio > 0.12,
      bonpreu && String(bonpreu.variacio));
  cal('i també per nombre de càrrecs al mes', bonpreu && bonpreu.perMes > 1.5,
      bonpreu && String(bonpreu.perMes));

  /* L'import proposat és la mediana, no la mitjana: un mes rar no ha de moure
     una quota que no s'ha mogut mai. */
  const asseg = c.propostes.filter((p) => /CATALANA/.test(p.descripcio))[0];
  cal('la proposta porta l\'import de debò i el dia del mes',
      asseg.import === 42.9 && asseg.dia === 5, JSON.stringify(asseg));
  cal('i diu de quants mesos surt, que és el que et fa dir que sí',
      asseg.mesos === 6 && asseg.mesosMirats === 6, JSON.stringify(asseg));

  /* El mes en curs NO entra: està a mitges i un rebut que encara no ha
     arribat comptaria com un mes fallat. */
  posa('2026-08', 5, 'SEGUROS CATALANA OCC', 42.9);
  const c2 = ctx.Finances.candidatsRecurrents('2026-08-08');
  const a2 = c2.propostes.filter((p) => /CATALANA/.test(p.descripcio))[0];
  cal('el mes en curs no compta: la finestra són els sis mesos tancats',
      a2.mesos === 6, String(a2.mesos));

  /* NO ES PROPOSA EL QUE JA S'HA CONTESTAT. Tornar a preguntar el que ja has
     dit que no és la manera més segura que deixis de mirar-t'ho. */
  const jaVistos = [{ id: 'r1', clau: 'd|SEGUROS CATALANA OCC', descripcio: 'Cotxe' },
                    { id: 'r2', clau: 'i|NOMINA ESCOLA VEDRUNA', descartat_el: '2026-07-01T10:00:00' }];
  ctx.Dades.llegeix = (full, filtre) => {
    const l = full === 'Moviments' ? movs : full === 'Recurrents' ? jaVistos : [];
    return l.filter((f) => !filtre || filtre(f));
  };
  const c3 = ctx.Finances.candidatsRecurrents('2026-08-08');
  const n3 = c3.propostes.map((p) => p.descripcio);
  cal('el que ja és recurrent no es torna a proposar',
      !n3.some((x) => /CATALANA/.test(x)), n3.join(' | '));
  cal('i el que vas dir que no, tampoc',
      !n3.some((x) => /NOMINA/.test(x)), n3.join(' | '));
  cal('ni surten a la llista de triar, que ja estan decidits',
      !c3.tots.some((g) => /CATALANA|NOMINA/.test(g.descripcio)),
      c3.tots.map((g) => g.descripcio).join(' | '));

  /* ══════════════════════════════════════════════════════════════════════
     I EL QUE ARRIBA DEL BANC NO S'APUNTA DUES VEGADES

     El recurrent es va inventar quan no hi havia banc: escriure'l era l'única
     manera que el rebut existís. Amb el banc connectat, el càrrec arriba sol,
     i generar-ne un de sintètic vol dir pagar el segur del cotxe dos cops al
     full. El comentari del trigger ja deia que el veuries «com un possible
     duplicat»; ara senzillament no hi és.
     ══════════════════════════════════════════════════════════════════════ */
  {
    const delMes = [{ id: 'x1', data: '2026-08-05', tipus: 'd', import: 42.9,
                      categoria: 'c_cotx', descripcio: 'SEGUROS CATALANA OCC',
                      metode: 'domic', origen: 'banc', revisat: 'SI' }];
    const recs = [{ id: 'r1', tipus: 'd', import: 42.9, categoria: 'c_cotx',
                    descripcio: 'Assegurança', metode: 'domic', dia: 5, actiu: 'SI',
                    clau: 'd|SEGUROS CATALANA OCC', ultim_mes: '' },
                  { id: 'r2', tipus: 'd', import: 620, categoria: 'c_casa',
                    descripcio: 'Lloguer', metode: 'transf', dia: 1, actiu: 'SI',
                    clau: 'd|IMMOBILIARIA VIC', ultim_mes: '' }];
    let escrits = [], marcats = [];
    ctx.Dades.llegeix = (full, filtre) => {
      const l = full === 'Moviments' ? delMes : full === 'Recurrents' ? recs : [];
      return l.filter((f) => !filtre || filtre(f));
    };
    ctx.Dades.insereix = (full, fila, p) => {
      if (full === 'Moviments') escrits.push(fila.descripcio);
      return Object.assign({ id: p + (++n) }, fila);
    };
    ctx.Dades.actualitza = (full, id, canvis) => {
      if (full === 'Recurrents' && canvis.ultim_mes) marcats.push(id);
      return {};
    };
    ctx.Finances.generaRecurrents('2026-08-08');

    cal('el rebut que el banc ja ha portat NO es torna a apuntar',
        !escrits.some((x) => /Assegurança/.test(x)), escrits.join(' | '));
    cal('però es dona per fet, per no tornar-hi cada nit',
        marcats.indexOf('r1') !== -1, marcats.join(' | '));
    cal('i el que NO ha arribat sí que s\'apunta: aquesta és la seva feina',
        escrits.some((x) => /Lloguer/.test(x)), escrits.join(' | '));

    /* ══════════════════════════════════════════════════════════════════════
       I AMB EL BANC CONNECTAT, RES DE RES

       En Pol va acceptar sis rebuts i de seguida va veure despeses duplicades.
       El cas evident ja estava tapat —no crear-lo si ja havia arribat— i el
       que quedava viu era el que fa més mal: si encara NO ha arribat, se
       n'inventava un. I això és pitjor que duplicar, perquè el vigilant
       després el troba, dona el rebut per arribat i no avisa que falta: la
       mateixa línia que embruta el balanç apaga l'avís que l'hauria de
       descobrir.
       ══════════════════════════════════════════════════════════════════════ */
    escrits = []; marcats = [];
    ctx.FinancesBanc = { disponible: () => true };
    ctx.Finances.generaRecurrents('2026-08-08');
    cal('amb el banc connectat no s\'inventa CAP moviment, ni el que falta',
        escrits.length === 0, escrits.join(' | '));

    ctx.FinancesBanc = { disponible: () => false };
    escrits = [];
    ctx.Finances.generaRecurrents('2026-08-08');
    cal('i sense banc segueix fent la seva feina de sempre',
        escrits.some((x) => /Lloguer/.test(x)), escrits.join(' | '));
  }
}

// ------------------------- qui cobra, i no com se'n diu aquest mes
/* «En depèn del nom? No es podria mirar d'alguna manera més fiable com el
   compte bancari procedent? Moltes vegades el concepte varia... número de mes o
   alguna cosa així.»

   Tenia raó i el forat era real: la clau sortia del text que es MOSTRA, i la
   normalització treia els números llargs —l'any— però no els curts, o sigui que
   el mes es quedava dins. «RECIBO SEGUROS 08 2026» i «RECIBO SEGUROS 09 2026»
   eren dos comerços diferents. El banc ja enviava el compte de qui cobra i no
   el guardàvem. */
console.log('\nQui cobra: el compte del banc mana sobre el text');
{
  const regles = fs.readFileSync('apps-script/43_Finances_Regles.gs', 'utf8');
  const ctx = { Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array, RegExp };
  vm.createContext(ctx);
  vm.runInContext(regles, ctx);
  const R = ctx.FinancesRegles;

  /* L'esglaó bo: el compte de qui cobra. El concepte canvia cada mes i la
     identitat no es mou. */
  const ago = { creditor: { name: 'SEGUROS CATALANA OCC' },
                creditor_account: { identification: 'ES91 2100 0418 4502 0005 1332',
                                    scheme_name: 'IBAN' },
                remittance_information: ['RECIBO SEGUROS 08 2026'] };
  const set = { creditor: { name: 'SEGUROS CATALANA' },
                creditor_account: { identification: 'ES9121000418450200051332' },
                remittance_information: ['RECIBO SEGUROS 09 2026'] };
  cal('el mateix rebut de dos mesos dona la mateixa identitat',
      R.contrapart(ago, false).valor === R.contrapart(set, false).valor,
      R.contrapart(ago, false).valor + ' vs ' + R.contrapart(set, false).valor);
  cal('i els espais de l\'IBAN no en fan dos de diferents',
      R.contrapart(ago, false).valor === 'ib|ES9121000418450200051332',
      R.contrapart(ago, false).valor);
  cal('i es diu d\'on surt, per saber si aquest banc el dona',
      R.contrapart(ago, false).font === 'compte');

  /* Un ingrés mira qui PAGA. Al revés agafaria el teu propi compte, que és el
     mateix per a tot i ho ajuntaria tot en un sol grup. */
  const nomina = { debtor: { name: 'ESCOLA VEDRUNA' },
                   debtor_account: { identification: 'ES7620770024003102575766' },
                   creditor_account: { identification: 'ES0000000000000000000000' } };
  cal('d\'un ingrés s\'agafa qui paga, no el teu compte',
      R.contrapart(nomina, true).valor === 'ib|ES7620770024003102575766',
      R.contrapart(nomina, true).valor);

  /* Segon esglaó: sense compte, el nom. I el nom es neteja de números i mesos,
     que és justament el que embrutava la clau de text. */
  const senseCompte = { creditor: { name: 'RECIBO SEGUROS 08 2026' } };
  const senseCompte2 = { creditor: { name: 'RECIBO SEGUROS 09/2026' } };
  cal('sense compte s\'agafa el nom, i el mes no hi entra',
      R.contrapart(senseCompte, false).valor === R.contrapart(senseCompte2, false).valor &&
      R.contrapart(senseCompte, false).font === 'nom',
      R.contrapart(senseCompte, false).valor + ' vs ' + R.contrapart(senseCompte2, false).valor);
  cal('i els noms de mes escrits també cauen',
      R.clauNom('QUOTA AGOST') === R.clauNom('QUOTA SETEMBRE'),
      R.clauNom('QUOTA AGOST') + ' vs ' + R.clauNom('QUOTA SETEMBRE'));

  /* Tercer esglaó: si el banc no envia res, es diu, i qui ho faci servir ja
     sap que ha de tirar del text de sempre. */
  cal('si el banc no envia ni compte ni nom, es diu',
      R.contrapart({}, false).valor === '' && R.contrapart({}, false).font === 'cap');

  /* I el banc ha de DESAR-HO en importar: si no es desa aquí, no torna mai. */
  const banc = fs.readFileSync('apps-script/42_Finances_Banc.gs', 'utf8');
  cal('el que entra del banc es queda amb qui hi ha a l\'altre costat',
      /contrapart: qui\.valor/.test(banc) &&
      /FinancesRegles\.contrapart\(b, t\.esIngres\)/.test(banc));

  /* L'IDENTIFICADOR HA DE SER UN DE SOL. El reompliment retroba les files pel
     mateix identificador amb què la sincronització va decidir que no eren
     noves. Si n'hi hagués dues còpies i se separessin, el reompliment no
     trobaria res i diria que ho ha fet tot sense haver tocat cap fila. */
  cal('la fórmula de l\'identificador del banc viu en un sol lloc',
      (banc.match(/entry_reference \|\| b\.transaction_id/g) || []).length === 1,
      String((banc.match(/entry_reference \|\| b\.transaction_id/g) || []).length));
  cal('i la fan servir totes dues: la sincronització i el reompliment',
      (banc.match(/llegeixTransaccio_\(b, compte\.uid\)/g) || []).length === 2);

  /* Reomplir no pot crear ni esborrar res: només omple una columna buida. */
  const omple = banc.slice(banc.indexOf('function omplequiCobra('),
                           banc.indexOf('function sincronitza()'));
  cal('reomplir només toca la columna buida, no en crea cap de nova',
      /return \{ contrapart: trobats\[actual\.id\] \};/.test(omple) &&
      !/insereix/.test(omple), omple.slice(0, 80));
  cal('i salta les files que ja la tenen', /if \(String\(f\.contrapart \|\| ''\)\) return;/.test(omple));

  /* QUANTS DIES ENRERE DEIXA MIRAR EL BANC NO HO SAP NINGÚ.
     Es van demanar cent vuitanta i va contestar «WRONG_TRANSACTIONS_PERIOD».
     No és que la sessió fos morta: és que aquell període no el deixa, i cada
     banc en té un de diferent que no diu enlloc. */
  cal('si el període no val, es prova un de més curt en comptes de rendir-se',
      /\[90, 60, 30, 10\]/.test(omple) && /finestra === null/.test(omple));
  cal('i quan un funciona, es desa per no tornar-ho a endevinar',
      /e\.finestraDies = finestra;/.test(omple));
  /* Baixar el període només arregla un problema DE PERÍODE. Si el banc falla
     per una altra cosa —la sessió caducada— provar finestres més curtes és
     gastar mirades per acabar igual, i el que cal és tornar a connectar. */
  cal('però si la fallada no és del període, no s\'hi insisteix',
      /if \(!\/WRONG_TRANSACTIONS_PERIOD\|period\/i\.test\(falla\)\) break;/.test(omple));
  cal('i llavors es diu que el que toca és reconnectar el banc',
      /connectaBanc\(\)/.test(fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8')));
  cal('la sincronització de cada dia també respecta el que el banc accepta',
      /Math\.min\(90, maxim\)/.test(banc));
}

// --------------------- i que els vells i els nous segueixin sent el mateix rebut
/* El canvi no pot trencar el que ja hi ha. Un recurrent creat abans només té
   clau de text; un moviment que arribi demà en tindrà dues. S'han de trobar. */
console.log('\nEls rebuts d\'abans i els d\'ara segueixen sent els mateixos');
{
  const font = fs.readFileSync('apps-script/40_Mod_Finances.gs', 'utf8');
  const srvFont = font.slice(font.indexOf('var Finances = (function ()'),
                             font.lastIndexOf('})();') + 5);
  let n = 0;
  const munta = (movs, recs, avui) => {
    const ctx = {
      Utils: { avui: () => avui, ara: () => avui + 'T10:00:00',
               talla: (s, x) => String(s).slice(0, x), esDataValida: () => true,
               nouId: (p) => p + (++n) },
      Dades: { llegeix: (full, filtre) => (full === 'Moviments' ? movs
                        : full === 'Recurrents' ? recs : []).filter((f) => !filtre || filtre(f)),
               un: () => null, perId: () => null,
               insereix: (f, fila, p) => Object.assign({ id: p + (++n) }, fila),
               actualitza: () => ({}), desa: (f, fila, c, p) => ({ id: p + (++n) }) },
      Config: { get: () => '', getNum: (k, d) => d, esSi: () => false },
      Log: { info() {}, avis() {}, error() {} },
      Memoria: { recorda: (a, b, fer) => fer(), oblida() {} },
      Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array, RegExp
    };
    vm.createContext(ctx);
    /* Les regles de debò: la clau dura surt d'aquí, i sense elles la prova
       comprovaria un camí que a l'app no s'executa mai. */
    vm.runInContext(fs.readFileSync('apps-script/43_Finances_Regles.gs', 'utf8'), ctx);
    vm.runInContext(srvFont, ctx);
    return ctx.Finances;
  };

  const IBAN = 'ib|ES9121000418450200051332';

  /* Un recurrent creat ABANS del canvi: només clau de text. El moviment que
     arriba ara porta contrapart i un concepte amb el mes nou. */
  const vell = [{ id: 'r1', tipus: 'd', import: 42.9, categoria: 'c_cotx',
                  descripcio: 'Assegurança', metode: 'domic', dia: 5, actiu: 'SI',
                  clau: 'd|RECIBO SEGUROS', contrapart: '', ultim_mes: '' }];
  const nou = [{ id: 'm1', data: '2026-08-05', tipus: 'd', import: 42.9,
                 categoria: 'c_cotx', descripcio: 'RECIBO SEGUROS',
                 metode: 'domic', origen: 'banc', contrapart: IBAN, revisat: 'SI' }];
  const v = munta(nou, vell, '2026-08-22').vigilancia();
  cal('un recurrent vell troba el moviment nou pel text de sempre',
      v.falten.length === 0 && v.canviats.length === 0, JSON.stringify(v.falten));

  /* I al revés: un recurrent creat des d'una proposta forta troba el moviment
     encara que el concepte hagi canviat de mes. */
  const modern = [{ id: 'r1', tipus: 'd', import: 42.9, categoria: 'c_cotx',
                    descripcio: 'Assegurança', metode: 'domic', dia: 5, actiu: 'SI',
                    clau: IBAN, contrapart: IBAN, ultim_mes: '' }];
  const altreText = [{ id: 'm1', data: '2026-08-05', tipus: 'd', import: 42.9,
                       categoria: 'c_cotx', descripcio: 'CARREC SEGUROS 08 2026',
                       metode: 'domic', origen: 'banc', contrapart: IBAN, revisat: 'SI' }];
  const v2 = munta(altreText, modern, '2026-08-22').vigilancia();
  cal('i un de creat pel compte el troba encara que el concepte hagi canviat',
      v2.falten.length === 0, JSON.stringify(v2.falten));

  /* Sense la contrapart, aquest segon cas fallaria: és la prova que el compte
     és el que ho està aguantant i no una casualitat del text. */
  const senseContrapart = [{ id: 'm1', data: '2026-08-05', tipus: 'd', import: 42.9,
                             categoria: 'c_cotx', descripcio: 'CARREC SEGUROS 08 2026',
                             metode: 'domic', origen: 'banc', contrapart: '', revisat: 'SI' }];
  const v3 = munta(senseContrapart, modern, '2026-08-22').vigilancia();
  cal('i sense el compte, aquell mateix cas es perdria: per això es desa',
      v3.falten.length === 1, JSON.stringify(v3.falten));

  /* L'agrupació ha de LLIGAR els mesos vells (només text) amb els nous (amb
     compte). Si no, el mateix segur surt dues vegades i no arriba als tres
     mesos seguits per cap dels dos camins. */
  const barreja = [];
  ['2026-02', '2026-03', '2026-04'].forEach((m, i) => {
    barreja.push({ id: 'a' + i, data: m + '-05', tipus: 'd', import: 42.9,
                   categoria: 'c_cotx', descripcio: 'RECIBO SEGUROS',
                   metode: 'domic', origen: 'banc', contrapart: '', revisat: 'SI' });
  });
  ['2026-05', '2026-06', '2026-07'].forEach((m, i) => {
    barreja.push({ id: 'b' + i, data: m + '-05', tipus: 'd', import: 42.9,
                   categoria: 'c_cotx', descripcio: 'RECIBO SEGUROS',
                   metode: 'domic', origen: 'banc', contrapart: IBAN, revisat: 'SI' });
  });
  const c = munta(barreja, [], '2026-08-08').candidatsRecurrents('2026-08-08');
  cal('els mesos d\'abans i els d\'ara fan UN sol grup, no dos',
      c.tots.length === 1 && c.tots[0].mesos === 6,
      JSON.stringify(c.tots.map((g) => [g.descripcio, g.mesos])));
  cal('i el grup es queda amb la identitat forta',
      c.tots[0].clau === IBAN && c.tots[0].font === 'compte',
      c.tots[0].clau + ' · ' + c.tots[0].font);
  cal('i per tant es proposa, que abans no hauria arribat als sis mesos',
      c.propostes.length === 1, String(c.propostes.length));

  /* I EL CAS DELS 234: el banc no diu ni compte ni nom —són compres amb
     targeta— i el concepte porta el mes a dins. Amb la clau de sempre feien
     un grup per mes i no arribaven mai a proposta. */
  const nomesText = [];
  ['02', '03', '04', '05', '06', '07'].forEach((m, i) => {
    nomesText.push({ id: 't' + i, data: '2026-' + m + '-18', tipus: 'd', import: 10.99,
                     categoria: 'c_oci', descripcio: 'RECIBO SPOTIFY ' + m + '/2026',
                     metode: 'targeta', origen: 'banc', contrapart: '', revisat: 'SI' });
  });
  const ct = munta(nomesText, [], '2026-08-08').candidatsRecurrents('2026-08-08');
  cal('sense res del banc, el mes dins del concepte ja no parteix el grup',
      ct.tots.length === 1 && ct.tots[0].mesos === 6,
      JSON.stringify(ct.tots.map((g) => [g.descripcio, g.mesos])));
  cal('i es proposa igualment, encara que vagi pel text',
      ct.propostes.length === 1 && ct.propostes[0].font === 'text' &&
      ct.propostes[0].fiable === false,
      JSON.stringify(ct.propostes.map((g) => [g.font, g.fiable])));

  /* ══════════════════════════════════════════════════════════════════════
     ELS FALSOS POSITIUS QUE VAN SORTIR AMB LES DADES DE DEBÒ

     La primera versió va proposar, entre altres, «DEVOLUCIO COMPRA» i el nom
     d'ell mateix dues vegades. Totes dues passaven els filtres: eren regulars
     i de l'import semblant. El que fallava no era el filtre d'import, era que
     allò no és un comerç.
     ══════════════════════════════════════════════════════════════════════ */
  const sis = ['02', '03', '04', '05', '06', '07'];
  const fes = (desc, cat) => sis.map((m, i) => ({
    id: desc + i, data: '2026-' + m + '-10', tipus: 'd', import: 30,
    categoria: cat || 'c_casa', descripcio: desc, metode: 'targeta',
    origen: 'banc', contrapart: '', revisat: 'SI' }));

  const ambDevolucions = munta(fes('DEVOLUCIO COMPRA'), [], '2026-08-08')
    .candidatsRecurrents('2026-08-08');
  cal('una devolució no es proposa mai: no és cap comerç',
      ambDevolucions.propostes.length === 0 && ambDevolucions.tots.length === 0,
      JSON.stringify(ambDevolucions.tots.map((g) => g.descripcio)));

  /* I un traspàs entre els seus comptes tampoc. Ho diu el full de categories
     amb `exclou`, que és la llista que l'app ja fa servir per no comptar-los
     com a despesa: aquí és exactament la mateixa. */
  const ctxCat = munta([], [], '2026-08-08');
  const ambTraspas = (function () {
    const movs = fes('Pol del Pozo Murgou', 'c_trasp');
    const ctx2 = { Categories: [{ id: 'c_trasp', nom: 'Traspàs', mena: 'd', exclou: 'SI' }] };
    return { movs: movs, cats: ctx2.Categories };
  })();
  const F2 = (function () {
    const ctx = {
      Utils: { avui: () => '2026-08-08', ara: () => 'x', talla: (s, x) => String(s).slice(0, x),
               esDataValida: () => true, nouId: (p) => p },
      Dades: { llegeix: (full, filtre) => (full === 'Moviments' ? ambTraspas.movs
                        : full === 'Categories' ? ambTraspas.cats : [])
                        .filter((f) => !filtre || filtre(f)),
               un: () => null, perId: () => null, insereix: (f, x, p) => ({ id: p }),
               actualitza: () => ({}), desa: () => ({ id: 'x' }) },
      Config: { get: () => '', getNum: (k, d) => d, esSi: () => false },
      Log: { info() {}, avis() {}, error() {} },
      Memoria: { recorda: (a, b, fer) => fer(), oblida() {} },
      Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array, RegExp
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync('apps-script/43_Finances_Regles.gs', 'utf8'), ctx);
    vm.runInContext(srvFont, ctx);
    return ctx.Finances;
  })();
  cal('un traspàs entre els teus comptes tampoc: ja és fora dels comptes',
      F2.candidatsRecurrents('2026-08-08').tots.length === 0,
      JSON.stringify(F2.candidatsRecurrents('2026-08-08').tots.map((g) => g.descripcio)));

  /* I el nom que s'ensenya: si cada mes porta un número de factura diferent,
     cap no es repeteix i triar-ne un és ensenyar-li el d'un mes com si fos el
     nom de la cosa. */
  const ambFactura = munta(sis.map((m, i) => ({
    id: 'f' + i, data: '2026-' + m + '-10', tipus: 'i', import: 1840,
    categoria: 'i_nomi', descripcio: 'Sueldo/Salar000229' + i + '/2026' + m + 'Factura',
    metode: 'transf', origen: 'banc', contrapart: '', revisat: 'SI' })), [], '2026-08-08')
    .candidatsRecurrents('2026-08-08');
  cal('quan cada mes porta un número diferent, s\'ensenya el que tenen en comú',
      ambFactura.tots.length === 1 && !/\d/.test(ambFactura.tots[0].descripcio),
      JSON.stringify(ambFactura.tots.map((g) => g.descripcio)));

  /* ══════════════════════════════════════════════════════════════════════
     LA FINESTRA ÉS EL QUE HI HA, NO EL QUE VOLDRIA

     Amb les dades reals no es va proposar ni un, i no era per cap filtre: el
     seu banc deixa consultar noranta dies, o sigui tres mesos d'història. Es
     demanaven cinc mesos de sis i era demanar l'impossible.
     ══════════════════════════════════════════════════════════════════════ */
  const tresMesos = ['05', '06', '07'].map((m, i) => ({
    id: 'x' + i, data: '2026-' + m + '-05', tipus: 'd', import: 42.9,
    categoria: 'c_cotx', descripcio: 'SEGUROS CATALANA OCC', metode: 'domic',
    origen: 'banc', contrapart: IBAN, revisat: 'SI' }));
  const c3 = munta(tresMesos, [], '2026-08-08').candidatsRecurrents('2026-08-08');
  cal('amb tres mesos d\'història, sortir als tres és sortir sempre',
      c3.propostes.length === 1 && c3.tots[0].mesosMirats === 3,
      JSON.stringify(c3.tots.map((g) => [g.mesos, g.mesosMirats])));

  /* I UNA NÒMINA BALLA. Amb el llindar de les compres quedava fora, i una
     nòmina que varia per l'IRPF segueix sent una nòmina. El que la separa del
     súper no és l'import: és que el banc diu qui la paga. */
  const nomines = ['05', '06', '07'].map((m, i) => ({
    id: 'n' + i, data: '2026-' + m + '-28', tipus: 'i', import: [1840, 2100, 1790][i],
    categoria: 'i_nomi', descripcio: 'NOMINA', metode: 'transf',
    origen: 'banc', contrapart: 'ib|ES7620770024003102575766', revisat: 'SI' }));
  const cn = munta(nomines, [], '2026-08-08').candidatsRecurrents('2026-08-08');
  cal('una nòmina que balla es proposa igualment: el banc diu qui la paga',
      cn.propostes.length === 1, JSON.stringify(cn.tots.map((g) => [g.variacio, g.fiable])));
  cal('i queda marcada com a variable, que és el que canvia què se\'n vigila',
      cn.propostes[0].variable === true, JSON.stringify(cn.propostes[0].variacio));

  /* I d'un que balla per definició no s'avisa que ha canviat de preu: seria
     avisar-lo cada mes de la cosa que ja sap. Que no ha arribat, sí. */
  const recVar = [{ id: 'r1', tipus: 'i', import: 1840, categoria: 'i_nomi',
                    descripcio: 'Nòmina', metode: 'transf', dia: 28, actiu: 'SI',
                    clau: 'ib|ES76', contrapart: 'ib|ES76', variable: 'SI', ultim_mes: '' }];
  const arribada = [{ id: 'm1', data: '2026-08-28', tipus: 'i', import: 2400,
                      categoria: 'i_nomi', descripcio: 'NOMINA', metode: 'transf',
                      origen: 'banc', contrapart: 'ib|ES76', revisat: 'SI' }];
  const vv = munta(arribada, recVar, '2026-08-31').vigilancia();
  cal('d\'un import variable no s\'avisa que ha canviat de preu',
      vv.canviats.length === 0, JSON.stringify(vv.canviats));
  const vf = munta([], recVar, '2026-08-31').vigilancia();
  cal('però si no arriba, sí que es diu', vf.falten.length === 1,
      JSON.stringify(vf.falten));

  /* Però una benzinera amb el mateix ball NO, perquè va pel text. És el mateix
     número i decideix diferent segons qui hi hagi a l'altra banda. */
  const benzina = ['05', '06', '07'].map((m, i) => ({
    id: 'b' + i, data: '2026-' + m + '-14', tipus: 'd', import: [40, 62, 35][i],
    categoria: 'c_cotx', descripcio: 'ESCLATOIL VIC', metode: 'targeta',
    origen: 'banc', contrapart: '', revisat: 'SI' }));
  const cb = munta(benzina, [], '2026-08-08').candidatsRecurrents('2026-08-08');
  cal('i la benzinera amb el mateix ball no, perquè va pel text',
      cb.propostes.length === 0 && /balla/.test(cb.tots[0].perQueNo),
      JSON.stringify(cb.tots.map((g) => [g.variacio, g.fiable, g.perQueNo])));
}

// ------------------- el vigilant: el que NO ha passat i el que ha passat diferent
/* «Si el banc ja el porta, de què serveix aquest apartat?» La pregunta era bona
   i la resposta honesta era: de res. Els moviments són el que ha passat; una
   expectativa és l'únic que pot trobar a faltar alguna cosa. Això prova les
   dues coses que ho justifiquen —i que no cridi quan no toca, que és el que fa
   que d'aquí a tres setmanes encara te'ls miris. */
console.log('\nEls rebuts fixos vigilen: què falta i què ha pujat');
{
  const font = fs.readFileSync('apps-script/40_Mod_Finances.gs', 'utf8');
  const srvFont = font.slice(font.indexOf('var Finances = (function ()'),
                             font.lastIndexOf('})();') + 5);
  let n = 0;

  const munta = (movs, recs, avui) => {
    const ctx = {
      Utils: { avui: () => avui, ara: () => avui + 'T10:00:00', talla: (s, x) => String(s).slice(0, x),
               esDataValida: () => true, nouId: (p) => p + (++n) },
      Dades: {
        llegeix: (full, filtre) => {
          const l = full === 'Moviments' ? movs : full === 'Recurrents' ? recs
                  : full === 'Categories' ? [] : [];
          return l.filter((f) => !filtre || filtre(f));
        },
        un: () => null, perId: () => null,
        insereix: (f, fila, p) => Object.assign({ id: p + (++n) }, fila),
        actualitza: () => ({}), desa: (f, fila, c, p) => ({ id: p + (++n) })
      },
      Config: { get: () => '', getNum: (k, d) => d, esSi: () => false },
      Log: { info() {}, avis() {}, error() {} },
      Memoria: { recorda: (a, b, fer) => fer(), oblida() {} },
      Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array, RegExp
    };
    vm.createContext(ctx);
    vm.runInContext(srvFont, ctx);
    return ctx.Finances;
  };

  const rec = (id, desc, imp, dia, clau, tipus) =>
    ({ id, tipus: tipus || 'd', import: imp, categoria: 'c_casa', descripcio: desc,
       metode: 'domic', dia, actiu: 'SI', clau, ultim_mes: '' });
  const mov = (data, desc, imp, tipus) =>
    ({ id: 'm' + (++n), data, tipus: tipus || 'd', import: imp, categoria: 'c_casa',
       descripcio: desc, metode: 'domic', origen: 'banc', revisat: 'SI' });

  const recs = [
    rec('r1', 'Assegurança del cotxe', 42.9, 5, 'd|SEGUROS CATALANA OCC'),
    rec('r2', 'Lloguer', 620, 1, 'd|IMMOBILIARIA VIC'),
    rec('r3', 'Spotify', 10.99, 18, 'd|SPOTIFY AB'),
    rec('r4', 'Nòmina', 1840, 28, 'i|NOMINA ESCOLA VEDRUNA', 'i')
  ];

  /* Dia 20 del mes: el lloguer i l'assegurança havien d'haver arribat; el
     Spotify fa dos dies i encara té cortesia; la nòmina encara no toca. */
  const movs = [
    mov('2026-08-01', 'IMMOBILIARIA VIC', 620),          // ha arribat igual
    mov('2026-08-05', 'SEGUROS CATALANA OCC', 51.2)      // ha arribat MÉS CAR
    // Spotify: no hi és
  ];

  const F = munta(movs, recs, '2026-08-20');
  const v = F.vigilancia();

  cal('el terra del mes és la suma del que surt cada mes',
      v.compromes === 673.89, String(v.compromes));
  cal('i el que entra de fix va a part, no es resta',
      v.esperat === 1840, String(v.esperat));

  const falten = v.falten.map((f) => f.descripcio);
  cal('el Spotify falta: el dia 18 més tres de cortesia ja han passat el 20... encara no',
      falten.indexOf('Spotify') === -1, falten.join(' | '));

  /* El 22 sí: dia 18 + 3 de cortesia = 21, i el 22 ja és tard. */
  const v2 = munta(movs, recs, '2026-08-22').vigilancia();
  cal('i el 22 sí que es dona per no arribat',
      v2.falten.map((f) => f.descripcio).indexOf('Spotify') !== -1,
      v2.falten.map((f) => f.descripcio).join(' | '));
  cal('els tres dies de cortesia són el que evita cridar el dia clavat',
      F.VIGILA.marge === 3);

  cal('la nòmina no es reclama: encara no li toca',
      v2.falten.map((f) => f.descripcio).indexOf('Nòmina') === -1,
      v2.falten.map((f) => f.descripcio).join(' | '));
  cal('i el lloguer, que ha arribat igual, no diu res',
      !v2.falten.concat(v2.canviats).some((x) => /Lloguer/.test(x.descripcio)));

  const c = v2.canviats[0];
  cal('l\'assegurança que passa de 42,90 a 51,20 es detecta',
      c && /Assegurança/.test(c.descripcio), JSON.stringify(v2.canviats));
  cal('i es diu quant ha pujat en tant per cent, que és el que et fa reaccionar',
      c.abans === 42.9 && c.ara === 51.2 && c.percentatge === 19, JSON.stringify(c));

  /* Un cèntim no és una pujada de preu. Ha de ser gros en relatiu I en
     absolut: un 5 % de tres euros tampoc no ho és. */
  const petit = munta([mov('2026-08-01', 'IMMOBILIARIA VIC', 620.4)],
                      [rec('r2', 'Lloguer', 620, 1, 'd|IMMOBILIARIA VIC')], '2026-08-22');
  cal('quaranta cèntims en sis-cents euros no són un canvi de preu',
      petit.vigilancia().canviats.length === 0);

  /* I el que arriba al telèfon: només els esdeveniments, no els estats. */
  const s = munta(movs, recs, '2026-08-22').senyals();
  const ids = s.map((x) => x.id);
  cal('els senyals són el que falta i el que ha pujat, i res més', s.length === 2,
      ids.join(' | '));
  cal('i cadascun porta el mes a dins, per no repetir-se cada dia',
      ids.every((x) => /2026-08$/.test(x)), ids.join(' | '));
  cal('el que falta ho diu amb el retard i l\'import',
      s.some((x) => /no ha arribat/i.test(x.titol) && /10,99 €/.test(x.text)),
      JSON.stringify(s.map((x) => x.titol)));
  cal('i la pujada diu els dos preus',
      s.some((x) => /ha pujat/.test(x.titol) && /42,9 €/.test(x.text) && /51,2 €/.test(x.text)),
      JSON.stringify(s.map((x) => x.text)));

  /* Un mes en què tot ha anat bé no ha de dir absolutament res. */
  const tot = munta([mov('2026-08-01', 'IMMOBILIARIA VIC', 620)],
                    [rec('r2', 'Lloguer', 620, 1, 'd|IMMOBILIARIA VIC')], '2026-08-22');
  cal('un mes sense res a dir no diu res', tot.senyals().length === 0);
}

// -------------------------------- la pantalla de rebuts fixos: proposar i triar
console.log('\nRebuts fixos: la pantalla proposa, tria i sap dir que no');
{
  const v = fs.readFileSync('apps-script/vista_finances.html', 'utf8');

  cal('les propostes es pinten amb el perquè, no només amb el nom',
      /' de ' \+ g\.mesosMirats \+ ' mesos · '/.test(v) && /function propostes\(d\)/.test(v));
  /* I si l'import va variant, es diu ABANS d'acceptar-lo: acceptar «sempre
     1840 €» una nòmina que no és mai dos mesos igual seria mentir-li. */
  cal('i si l\'import va variant, la proposta ho diu', /va variant/.test(v));
  cal('cada proposta té les dues sortides: confirmar-la i dir-hi que no',
      /data-prop=/.test(v) && /data-fora=/.test(v));
  cal('i dir que no passa pel servidor, que és qui se\'n recorda',
      /escriu\('finances', 'descarta'/.test(v));

  cal('«Afegeix-ne un» obre la llista dels teus moviments',
      /data-tria-rec/.test(v) && /function obreTriador\(tots\)/.test(v));
  cal('i encara es pot escriure a mà', /data-a-ma/.test(v));

  /* El formulari s'ha d'obrir a mitges: tot omplert però creant, no editant.
     Si es mirés «hi ha objecte?» en comptes de «té identificador?», una
     proposta acceptada intentaria actualitzar un recurrent que no existeix. */
  cal('una proposta obre el formulari com a NOU, no com a edició',
      /var editant = !!\(r && r\.id\);/.test(v));
  cal('i el que crea porta qui el cobra, per no duplicar-lo després',
      /clau: r && r\.clau \? r\.clau : null/.test(v));
}

// ------------------------------------------ on va cada notificació en tocar-la
/* Quatre de les nou notificacions obrien una pàgina 404, i cap prova ho veia:
   totes passaven, perquè el destí era una cadena i ningú comprovava que fos
   una pantalla de debò. Això ho mira, i mira TOTES les que hi hagi al codi:
   una de nova que s'equivoqui igual, es trobarà aquesta prova al davant. */
console.log('\nNotificacions: totes han de portar a una pantalla que existeixi');
{
  const src = fs.readFileSync('apps-script/60_Notificacions.gs', 'utf8');
  const cos = src.slice(src.indexOf('function capOn_(url) {'), src.indexOf('function envia(titol'));
  const ctx = { String };
  vm.createContext(ctx);
  vm.runInContext(cos + '\nvar __c = capOn_;', ctx);
  const capOn = ctx.__c;

  cal('un nom de pantalla a seques es converteix en hash',
      capOn('seguiment') === './#seguiment', capOn('seguiment'));
  cal('el que ja estava bé no es toca',
      capOn('./#finances') === './#finances', capOn('./#finances'));
  cal('l\'arrel es queda com l\'arrel',
      capOn('./') === './' && capOn('') === './');

  /* I que `envia` la FACI SERVIR. Sense això, la prova de dalt passava amb la
     normalització desconnectada: comprovava una funció que no cridava ningú.
     Ho he vist perquè he tornat a trencar-ho a posta per veure si saltava. */
  cal('i que envia() la faci servir a la notificació i a l\'enllaç',
      /url:\s*capOn_\(/.test(src) && /link:\s*capOn_\(/.test(src));

  /* Les pantalles que existeixen de debò, llegides d'on es registren. */
  const vistes = new Set();
  fs.readdirSync('apps-script').filter((f) => f.startsWith('vista_')).forEach((f) => {
    const t = fs.readFileSync('apps-script/' + f, 'utf8');
    const m = t.match(/App\.registraVista\(\s*'([a-z0-9_]+)'/g) || [];
    m.forEach((x) => vistes.add(x.match(/'([a-z0-9_]+)'/)[1]));
  });
  cal('es troben les pantalles registrades', vistes.has('finances') && !vistes.has('inici'), [...vistes].join(', '));

  /* Cada `url:` que surti al costat d'un `Notifica.envia`. */
  const destins = [];
  fs.readdirSync('apps-script').filter((f) => f.endsWith('.gs')).forEach((f) => {
    const t = fs.readFileSync('apps-script/' + f, 'utf8');
    let i = 0;
    while ((i = t.indexOf('Notifica.envia(', i)) !== -1) {
      const tros = t.slice(i, i + 500);
      const m = tros.match(/url:\s*'([^']*)'/);
      if (m) destins.push({ on: f, url: m[1] });
      i += 15;
    }
  });
  cal('es troben les notificacions del codi', destins.length >= 3, destins.length + ' trobades');

  const dolents = destins.filter((d) => {
    /* El destí pot portar una data: «./#dia:2026-08-07». Es talla pels dos
       punts, igual que fa `App.deLAdreca` al navegador. Aquesta prova va
       saltar el dia que el repàs de la nit va estrenar aquesta forma, i
       tenia raó a preguntar-ho. */
    const v = capOn(d.url).replace('./#', '').replace('./', '').split(':')[0];
    return v && !vistes.has(v);
  });
  cal('cap notificació porta a una pantalla que no existeix',
      dolents.length === 0, dolents.map((d) => d.on + ' → ' + d.url).join(' · '));

  /* I CAP NO POT ANAR SENSE ETIQUETA. Les que no en porten arriben totes amb
     la mateixa —«jefe»—, i al telèfon una etiqueta repetida no vol dir dues
     notificacions: vol dir que la segona tapa la primera. Els senyals hi anaven
     així, i com que en surten dos al dia, la meitat no s'arribaven a veure. */
  const senseEtiqueta = [];
  let mirades = 0;
  fs.readdirSync('apps-script').filter((f) => f.endsWith('.gs')).forEach((f) => {
    const t = fs.readFileSync('apps-script/' + f, 'utf8');
    let i = 0;
    while ((i = t.indexOf('Notifica.envia(', i)) !== -1) {
      mirades++;
      const tros = t.slice(i, i + 700);
      if (!/etiqueta:/.test(tros)) senseEtiqueta.push(f + ':' + t.slice(0, i).split('\n').length);
      i += 15;
    }
  });
  cal('es miren totes les notificacions del codi', mirades >= 4, mirades + ' mirades');
  cal('cada notificació porta la seva etiqueta', senseEtiqueta.length === 0,
      senseEtiqueta.join(' · '));


  /* EL TÍTOL NO POT DIR EL MATEIX QUE EL COS. Amb una sola cita al calendari
     sortia «Montgrony 7:00-15:00» de títol i «Montgrony 7:00-15:00» de cos:
     una notificació que es repeteix a si mateixa no diu res dues vegades, no
     diu res una. La regla és que el títol digui d'on ve i el cos què passa. */
  const junta = (function () {
    const c2 = { String, RegExp };
    vm.createContext(c2);
    vm.runInContext(src.slice(src.indexOf('function junta_'), src.indexOf('function capOn_')) +
                    '\nvar __j = junta_;', c2);
    return c2.__j;
  })();

  cal('el que deia el títol s\'enganxa al cos amb un punt',
      junta('Control setmanal', 'Ara, en dejú') === 'Control setmanal. Ara, en dejú',
      junta('Control setmanal', 'Ara, en dejú'));
  cal('i sense doble puntuació quan ja n\'hi ha',
      junta('Bon dia, Pol!', '09:00 Claustre') === 'Bon dia, Pol! 09:00 Claustre',
      junta('Bon dia, Pol!', '09:00 Claustre'));

  /* Els títols escrits al codi han de ser curts. Un títol de sis paraules és
     una frase, i una frase al títol vol dir que el cos la repetirà.

     EL PUNT VOLAT NO ÉS UNA PARAULA. La forma és «Apartat · què» —«Diari ·
     resum», «Finances · patrimoni»— i comptar el separador com a paraula
     deixava el pressupost real en dues. Es treu abans de comptar. */
  const titols = [];
  fs.readdirSync('apps-script').filter((f) => f.endsWith('.gs')).forEach((f) => {
    const t = fs.readFileSync('apps-script/' + f, 'utf8');
    let i = 0;
    while ((i = t.indexOf('Notifica.envia(', i)) !== -1) {
      const m = t.slice(i, i + 220).match(/Notifica\.envia\(\s*'([^']+)'/);
      if (m) titols.push({ on: f, titol: m[1] });
      i += 15;
    }
  });
  cal('es troben els títols escrits al codi', titols.length >= 3, titols.length + ' trobats');
  const paraules = (t) => t.split(/\s+/).filter((p) => p && p !== '·').length;
  const llargs = titols.filter((t) => paraules(t.titol) > 3);
  cal('cap títol és una frase', llargs.length === 0,
      llargs.map((t) => t.on + ': «' + t.titol + '»').join(' · '));

  /* I CAP NO POT SER UNA COSA QUE PASSA. Els títols han de dir d'on ve la
     notificació, i el que es va escapar era just al revés: «Resum del dia»,
     «Revisió setmanal», «Banc», «Demà». Es comprova que cadascun comenci per
     un apartat de debò —el nom d'un mòdul o d'una pantalla de l'app. */
  const APARTATS = ['Calendari', 'Diari', 'Finances', 'Hàbits', 'Nutrició',
                    'Tasques', 'Focus', 'Relacions', 'Memòria', 'Seguiment', 'El dia',
                    'La setmana', 'Prova'];
  const forasters = titols.filter((t) =>
    !APARTATS.some((a) => t.titol === a || t.titol.indexOf(a + ' · ') === 0));
  cal('cada títol comença per l\'apartat d\'on ve', forasters.length === 0,
      forasters.map((t) => t.on + ': «' + t.titol + '»').join(' · '));

  /* I la còpia del treballador de servei ha de dir el mateix: és la que mana
     quan la notificació ja és al telèfon i l'app està tancada. */
  const sw = fs.readFileSync('firebase-messaging-sw.js', 'utf8');
  const bloc = sw.slice(sw.indexOf("self.addEventListener('notificationclick'"),
                        sw.indexOf('// Que una versió nova'));
  const arrel = 'https://exemple.test/jefe/';
  /* El treballador contesta amb una promesa —`matchAll` ho és— i la primera
     versió d'aquesta prova llegia el resultat abans que hi fos. Fallava la
     prova, no el codi. `waitUntil` és per on el treballador diu «encara no he
     acabat»: aquí s'agafa i s'espera, que és el que fa el navegador. */
  const obre = async (url, jaOberta) => {
    let obertes = [], navegat = null, missatges = [], guardat = null;
    const finestra = { url: arrel, focus: () => finestra,
                       navigate: (u) => { navegat = u; return Promise.resolve(finestra); },
                       postMessage: (m) => missatges.push(m) };
    const c = { String, Promise,
      self: { registration: { scope: arrel },
              clients: { matchAll: () => Promise.resolve(jaOberta ? [finestra] : []),
                         openWindow: (u) => { obertes.push(u); return Promise.resolve(); } },
              addEventListener: (n, f) => { c.__f = f; } } };
    c.self.self = c.self;
    vm.createContext(c);
    vm.runInContext(bloc, c);
    c.__f({ notification: { close: () => {}, data: { url } },
            waitUntil: (pr) => { guardat = pr; } });
    await guardat;
    return { obertes, navegat, missatges };
  };

  const tancada = await obre('seguiment', false);
  cal('el treballador obre l\'adreça sencera, no la relativa',
      tancada.obertes[0] === arrel + '#seguiment', tancada.obertes[0]);

  const oberta = await obre('seguiment', true);
  cal('i amb l\'app ja oberta hi navega en comptes de deixar-te on eres',
      oberta.navegat === arrel + '#seguiment', oberta.navegat);
  cal('i a més li ho diu per missatge, que és instantani',
      (oberta.missatges[0] || {}).vista === 'seguiment', JSON.stringify(oberta.missatges));
}


// ------- la precàrrega ha de desar amb la clau que cada pantalla llegirà
/* El 4 d'agost del 2026 es va trobar que el calendari DESAVA a
   «calendari.2026-08» i LLEGIA de «calendari.ara»: no coincidien mai, la còpia
   del telèfon hi era i no la feia servir ningú, i per això obrir el calendari
   sempre esperava el servidor. Un error d'una paraula que no es veu mirant el
   codi —les dues línies són a quatre-centes línies l'una de l'altra— i que es
   veu de seguida si es comparen.
   Això compara la taula de claus de la precàrrega amb la clau que cada vista
   fa servir de debò. Si algú en canvia una i s'oblida de l'altra, peta aquí. */
console.log('\nLa precàrrega desa on cada pantalla mirarà');
{
  const app = fs.readFileSync('apps-script/ui_app.html', 'utf8');
  const tros = app.slice(app.indexOf('    clauDe: function (modul, avui) {'),
                         app.indexOf('    omple: function () {'));
  const c2 = { String };
  vm.createContext(c2);
  vm.runInContext('var P = { ' + tros.replace(/,\s*$/, '') + ' };', c2);

  /* A JEFE això mirava set pantalles; aquí n'hi ha una. La clau que desa la
     precàrrega ha de ser la que la vista de finances llegeix en obrir-se:
     el període per defecte («mes») i el mes en curs («ara»). */
  const vf = fs.readFileSync('apps-script/vista_finances.html', 'utf8');
  cal('la vista de finances llegeix finances.<període>.<mes o «ara»>',
      /function claded\(\) \{ return 'finances\.' \+ periode \+ '\.' \+ \(mes \|\| 'ara'\); \}/.test(vf));
  cal('la clau de finances és la que espera la seva vista',
      c2.P.clauDe('finances', '2026-08-04') === 'finances.mes.ara',
      c2.P.clauDe('finances', '2026-08-04'));

  const enc = fs.readFileSync('apps-script/30_Encaminador.gs', 'utf8');
  cal('i un mòdul que peti no s\'emporta la resta del paquet',
      /try \{ out\[mod\.id\] = mod\.accions\.pantalla\(\{\}\); \}/.test(enc));
}

// ------ cap automatisme pot quedar-se fora de la llista que els neteja
/* `instalaTriggers` esborra els seus i els torna a crear. Els «seus» són els
   d'una llista escrita a mà, i el 4 d'agost del 2026 hi faltava
   `triggerEscalfaFora`: cada execució en deixava un de vell i en creava un de
   nou. Amb dos, i costant quaranta segons per passada, es menjaven més quota
   diària de la que té el compte —i quan la quota s'acaba, Google atura TOTS
   els automatismes sense avisar de res.
   Un descuit d'una línia amb aquestes conseqüències no es pot deixar a la
   memòria de ningú. */
console.log('\nEls automatismes: cap pot quedar fora de la llista que els neteja');
{
  const inst = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');

  const creats = (inst.match(/newTrigger\('(\w+)'\)/g) || [])
    .map((x) => x.replace(/newTrigger\('|'\)/g, ''));
  const llista = (inst.slice(inst.indexOf('var TRIGGERS = ['),
                             inst.indexOf('];', inst.indexOf('var TRIGGERS = [')))
    .match(/'(\w+)'/g) || []).map((x) => x.replace(/'/g, ''));

  cal('hi són els cinc de finances', ['triggerManteniment', 'triggerEscalfa', 'triggerSenyals', 'triggerBanc', 'triggerPatrimoni'].every((t) => creats.indexOf(t) !== -1), String(creats.length));
  const fora = creats.filter((t) => llista.indexOf(t) === -1);
  cal('i tots surten a la llista que els esborra',
      fora.length === 0, 'en falten: ' + fora.join(', '));

  /* I a l'inrevés: un nom a la llista que ja no es crea enlloc no fa mal, però
     vol dir que hi ha codi mort o un nom mal escrit. */
  const morts = llista.filter((t) => creats.indexOf(t) === -1);
  cal('i a la llista no hi ha noms que ja no existeixin',
      morts.length === 0, 'sobren: ' + morts.join(', '));
}

// -------------------------------- els senyals: la part difícil és NO dir-los
/* JEFE avisava per rellotge. Els senyals avisen pel que passa. La feina no és
   trobar coses a dir —n'hi ha sempre—: és callar-ne prou perquè les que surtin
   es llegeixin. Si això falla, en tres setmanes silencia l'app i llavors ja no
   s'assabenta de res.
   Aquí es comproven les quatre regles que ho sostenen: dos al dia, tres dies
   abans de repetir-ne un, res de nit, i que tot quedi apuntat encara que no
   s'enviï. */
console.log('\nEls senyals: dos al dia, i el que es calla també s\'apunta');
{
  const ctx = carregaTotElServidor();
  const AVUI = '2026-08-05';
  ctx.Utils.avui = () => AVUI;
  ctx.Utils.ara = () => AVUI + 'T10:00:00+02:00';
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Config = { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, d) => d };

  /* El formatador ha de formatar DE DEBÒ. La primera versió d'aquesta prova el
     falsejava tornant sempre el mateix dia, i això trencava `Utils.sumaDies`:
     la regla dels tres dies no es podia complir mai i la prova acusava el codi
     d'una cosa que feia ella. */
  let horaAra = 10;
  ctx.Utilities.formatDate = (d, tz, f) => {
    if (f === 'H') return String(horaAra);
    const p = (n) => ('0' + n).slice(-2);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  // El full, en memòria
  let files = [], seguit = 0;
  ctx.Dades = {
    llegeix: (full, filtre) => files.filter((f) => !filtre || filtre(f)),
    un: (full, q) => files.filter((f) => Object.keys(q).every((k) => f[k] === q[k]))[0] || null,
    insereix: (full, fila, prefix) => {
      const f = Object.assign({ id: (prefix || 'x') + (++seguit) }, fila);
      files.push(f); return f;
    },
    actualitza: (full, id, canvis) => {
      const f = files.filter((x) => x.id === id)[0];
      if (f) Object.assign(f, canvis);
      return f || null;
    }
  };

  let enviades = [];
  /* `junta` no es dobla: és la que decideix com queda el cos que arriba al
     telèfon, i doblar-la voldria dir comprovar una altra cosa. */
  ctx.Notifica = {
    junta: (a, b) => (!a ? b : !b ? a : a + (/[.!?:;·…]$/.test(a) ? ' ' : '. ') + b),
    envia: (t, c, o) => { enviades.push({ t, c, url: o && o.url, etiqueta: o && o.etiqueta }); return { enviades: 1 }; }
  };

  const senyal = (id, urgencia) => ({ id, titol: 'T', text: 'passa una cosa', urgencia });
  let elsMeus = [senyal('a', 3), senyal('b', 2), senyal('c', 1)];
  ctx.Moduls = { actius: () => [{ id: 'prova', nom: 'Prova', senyals: () => elsMeus }] };

  const r1 = ctx.Senyals.passa({});
  cal('en troba tres i n\'envia dos', r1.trobats === 3 && r1.enviats === 2, JSON.stringify(r1));
  cal('i envia els MÉS urgents, no els primers que troba',
      enviades.length === 2 && r1.quins.join(',') === 'a,b', JSON.stringify(r1.quins));

  /* EL TÍTOL DEL SENYAL NO ÉS EL DE LA NOTIFICACIÓ. A la barra hi has de
     llegir d'on et parlen; què passa ja ho diu el cos, i el títol del senyal
     l'encapçala perquè no es perdi. */
  cal('el títol de la notificació és l\'apartat, no el del senyal',
      enviades[0].t === 'Prova', JSON.stringify(enviades[0]));
  cal('i el que deia el senyal encapçala el cos',
      enviades[0].c === 'T. passa una cosa', enviades[0].c);

  /* Sense etiqueta pròpia totes arribaven com a «jefe», i al telèfon això no
     vol dir dues notificacions: vol dir que la segona tapa la primera. */
  cal('cada senyal porta la seva etiqueta, i no la comparteix',
      enviades[0].etiqueta === 'senyal-a' && enviades[1].etiqueta === 'senyal-b',
      JSON.stringify(enviades.map((e) => e.etiqueta)));

  cal('el que s\'ha callat també queda apuntat',
      files.length === 3 && files.filter((f) => !f.enviat_el).length === 1,
      JSON.stringify(files.map((f) => f.senyal + ':' + (f.enviat_el ? 'dit' : 'callat'))));

  enviades = [];
  const r2 = ctx.Senyals.passa({});
  cal('a la segona passada del mateix dia ja no diu res més',
      r2.enviats === 0 && /ja s'han dit/.test(r2.motiu), JSON.stringify(r2));

  /* L'endemà: els mateixos senyals segueixen passant. Les dues que es van dir
     han de callar —fa menys de tres dies—, però la que es va quedar a la cua
     ha de sortir. El pressupost APLAÇA, no llença: si llencés, la tercera cosa
     important d'un dia ple no s'assabentaria mai. */
  ctx.Utils.avui = () => '2026-08-06';
  ctx.Utils.ara = () => '2026-08-06T10:00:00+02:00';
  enviades = [];
  const r3 = ctx.Senyals.passa({});
  cal('l\'endemà no repeteix les que va dir, però sí que treu la que esperava',
      r3.enviats === 1 && r3.quins[0] === 'c', JSON.stringify(r3));

  /* Quatre dies més tard sí, perquè ja han passat els tres d'espera. */
  ctx.Utils.avui = () => '2026-08-10';
  ctx.Utils.ara = () => '2026-08-10T10:00:00+02:00';
  enviades = [];
  const r4 = ctx.Senyals.passa({});
  cal('passats els tres dies, torna a dir-ho', r4.enviats === 2, JSON.stringify(r4));

  /* De nit no es diu res, encara que passin coses noves. */
  ctx.Utils.avui = () => '2026-08-20';
  ctx.Utils.ara = () => '2026-08-20T23:00:00+02:00';
  horaAra = 23;
  enviades = [];
  const r5 = ctx.Senyals.passa({});
  cal('de nit no interromp', r5.enviats === 0 && /de nit/.test(r5.motiu), JSON.stringify(r5));
  cal('però ho apunta igual, per no perdre-ho',
      files.filter((f) => f.data === '2026-08-20').length === 3);

  /* Un mòdul que peta no s'emporta els altres. */
  horaAra = 10;
  ctx.Utils.avui = () => '2026-08-25';
  ctx.Utils.ara = () => '2026-08-25T10:00:00+02:00';
  ctx.Moduls = { actius: () => [
    { id: 'dolent', nom: 'Dolent', senyals: () => { throw new Error('peta'); } },
    { id: 'bo', nom: 'Bo', senyals: () => [senyal('z', 3)] }
  ] };
  enviades = [];
  const r6 = ctx.Senyals.passa({});
  cal('un mòdul que peta no s\'emporta els altres', r6.enviats === 1, JSON.stringify(r6));

  /* Quan el senyal ja es diu com el seu apartat —l'escola en diu «Escola» i el
     mòdul també— no s'ha de dir dues vegades en dues línies seguides. */
  ctx.Utils.avui = () => '2026-08-26';
  ctx.Utils.ara = () => '2026-08-26T10:00:00+02:00';
  ctx.Moduls = { actius: () => [{ id: 'igualet', nom: 'Prova', senyals: () =>
    [{ id: 'igual', titol: 'Prova', text: 'passa una cosa', urgencia: 3 }] }] };
  enviades = [];
  ctx.Senyals.passa({});
  cal('si el senyal es diu com l\'apartat, no es repeteix',
      enviades.length === 1 && enviades[0].c === 'passa una cosa',
      JSON.stringify(enviades[0]));

  /* I un senyal pot obrir una pantalla que no es digui com el seu mòdul: la
     conversa es diu «JEFE» i la seva obre «La setmana». El nom de l'app com a
     títol no diu on et porta. */
  ctx.Utils.avui = () => '2026-08-27';
  ctx.Utils.ara = () => '2026-08-27T10:00:00+02:00';
  ctx.Moduls = { actius: () => [{ id: 'conversa', nom: 'JEFE', senyals: () =>
    [{ id: 'setmana', apartat: 'La setmana', titol: 'La setmana que ve',
       text: 'tres coses esperen', urgencia: 1, accio: 'setmana' }] }] };
  enviades = [];
  ctx.Senyals.passa({});
  cal('un senyal pot dir a quin apartat pertany la notificació',
      enviades.length === 1 && enviades[0].t === 'La setmana', JSON.stringify(enviades[0]));

  /* I els mòduls de debò han de saber-ne declarar. */
  const declaren = ['40_Mod_Finances.gs']
    .filter((f) => /senyals:\s*function/.test(fs.readFileSync('apps-script/' + f, 'utf8')));
  cal('finances sap dir què li passa (el vigilant)', declaren.length === 1, declaren.join(', '));

  const inst = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  cal('i hi ha un trigger que ho mira, i surt a la llista de neteja',
      /newTrigger\('triggerSenyals'\)/.test(inst) && /var TRIGGERS = \[[^\]]*'triggerSenyals'/.test(inst));
}

// ------------------------------------------------------------------ el visor
console.log('\nEl visor: qualsevol eina pot ensenyar el que ha trobat');
{
  /* `visorRetallat_` viu dins de l'assistent. S'extreu i s'executa tal com és:
     el que es prova és el sostre, que és el que evita que una eina de tres mil
     files faci una resposta de mig mega cap al navegador. */
  const src = fs.readFileSync('apps-script/55_Assistent.gs', 'utf8');
  const tros = src.slice(src.indexOf('  var VISOR_MAX'), src.indexOf('  function retalla_('));
  const c = { String, Object, Array, Number, Math, JSON };
  vm.createContext(c);
  vm.runInContext(tros + '\nvar __r = visorRetallat_;', c);
  const retalla = c.__r;

  const moltes = [];
  for (let i = 0; i < 400; i++) moltes.push({ text: 'cosa ' + i });

  const r = retalla({ titol: 'Moltes', mena: 'llista', dades: moltes, peu: ['400 coses'] });
  cal('es retalla pel sostre', r.dades.length === 120, r.dades.length);
  cal('i es diu quantes se n\'han quedat fora',
      r.peu.join(' ').indexOf('280 més') !== -1, r.peu.join(' · '));
  cal('el que hi cap no es toca',
      retalla({ mena: 'llista', dades: [{ text: 'una' }] }).dades.length === 1);

  const t = retalla({ mena: 'taula',
                      dades: { caps: ['a', 'b'], files: moltes.map(() => ['x', 'y']) } });
  cal('una taula també es retalla, i per files', t.dades.files.length === 120, t.dades.files.length);
  cal('i les capçaleres es queden', t.dades.caps.join(',') === 'a,b');

  cal('sense res, no hi ha visor', retalla(null) === undefined);
  cal('la forma per defecte és la llista', retalla({ dades: [] }).mena === 'llista');

  /* I que el pas del servidor a la pantalla hi sigui de debò: sense això,
     l'eina retorna el visor i no s'obre res mai. */
  cal('l\'assistent el fa viatjar', /visor: \(resultat && resultat\._visor\)/.test(src));
  /* Qui l'obria era la pantalla de la conversa, i ja no hi és. El visor es
     queda —el fan servir els mòduls per ensenyar coses— però la comprovació
     de qui el recull tornarà el dia que hi torni la IA, amagada. */

  /* LES EINES QUE DIUEN QUE SABEN ENSENYAR, HO HAN DE FER.
     No es compta quantes n'hi ha —això creixerà— sinó que cap declari
     `ensenya` a l'esquema i després no retorni res per ensenyar: seria una
     casella que el model marca i que no fa res. */
  const ambEnsenya = [];
  fs.readdirSync('apps-script').filter((f) => f.endsWith('.gs')).forEach((f) => {
    const t2 = fs.readFileSync('apps-script/' + f, 'utf8');
    if (/ensenya:\s*\{ type: 'boolean'/.test(t2)) ambEnsenya.push([f, /_visor\s*=/.test(t2)]);
  });
  /* A JEFE n'hi havia tres; aquí l'única és la de finances. Que hi sigui. */
  cal('l\'eina de finances sap ensenyar', ambEnsenya.some((x) => x[0] === '40_Mod_Finances.gs'),
      ambEnsenya.map((x) => x[0]).join(', '));
  cal('i totes les que ho diuen, ho fan',
      ambEnsenya.every((x) => x[1]),
      ambEnsenya.filter((x) => !x[1]).map((x) => x[0]).join(', ') || 'cap');

  /* I QUE NO TORNI A PARLAR DE LES SEVES EINES.
     «No tinc cap eina per a això» és explicar-li com estàs fet en comptes de
     respondre-li, i el deixa sense saber què fer. La instrucció és al prompt,
     i el prompt és una cosa que s'esporga sense voler. */
  cal('se li diu que no parli mai de les seves eines',
      /MAI PARLIS DE LES TEVES EINES/.test(src));
  cal('amb les paraules exactes que ha de defugir',
      /no tinc cap eina/i.test(src) && /no disposo/i.test(src), '');
  cal('i amb què ha de fer al seu lloc: dir què sí que pot donar',
      /què SÍ que li pots donar/.test(src));
}

// ------------------------------------------ finances: el que és d'aquesta app
/* Les coses que la separació de JEFE va haver de canviar o de respectar, i
   que si un dia es desfan no fallaria res a la vista: l'app s'instal·laria
   com si fos JEFE, trepitjaria la memòria de les altres apps, heretaria la
   pàgina de l'app vella de finances o connectaria el banc a un altre lloc. */
console.log('\nFinances: viu a /financesapp/, porta el seu nom i troba les coses de JEFE');
{
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  cal("el manifest té l'id de finances, no el de JEFE", manifest.id === '/financesapp/', manifest.id);
  cal('i les adreces relatives, que viatgen soles',
      manifest.start_url === './' && manifest.scope === './', manifest.start_url + ' · ' + manifest.scope);

  const sw = fs.readFileSync('sw.js', 'utf8');
  cal('la memòria cau del navegador porta el prefix de finances', /var PREFIX = 'financesapp-';/.test(sw));
  cal('i només esborra les seves, no les de Nutrició ni les del cos',
      /n\.indexOf\(PREFIX\) === 0 && n !== CAU/.test(sw));
  /* L'app de finances del juliol tenia, al mateix domini, la memòria cau
     «finances-v1». Un prefix que la inclogués l'esborraria en activar-se, i
     no és seva. */
  const prefix = (sw.match(/var PREFIX = '([^']+)';/) || [, ''])[1];
  cal("i el prefix no atrapa la de l'app vella del juliol",
      prefix && !'finances-v1'.startsWith(prefix), prefix);

  const app = fs.readFileSync('apps-script/ui_app.html', 'utf8');
  cal('la memòria local també porta el prefix de finances', /var PREFIX_CAU = 'finances\.';/.test(app));
  /* L'app vella desava al mòbil amb «finances_v1», amb guió baix. Pot ser
     l'única còpia d'aquelles dades: aquesta app no les ha de tocar mai. */
  cal("i el prefix no és el de l'app vella («finances_»)", !/PREFIX_CAU = 'finances_/.test(app));
  cal("i ja no en queda cap amb el «jefe.» de JEFE", !/localStorage\.\w+\('jefe\./.test(app));

  const inst = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  const fulls = (inst.match(/var FULLS_FINANCES = \[([^\]]*)\]/) || [, ''])[1].match(/'(\w+)'/g) || [];
  cal('es copien les set pestanyes de finances',
      fulls.map((x) => x.replace(/'/g, '')).join(',') ===
        'Moviments,Categories,Recurrents,FinancesMemoria,Pressupostos,Patrimoni,PatrimoniHistoric',
      fulls.join(','));
  cal('i el full de JEFE només es llegeix: cap escriptura hi va',
      !/(origen|jefe)\.(insertSheet|deleteSheet|getRange\([^)]*\)\.set|getSheetByName\([^)]*\)\.(clear|delete|getRange\([^)]*\)\.set))/.test(inst));

  /* LA CÒPIA ES COMPROVA, NO ES DONA PER FETA. Cel·la per cel·la, i nomes
     llegint. Moviments no es pot tornar a baixar del banc més enllà de 90 dies. */
  const cc = inst.slice(inst.indexOf('function comprovaCopia()'), inst.indexOf('\n}\n', inst.indexOf('function comprovaCopia()')));
  cal('hi ha comprovaCopia(), i compara el contingut sencer',
      /computeDigest/.test(cc) && /getValues\(\)/.test(cc));
  cal('i no escriu res enlloc', !/\.set(Value|Values|Name|Property)\(|insertSheet|deleteSheet|copyTo/.test(cc));

  /* EL BANC TORNA A AQUESTA APP. La comprovació de qui contesta a l'adreça de
     tornada mirava el títol «JEFE»; ara el títol és «Finances», i JEFE és
     justament un dels llocs on el banc NO ha de tornar. */
  const banc = fs.readFileSync('apps-script/42_Finances_Banc.gs', 'utf8');
  const enc = fs.readFileSync('apps-script/30_Encaminador.gs', 'utf8');
  cal("la pàgina de l'app es diu «Finances»", /\.setTitle\('Finances'\)/.test(enc));
  cal('i és el que reconeix la comprovació del banc',
      /<title>\\s\*Finances\\s\*<\\\/title>[^\n]*quiContesta = 'jefe'/.test(banc));
  cal('i JEFE ja no hi passa per bo',
      !/<title>\\s\*JEFE\\s\*<\\\/title>[^\n]*quiContesta = 'jefe'/.test(banc));

  /* LES FUNCIONS QUE EL MATEIX CODI ET DIU QUE EXECUTIS. El mòdul del banc
     diu «executa connectaBanc()» o «bancsDisponibles()», i el permís del banc
     caduca cada noranta dies: si no hi fossin, no hi hauria manera de
     tornar-lo a connectar. */
  ['configura', 'generaClauAcces', 'instalaTriggers', 'treuTriggers', 'triggerManteniment',
   'triggerBanc', 'triggerPatrimoni', 'sincronitzaBancAra', 'arreglaClauBanc', 'provaBanc',
   'provaClauBanc', 'provaQuiCobra', 'omplequiCobra', 'mirarPatrimoni', 'bancsDisponibles',
   'connectaBanc', 'estatBanc', 'queSapElBanc', 'preparaFusio', 'fusionaAra', 'desfesLaFusio',
   'comprovaCopia'].forEach((f) => {
    cal(f + '() hi és', new RegExp('\\nfunction ' + f + '\\(').test(inst));
  });
  cal("configuraJefe() ja no: ara es diu configura()", !/function configuraJefe\(/.test(inst));

  /* Res de la resta de JEFE: ni el pont amb l'escola ni els creuaments. */
  const fitxers = fs.readdirSync('apps-script');
  const sobren = fitxers.filter((f) => /^(40_Mod_(?!Finances)|44_|70_)|vista_(?!finances|inici)/.test(f));
  cal('cap fitxer d\'un altre mòdul de JEFE', sobren.length === 0, sobren.join(', '));
  cal('i hi són els cinc de finances',
      ['40_Mod_Finances.gs', '41_Finances_Import.gs', '42_Finances_Banc.gs',
       '43_Finances_Regles.gs', 'vista_finances.html'].every((f) => fitxers.indexOf(f) !== -1));

  /* Les finances no fan servir la IA: res d'això s'ha de portar de JEFE. */
  cal("no es porten els ajustos de la IA de JEFE", !/portaAjustosDeJefe_\(/.test(inst));
}

// --------------------------------------------------------- s'obre al mes
/* No hi ha full índex: l'app és una pantalla, com Nutrició. Si l'arrencada
   anés a buscar «inici», que aquí no existeix, cauria a la pantalla per
   defecte i des de fora no es notaria res fins que alguna cosa hi depengués. */
console.log('\nL\'arrencada: directament al mes, sense índex');
{
  const app = fs.readFileSync('apps-script/ui_app.html', 'utf8');
  cal('la pantalla d\'arrencada és Finances', /var INICI = 'finances';/.test(app));
  cal('i ja no es va a buscar «inici» enlloc', !/App\.ves\('inici'/.test(app));

  const idx = fs.readFileSync('apps-script/ui_index.html', 'utf8');
  const inclosos = (idx.match(/include\('([^']+)'\)/g) || []).map((x) => x.slice(9, -2));
  const falten = inclosos.filter((n) => !fs.existsSync('apps-script/' + n + '.html'));
  cal('tot el que inclou la pàgina existeix', falten.length === 0, falten.join(', '));
  cal('i la de Finances hi és', inclosos.indexOf('vista_finances') !== -1);

  const vf = fs.readFileSync('apps-script/vista_finances.html', 'utf8');
  cal('el botó de tornar a l\'índex ja no hi és', !/data-torna/.test(vf));
  cal('i l\'avís d\'activar les notificacions viu a la pantalla del mes',
      /Notificacions\.activa\(\)/.test(vf) && /cridaAvisos\(\)/.test(vf));
}

// ------------------------------------------- la paraula JEFE, fora de la vista
/* En Pol no ha de veure «JEFE» a la pantalla. Els comentaris del codi poden
   parlar d'on ve tot, i els missatges de l'editor el nomenen a posta —és d'on
   es copien les dades—, però res del que surt a l'app ni a la icona
   instal·lada. */
console.log('\nCap «JEFE» a la pantalla');
{
  const treuComentaris = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  const deixa = /MARCA_JEFE|VERSIO_JEFE|var Jefe = |Jefe\.\w+|jefe: 'ves'|m\.jefe !==|\/\^\\s\*jefe\\s\*\$\/i|id="ic-jefe"/;
  const trobats = [];
  fs.readdirSync('apps-script').filter((f) => /\.html$/.test(f)).forEach((f) => {
    treuComentaris(fs.readFileSync('apps-script/' + f, 'utf8')).split('\n').forEach((l) => {
      if (/jefe/i.test(l) && !deixa.test(l)) trobats.push(f + ': ' + l.trim().slice(0, 70));
    });
  });
  cal('cap text de pantalla diu JEFE', trobats.length === 0, trobats.slice(0, 4).join(' · '));

  const man = fs.readFileSync('manifest.webmanifest', 'utf8');
  cal('ni el manifest', !/jefe/i.test(man));
}

// ----------------------------------------------- el tall del mes, de debò
/* La peça pròpia d'aquesta app. Es dibuixa amb els moviments del mes i prou:
   els traspassos no hi compten (tampoc al balanç), i sense moviments les dues
   línies són planes. Es prova executant la funció de debò. */
console.log('\nEl tall del mes: els moviments de debò, i res inventat');
{
  const vf = fs.readFileSync('apps-script/vista_finances.html', 'utf8');
  const tros = vf.slice(vf.indexOf('    function tall(d, esActual) {'), vf.indexOf('    function xifra(etiqueta'));
  const c = { String, Number, Math, Date, Array, cats: [{ id: 'c_tras', exclou: true }, { id: 'c_alim', exclou: false }],
              esc: (s) => String(s), eur: (n) => String(n) };
  vm.createContext(c);
  vm.runInContext(tros + '\nvar __t = tall;', c);

  const amb = c.__t({ mes: '2026-07', moviments: [
    { data: '2026-07-01', tipus: 'i', import: 2000, categoria: 'i_nom' },
    { data: '2026-07-03', tipus: 'd', import: 300, categoria: 'c_tras' },
    { data: '2026-07-10', tipus: 'd', import: 500, categoria: 'c_alim' }
  ] }, false);
  cal('diu quant ha entrat i quant ha sortit, sense els traspassos',
      /han entrat 2000 i han sortit 500/.test(amb), (amb.match(/aria-label="([^"]*)"/) || [])[1]);
  cal('i té les dues línies', /class="entra" d="M/.test(amb) && /class="surt" d="M/.test(amb));

  const buit = c.__t({ mes: '2026-07', moviments: [] }, false);
  const linia = (svg, cls) => (svg.match(new RegExp('class="' + cls + '" d="([^"]*)"')) || [, ''])[1];
  const ys = (d) => (d.match(/V(-?[\d.]+)/g) || []).map((v) => Number(v.slice(1)));
  const plana = (d) => new Set(ys(d)).size <= 1;
  cal('sense moviments, les dues línies són planes', plana(linia(buit, 'entra')) && plana(linia(buit, 'surt')),
      linia(buit, 'entra').slice(0, 60));
}

// ------------------------------------------------ instal·lar-la amb el botó
/* Al mòbil d'en Pol, el menú de Chrome només deixa crear una drecera quan al
   domini ja hi ha una altra app instal·lada. El botó de la pàgina, que crida
   la instal·lació del navegador directament, sí que funciona. */
console.log("\nInstal·lar: amb el botó de la pàgina, que el menú no ho deixa");
{
  const cons = fs.readFileSync('eines/construeix.mjs', 'utf8');
  const vf = fs.readFileSync('apps-script/vista_finances.html', 'utf8');
  cal("l'avís del navegador es desa d'hora, a la capçalera de la pàgina publicada",
      /beforeinstallprompt[\s\S]{0,120}e\.preventDefault\(\);\s*window\.__potInstallar = e;/.test(cons));
  cal("el mes hi posa el botó i crida la instal·lació", /data-installa/.test(vf) && /avis\.prompt\(\)/.test(vf));
  cal("i no surt si ja s'ha obert des de la icona", /display-mode: standalone/.test(vf));
  cal("i els oients no s'acumulen a cada pantalla", /removeEventListener\('pot-installar'/.test(vf));
}

console.log(falles ? '\n' + falles + ' falla(des).\n' : '\nTot correcte.\n');
process.exit(falles ? 1 : 0);
