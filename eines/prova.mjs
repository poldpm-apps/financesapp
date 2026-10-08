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

// ------------------------------------------------------------------- comptadors
console.log('\nHàbits: un comptador es compta, no es jutja');
{
  const AVUI = '2026-08-01';

  // Els registres que se li posaran a sota, com si vinguessin del full.
  const registres = [];
  function apunta(idHabit, data, valor) {
    registres.push({ id: 'r' + registres.length, id_habit: idHabit, data, valor, _fila: registres.length + 2 });
  }

  const habits = [
    { id: 'h_cig', nom: 'Cigarros', tipus: 'comptador', objectiu: 0, unitat: 'cigarros',
      frequencia: 'diaria', actiu: 'SI', ordre: 1, creat_el: '2026-07-01T09:00:00+02:00', _fila: 2 },
    { id: 'h_dents', nom: 'Dents', tipus: 'quantitat', objectiu: 2, unitat: '',
      frequencia: 'diaria', actiu: 'SI', ordre: 2, creat_el: '2026-07-01T09:00:00+02:00', _fila: 3 }
  ];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, isFinite, parseFloat,
    Log: { info() {}, avis() {}, error() {} },
    Utilities: {
      // Només els dos formats que fa servir Utils.
      formatDate: (d, tz, patro) => patro.indexOf('T') === -1
        ? [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-')
        : d.toISOString()
    },
    Config: { zonaHoraria: () => 'Europe/Madrid' },
    Dades: {
      llegeix: (full, filtre) => {
        const files = full === 'Habits' ? habits : registres;
        if (typeof filtre === 'function') return files.filter(filtre);
        if (filtre) return files.filter(f => Object.keys(filtre).every(k => String(f[k]) === String(filtre[k])));
        return files.slice();
      },
      perId: (full, id) => (full === 'Habits' ? habits : registres).filter(f => f.id === id)[0] || null,
      un: (full, filtre) => ctx.Dades.llegeix(full, filtre)[0] || null,
      desa: () => null, insereix: () => null, actualitza: () => null
    },
    ambBloqueig_: (fn) => fn()
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('apps-script/40_Mod_Habits.gs', 'utf8'), ctx);
  ctx.Utils.avui = () => AVUI;                      // el rellotge, fixat

  // Set dies: 4, 6, 2, 0(sense registre), 8, 5, 3  →  del 2026-07-26 al 2026-08-01
  apunta('h_cig', '2026-07-26', 4);
  apunta('h_cig', '2026-07-27', 6);
  apunta('h_cig', '2026-07-28', 2);
  apunta('h_cig', '2026-07-30', 8);
  apunta('h_cig', '2026-07-31', 5);
  apunta('h_cig', '2026-08-01', 3);

  const d = ctx.Habits.dia(AVUI);
  const cig = d.habits.filter(h => h.id === 'h_cig')[0];
  const dents = d.habits.filter(h => h.id === 'h_dents')[0];

  cal('el comptador porta la xifra del dia', cig.valor === 3, String(cig.valor));
  cal('un comptador NO és mai exigit', cig.exigit === false, String(cig.exigit));
  cal('un comptador NO es completa mai', cig.complert === false, String(cig.complert));
  cal('un comptador no té percentatge', cig.pct30 === null, String(cig.pct30));
  cal('un comptador no té ratxa', cig.ratxa === 0, String(cig.ratxa));
  cal('mitjana de 7 dies comptant el dia sense registre com a zero',
      cig.mitjana7 === 4, String(cig.mitjana7));   // (4+6+2+0+8+5+3)/7 = 4

  // La setmana anterior (19–25 de juliol) no té res: 0 de mitjana → +4
  cal('diu si puja o baixa respecte la setmana abans', cig.canvi7 === 4, String(cig.canvi7));

  cal('els comptadors NO surten al full de compliment',
      ctx.Habits.mes(AVUI, 30).habits.every(h => h.id !== 'h_cig'),
      ctx.Habits.mes(AVUI, 30).habits.map(h => h.id).join(','));

  cal('un hàbit normal segueix exactament igual',
      dents.exigit === true && dents.objectiu === 2 && dents.pct30 !== null,
      JSON.stringify({ exigit: dents.exigit, objectiu: dents.objectiu, pct30: dents.pct30 }));

  // La mitjana es reparteix entre els dies que l'hàbit ja existia, no set fixos.
  habits[0].creat_el = '2026-07-30T09:00:00+02:00';
  const cig2 = ctx.Habits.dia(AVUI).habits.filter(h => h.id === 'h_cig')[0];
  // Reordenar: el que ell decideix mana sobre l'ordre de creació.
  const escritsOrdre = [];
  ctx.Dades.actualitzaMoltes = (full, ids, fn) => {
    ids.forEach((id, i) => escritsOrdre.push(id + ':' + fn({ id }, i).ordre));
    return ids.length;
  };
  ctx.Habits.ordena(['h_dents', 'h_cig']);
  cal('ordenar numera segons la llista rebuda',
      escritsOrdre.join(' ') === 'h_dents:1 h_cig:2', escritsOrdre.join(' '));

  let potaOrdre = false;
  try { ctx.Habits.ordena(['no_existeix']); } catch (err) { potaOrdre = true; }
  cal('ordenar amb identificadors que no hi són avisa', potaOrdre, 'ho ha deixat fer');

  cal('des que existeix i no set dies sempre',
      cig2.mitjana7 === 5.3, String(cig2.mitjana7));    // (8+5+3)/3 = 5,33
}

// ------------------------------------------------------------------------ diari
console.log('\nDiari: afegir no és substituir, i el resum no depèn de la IA');
{
  const AVUI = '2026-08-01';
  let files = [];
  let seq = 0;
  const notificacions = [];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, isFinite, parseFloat,
    Log: { info() {}, avis() {}, error() {} },
    Utilities: {
      formatDate: (d, tz, patro) => patro.indexOf('T') === -1
        ? [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-')
        : d.toISOString()
    },
    Config: { zonaHoraria: () => 'Europe/Madrid' },
    Dades: {
      llegeix: (full, filtre) => {
        const vives = files.slice();
        if (typeof filtre === 'function') return vives.filter(filtre);
        if (filtre) return vives.filter(f => Object.keys(filtre).every(k => String(f[k]) === String(filtre[k])));
        return vives;
      },
      insereix: (full, obj) => { const nou = Object.assign({ id: 'd' + (++seq) }, obj); files.push(nou); return nou; },
      actualitza: (full, id, canvis) => {
        const f = files.filter(x => x.id === id)[0];
        if (!f) return null;
        Object.keys(canvis).forEach(k => { f[k] = canvis[k]; });
        return f;
      }
    },
    // Cap mòdul de debò: el diari no n'ha de conèixer ni un.
    Moduls: {
      resumInici: () => [
        { modul: 'habits', etiqueta: 'Hàbits pendents', valor: 2, urgent: true },
        { modul: 'tasques', etiqueta: 'Tasques per fer', valor: 5, urgent: false }
      ],
      resumPeriode: () => [{ modul: 'habits', titol: 'Hàbits', linies: ['Córrer: 4 de 7 dies'] }]
    },
    IA: { disponible: () => false, genera: () => { throw new Error('no hauria de cridar-se'); } },
    /* `junta` no es dobla: és la que decideix com queda el cos, i doblar-la
       voldria dir comprovar una cosa que no és la que arriba al telèfon. */
    Notifica: {
      junta: (a, b) => (!a ? b : !b ? a : a + (/[.!?:;·…]$/.test(a) ? ' ' : '. ') + b),
      envia: (titol, cos) => { notificacions.push({ titol, cos }); return { enviades: 1 }; }
    }
  };
  /* El bloqueig viu a 10_Dades.gs i aquí només es carrega el diari. Es dobla
     amb el que fa de debò —executar el que li donen— perquè el que es prova
     en aquest bloc és el diari, no el bloqueig; el bloqueig té la seva prova
     al bloc de sota. */
  ctx.ambBloqueig_ = (fn) => fn();
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('apps-script/40_Mod_Diari.gs', 'utf8'), ctx);
  ctx.Utils.avui = () => AVUI;

  ctx.Diari.escriu(AVUI, 'Al matí he anat a la Vall de Boí.', 4, 'app');
  cal('desa l\'entrada del dia', ctx.Diari.entrada(AVUI).text.indexOf('Boí') !== -1,
      JSON.stringify(ctx.Diari.entrada(AVUI)));
  cal('desa l\'ànim', ctx.Diari.entrada(AVUI).anim === 4, String(ctx.Diari.entrada(AVUI).anim));

  // LA REGLA QUE MÉS IMPORTA: des de la conversa s'afegeix, no es substitueix.
  ctx.Diari.afegeixPerNom({ text: 'I al vespre reunió de claustre.' });
  const e = ctx.Diari.entrada(AVUI);
  cal('afegir des de la conversa NO esborra el que hi havia',
      e.text.indexOf('Boí') !== -1 && e.text.indexOf('claustre') !== -1, e.text);
  cal('i no en crea una segona per al mateix dia',
      files.filter(f => f.data === AVUI && f.tipus === 'entrada' && !f.esborrat_el).length === 1,
      String(files.filter(f => f.data === AVUI && f.tipus === 'entrada').length));
  cal('afegir conserva l\'ànim que ja hi havia', e.anim === 4, String(e.anim));

  // Escriure una segona vegada des de l'app SÍ que substitueix: és el camp de text.
  ctx.Diari.escriu(AVUI, 'Text nou', 4, 'app');
  cal('des de l\'app, el camp mana', ctx.Diari.entrada(AVUI).text === 'Text nou',
      ctx.Diari.entrada(AVUI).text);

  // Buidar-ho tot treu l'entrada en comptes de desar una línia en blanc.
  ctx.Diari.escriu(AVUI, '   ', 0, 'app');
  cal('buidar-ho treu l\'entrada', ctx.Diari.entrada(AVUI) === null,
      JSON.stringify(ctx.Diari.entrada(AVUI)));

  // El resum de la nit, amb la IA APAGADA.
  const r = ctx.Diari.generaDiari(AVUI);
  cal('el resum es fa igual sense IA', r.text.indexOf('Hàbits pendents: 2') !== -1, r.text);
  cal('i ho diu, que no n\'hi ha hagut', r.ambIA === false, String(r.ambIA));
  /* Abans es demanava que el títol portés què queda pendent. Ara això va al
     COS i el títol diu d'on ve: el que no pot ser és que els dos diguin el
     mateix, que és el que passava al calendari amb una sola cita. */
  cal('el títol diu d\'on ve i el cos què queda pendent',
      notificacions.length === 1 && notificacions[0].titol === 'Diari · resum' &&
      /hàbits pendents/i.test(notificacions[0].cos),
      JSON.stringify(notificacions[0]));
  /* I NOMÉS UNA VEGADA. Sense IA, darrere dels pendents hi anava la llista
     sencera de fets, que els tornava a dir amb els punts de la llista pel mig:
     «Hàbits pendents: 2. · Hàbits pendents: 2 · · Tasques per fer: 5». */
  cal('i sense IA no repeteix els pendents darrere seu',
      notificacions[0].cos === 'Hàbits pendents: 2', notificacions[0].cos);

  // Repetir-lo no n'acumula un segon.
  ctx.Diari.generaDiari(AVUI);
  cal('generar-lo dues vegades el reescriu, no l\'acumula',
      files.filter(f => f.tipus === 'resum' && f.data === AVUI).length === 1,
      String(files.filter(f => f.tipus === 'resum').length));

  const rev = ctx.Diari.generaSetmanal(AVUI);
  cal('la revisió agafa la setmana sencera', rev.desde === '2026-07-26' && rev.fins === AVUI,
      rev.desde + '/' + rev.fins);
  cal('i la data la diu en català, no en format de màquina',
      rev.text.indexOf("Setmana del 26 de juliol a l'1 d'agost") === 0,
      rev.text.split('\n')[0]);
  cal('i porta les xifres dels mòduls', rev.text.indexOf('Córrer: 4 de 7 dies') !== -1, rev.text);

  // Escriure el diari d'un dia que encara no ha arribat no té sentit.
  let hoImpedeix = false;
  try { ctx.Diari.escriu('2026-09-01', 'del futur', 0, 'app'); } catch (err) { hoImpedeix = true; }
  cal('no deixa escriure un dia que no ha arribat', hoImpedeix, 'ho ha deixat fer');

  /* ────────────────────────────────────────────────────────────────────
     I ARA AMB LA IA ENCESA, que és d'on venia el problema de debò.
     Al telèfon arribava això:
       «Hàbits pendents: 5 · escola: 1 · vas en negatiu: −599,73 €.
        Tens 5 hàbits pendents i 1 tema d'escola per demà. Ves a dormir.»
     La segona meitat no afegia res. A la instrucció ja se li diu que no ho
     faci; això és el que ho talla quan hi torna igualment. */
  let elQueDiuLaIA = '';
  ctx.IA = { disponible: () => true, genera: () => ({ text: elQueDiuLaIA }) };
  const cosAmbIA = (diu) => {
    elQueDiuLaIA = diu;
    notificacions.length = 0;
    ctx.Diari.generaDiari(AVUI);
    return notificacions[0].cos;
  };

  cal('la frase que recompta els pendents cau',
      cosAmbIA('Tens 2 hàbits pendents. Ves a dormir.') === 'Hàbits pendents: 2. Ves a dormir.',
      cosAmbIA('Tens 2 hàbits pendents. Ves a dormir.'));
  cal('la que no porta cap xifra no es toca mai',
      cosAmbIA('Demà et llevaràs abans.') === 'Hàbits pendents: 2. Demà et llevaràs abans.');
  /* Una frase amb una xifra NOVA es queda sencera encara que en repeteixi
     alguna: allò que la llista no diu val més que la repetició que arrossega. */
  cal('la que porta una xifra nova es queda',
      cosAmbIA('El control fa 6 dies que no es fa i tens 2 hàbits pendents.')
        === 'Hàbits pendents: 2. El control fa 6 dies que no es fa i tens 2 hàbits pendents.');
  cal('si tot el comentari repetia, queden només els pendents',
      cosAmbIA('Tens 2 hàbits pendents.') === 'Hàbits pendents: 2');

  /* I al diari hi ha de quedar el comentari SENCER: allà es llegeix sota la
     llista i com a tancament del dia, que és el seu lloc. */
  elQueDiuLaIA = 'Tens 2 hàbits pendents. Ves a dormir.';
  const ambIA = ctx.Diari.generaDiari(AVUI);
  cal('però al diari hi queda el comentari sencer',
      ambIA.text.indexOf('Tens 2 hàbits pendents. Ves a dormir.') !== -1, ambIA.text);
}

// ------------------------------------------------------- l'agenda de les sis
console.log("\nL'avís de les sis: només si hi ha alguna cosa");
{
  let events = [];
  const enviats = [];
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array,
    Logger: { log: () => {} },
    Log: { info() {}, avis() {}, error() {} },
    Utils: { avui: () => '2026-08-03', talla: (t, n) => String(t).slice(0, n) },
    Calendari: { dia: () => ({ esdeveniments: events }) },
    Notifica: { envia: (titol, cos, o) => { enviats.push({ titol, cos, o }); return { enviades: 1 }; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    ScriptApp: { getProjectTriggers: () => [] },
    CalendarApp: {}, SpreadsheetApp: {}, CacheService: {}, Utilities: {},
    Session: {}, HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(),
    Config: {}, Dades: {}, Esquema: {}, Moduls: {}, IA: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8'), ctx);

  ctx.triggerAgendaDelDia();
  cal("un dia buit no envia res", enviats.length === 0, String(enviats.length));

  events = [
    { titol: 'Claustre de mestres', hora: '09:00', horaFi: '10:30', totElDia: false, lloc: 'Escola' },
    { titol: 'Visita al veterinari', hora: '17:00', horaFi: '18:00', totElDia: false, lloc: '' },
    { titol: 'Aniversari de la mare', hora: '', horaFi: '', totElDia: true, lloc: '' }
  ];
  ctx.triggerAgendaDelDia();
  cal("amb cites, envia", enviats.length === 1, String(enviats.length));
  /* Aquestes tres comprovaven la regla contrària —que el títol portés l'hora i
     el nom de la cita— i han saltat quan es va canviar. És el que havien de
     fer. La regla nova: el títol diu d'on ve, i el cos què hi ha; amb una sola
     cita, abans el títol i el cos deien el mateix. */
  cal("el títol diu d'on ve, no què hi ha",
      /^Calendari/.test(enviats[0].titol), enviats[0].titol);
  cal("i diu quantes n'hi ha, que és el que cap en dues paraules",
      /3 cites/.test(enviats[0].titol), enviats[0].titol);
  cal("el cos les porta totes, amb el de tot el dia identificat",
      enviats[0].cos.split('\n').length === 3 && /tot el dia · Aniversari/.test(enviats[0].cos),
      JSON.stringify(enviats[0].cos));
  cal("i tocar-la porta al calendari", enviats[0].o.url === './#calendari', JSON.stringify(enviats[0].o));

  events = [{ titol: 'Festa major', hora: '', horaFi: '', totElDia: true, lloc: '' }];
  enviats.length = 0;
  ctx.triggerAgendaDelDia();
  cal("amb una sola cita, el títol NO la repeteix",
      enviats[0].titol === 'Calendari' && enviats[0].titol !== enviats[0].cos,
      enviats[0].titol + '  /  ' + enviats[0].cos);

  cal("l'avís de les sis és a la llista de triggers",
      ctx.TRIGGERS.indexOf('triggerAgendaDelDia') !== -1, ctx.TRIGGERS.join(' '));
}

// ------------------------------------------- el calendari, i el preu de canviar de mes
console.log("");
console.log("Calendari: cinc mesos pel preu d'un");
{
  // Cada `getEvents` és un viatge a Google. Comptar-los és comptar els segons.
  let viatges = 0;
  const calendaris = [
    { id: 'meu@g', nom: 'Personal', color: '', mostra: 'SI', pont: '' },
    { id: 'casa@g', nom: 'Casa', color: '', mostra: 'SI', pont: '' },
    { id: 'esc@e', nom: 'Tutoria', color: '', mostra: 'SI', pont: 'SI' }
  ];
  const fals = (iso, titol) => ({
    getId: () => titol, getTitle: () => titol, getLocation: () => '',
    getDescription: () => '', getColor: () => '',
    getStartTime: () => new Date(iso + 'T10:00:00'),
    getEndTime: () => new Date(iso + 'T11:00:00'),
    isAllDayEvent: () => false
  });
  const agenda = {
    'meu@g': [fals('2026-07-15', 'De juliol'), fals('2026-08-20', "D'agost"), fals('2026-09-10', 'De setembre')],
    'casa@g': []
  };

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseInt, parseFloat,
    Log: { info() {}, avis() {}, error() {} },
    Config: { zonaHoraria: () => 'Europe/Madrid' },
    CacheService: { getScriptCache: () => null },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p2 = n => ('0' + n).slice(-2);
        return f === 'HH:mm' ? p2(d.getHours()) + ':' + p2(d.getMinutes())
          : d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      }
    },
    CalendarApp: {
      getCalendarById: (id) => agenda[id] ? {
        getEvents: (a, b) => { viatges++; return agenda[id].filter(e => e.getStartTime() >= a && e.getStartTime() <= b); }
      } : null,
      getAllCalendars: () => [], getAllOwnedCalendars: () => [], getDefaultCalendar: () => null
    },
    Dades: { llegeix: () => calendaris.slice(), un: () => null, insereix: () => {}, actualitza: () => {} },
    CalendariPont: { hiEs: () => true, esdeveniments: () => { viatges++; return []; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
    SpreadsheetApp: {}, Session: {}, HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(),
    Moduls: { registra: () => {} }, Esquema: {}, IA: {}, Notifica: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  ctx.Utils.avui = () => '2026-08-01';
  vm.runInContext(fs.readFileSync('apps-script/40_Mod_Calendari.gs', 'utf8'), ctx);

  const r = ctx.Calendari.pantalla({ mes: '2026-08' });

  cal('la pantalla porta cinc mesos', Object.keys(r.mesos).sort().join(' ') === '2026-06 2026-07 2026-08 2026-09 2026-10',
      Object.keys(r.mesos).join(' '));
  cal('i el mes demanat és el que es pinta', r.dades.mes === '2026-08', String(r.dades.mes));

  // Dos calendaris propis + una crida al pont = 3. Mes a mes en serien 15.
  cal('els cinc mesos es llegeixen en un sol escombrat', viatges === 3, viatges + ' viatges');

  const delMes = (m) => r.mesos[m].caselles.reduce((n, c) => n + (c.delMes ? c.quants : 0), 0);
  cal('cada mes es queda els seus i prou',
      delMes('2026-07') === 1 && delMes('2026-08') === 1 && delMes('2026-09') === 1,
      [delMes('2026-07'), delMes('2026-08'), delMes('2026-09')].join('/'));

  cal('el mes de davant ve sencer, llest per pintar sense demanar res',
      r.mesos['2026-09'].caselles.length % 7 === 0 && r.mesos['2026-09'].caselles.length >= 28,
      String(r.mesos['2026-09'].caselles.length));
}

// -------------------------------- el calendari no s'ha de rellegir a cada pregunta
console.log("");
console.log("Calendari: una finestra desada serveix per a tot el que hi cap");
{
  let viatges = 0;
  const memoria = {};
  const calendaris = [{ id: 'meu@g', nom: 'Personal', color: '', mostra: 'SI', pont: '' }];
  const fals = (iso, titol) => ({
    getId: () => titol, getTitle: () => titol, getLocation: () => '',
    getDescription: () => '', getColor: () => '',
    getStartTime: () => new Date(iso + 'T10:00:00'),
    getEndTime: () => new Date(iso + 'T11:00:00'),
    isAllDayEvent: () => false
  });
  const agenda = [fals('2026-08-01', "D'avui"), fals('2026-08-02', 'De dema'),
                  fals('2026-09-10', 'De setembre')];

  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseInt, parseFloat,
    Log: { info() {}, avis() {}, error() {} },
    Config: { zonaHoraria: () => 'Europe/Madrid' },
    CacheService: { getScriptCache: () => ({
      get: (k) => (memoria[k] === undefined ? null : memoria[k]),
      put: (k, v) => { memoria[k] = v; },
      remove: (k) => { delete memoria[k]; }
    }) },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p2 = n => ('0' + n).slice(-2);
        return f === 'HH:mm' ? p2(d.getHours()) + ':' + p2(d.getMinutes())
          : d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      }
    },
    CalendarApp: {
      getCalendarById: () => ({
        getEvents: (a, b) => { viatges++; return agenda.filter(e => e.getStartTime() >= a && e.getStartTime() <= b); }
      }),
      getAllCalendars: () => [], getAllOwnedCalendars: () => [], getDefaultCalendar: () => null
    },
    Dades: { llegeix: () => calendaris.slice(), un: () => null, insereix: () => {}, actualitza: () => {} },
    CalendariPont: { hiEs: () => false, esdeveniments: () => [] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
    SpreadsheetApp: {}, Session: {}, HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(),
    Moduls: { registra: () => {} }, Esquema: {}, IA: {}, Notifica: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/01_Utils.gs', 'utf8'), ctx);
  ctx.Utils.avui = () => '2026-08-01';
  vm.runInContext(fs.readFileSync('apps-script/40_Mod_Calendari.gs', 'utf8'), ctx);

  // Això és el que passa a CADA pregunta a en JEFE: avui, dema, i la pagina del dia.
  const avui = ctx.Calendari.dia('2026-08-01');
  const primerCop = viatges;
  const dema = ctx.Calendari.dia('2026-08-02');
  const pagina = ctx.Calendari.dia('2026-08-01');

  cal('el primer cop sí que va a Google', primerCop === 1, String(primerCop));
  cal('i els altres dos ja no', viatges === 1, viatges + ' viatges');
  cal("i cadascu es queda amb el SEU dia, no amb tota la finestra",
      avui.esdeveniments.length === 1 && dema.esdeveniments.length === 1 &&
      avui.esdeveniments[0].titol === "D'avui" && dema.esdeveniments[0].titol === 'De dema',
      JSON.stringify([avui.esdeveniments.map(e=>e.titol), dema.esdeveniments.map(e=>e.titol)]));
  cal('i la pagina del dia torna el mateix que la primera vegada',
      pagina.esdeveniments.length === 1, String(pagina.esdeveniments.length));

  // Comptar un rang no pot heretar el marge de la finestra.
  const c = ctx.Calendari.compta('2026-08-01', '2026-08-31');
  cal("comptar l'agost compta l'agost i prou", c.quants === 2, JSON.stringify(c.quants));

  // Sortir de la finestra sí que costa un viatge, i llavors ja hi torna a cabre tot.
  ctx.Calendari.dia('2027-03-15');
  const desprésDeSaltar = viatges;
  ctx.Calendari.dia('2027-03-16');
  cal('sortir de la finestra costa un viatge, i el de dins ja no',
      desprésDeSaltar === 2 && viatges === 2, desprésDeSaltar + '/' + viatges);
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
  const dolents = [];
  ['apps-script/vista_finances.html', 'apps-script/vista_dia.html',
   'apps-script/40_Mod_Finances.gs'].forEach(function (f) {
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

// -------------- si el model de transcriure no hi es, no et quedes sense veu
console.log("");
console.log("Veu: el model de transcriure pot no existir, i no pot deixar-te tirat");
{
  const crides = [];
  const ctx = {
    Date, Math, JSON, String, Number, Object, Array, RegExp,
    Log: { info() {}, avis() {}, error() {} },
    Utils: { avui: () => '2026-08-02', ara: () => 'ara', nouId: () => 'cnv_1',
             desJson: (t, d) => d, json: (o) => JSON.stringify(o), talla: (t, n) => String(t).slice(0, n),
             aixafa: (t) => String(t).toLowerCase() },
    Config: { get: (k) => (k === 'model_veu' ? 'un-model-que-no-hi-es' : null) },
    Dades: { llegeix: () => [], insereix: () => null },
    Moduls: { drecera: () => null, dreceres: () => [] },
    Assistent: { pregunta: () => ({ text: 'resposta', propostes: [], einesUsades: [],
                                    tokens: {}, temps: { total: 1, ia: 1, context: 0, eines: 0, voltes: 1 } }) },
    IA: {
      genera: (p) => {
        crides.push(p.model);
        if (p.model === 'un-model-que-no-hi-es') throw new Error('404 model not found');
        return { text: 'quants cigarros he fumat avui' };
      },
      disponible: () => true, motiu: () => null,
      consum: () => ({ avui: 3, tocat: false, faSegons: null })
    },
    Habits: { definicions: () => [] },
    SpreadsheetApp: {}, PropertiesService: {}, ScriptApp: {}, CacheService: {},
    HtmlService: {}, UrlFetchApp: {}, LockService: panyFals(), Session: {}, Utilities: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps-script/40_Mod_Conversa.gs', 'utf8'), ctx);

  const r = ctx.Conversa.enviaVeu({ audio: 'AAAA', mime: 'audio/wav' });
  cal('ho prova amb el model de veu i despres amb el de sempre',
      crides.join(' ').indexOf('un-model-que-no-hi-es barat') === 0, crides.join(' '));
  cal('i contesta igual', r.resposta === 'resposta', JSON.stringify(r).slice(0, 120));

  // Pero si el problema es la quota, no s'hi ha d'insistir amb l'altre model.
  crides.length = 0;
  ctx.IA.genera = (p) => { crides.push(p.model); var e = new Error('limit'); e.quota = true; throw e; };
  const r2 = ctx.Conversa.enviaVeu({ audio: 'AAAA', mime: 'audio/wav' });
  cal('amb la quota esgotada no ho torna a provar i gasta mes',
      crides.length === 1, crides.join(' '));
  cal('i ho diu clar', /limit/.test(r2.error || ''), JSON.stringify(r2));

  // Sense audio, ni ho intenta.
  var ho = false;
  try { ctx.Conversa.enviaVeu({}); } catch (e) { ho = true; }
  cal('sense so, no crida ningu', ho, 'ho ha fet');
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


// -------------------------------------------------- avisos programats dels mòduls
/* El pic de divendres al matí és l'única raó per la qual el mòdul de seguiment
   existeix: un xat no pot obrir conversa sol. Si això s'espatlla, el mòdul
   deixa de servir per al que serveix i no ho notaria ningú fins divendres. */
console.log('\nAvisos: un mòdul pot demanar hora sense que el nucli el conegui');
{
  const ctx = carregaTotElServidor();

  let triggers = [];
  const cadena = (nom) => {
    const t = { fn: nom, hora: null, minut: null };
    const c = {};
    ['timeBased', 'everyDays', 'everyMinutes', 'everyHours', 'onWeekDay', 'onMonthDay']
      .forEach((m) => { c[m] = () => c; });
    c.atHour = (h) => { t.hora = h; return c; };
    c.nearMinute = (m) => { t.minut = m; return c; };
    c.create = () => { if (t.hora !== null) triggers.push(t); };
    return c;
  };
  ctx.ScriptApp = { newTrigger: (n) => cadena(n), getProjectTriggers: () => [],
                    WeekDay: { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
                               FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 } };
  ctx.Config = { getNum: (k, d) => ({ hora_resum: 23, dia_revisio: 7, hora_revisio: 23 }[k] ?? d),
                 get: () => null };
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.treuTriggers = () => {};
  ctx.ambBloqueig_ = (f) => f();

  let enviades = [];
  /* `junta` és de debò i no un doble: és el que ajunta el que diu el mòdul amb
     el cos, i si es doblés no es comprovaria el que arriba de veritat. */
  const juntaDeDebo = (a, b) => (!a ? b : !b ? a : a + (/[.!?:;·…]$/.test(a) ? ' ' : '. ') + b);
  ctx.Notifica = { junta: juntaDeDebo,
                   envia: (t, c, o) => { enviades.push({ titol: t, cos: c, url: o.url }); return {}; } };

  ctx.instalaTriggers();
  const seus = triggers.filter((t) => t.fn === 'triggerAvisos');
  cal('es crea una hora de trigger per cada hora que demana un mòdul',
      seus.length === 1 && seus[0].hora === 6, JSON.stringify(seus));

  /* SENSE `nearMinute` L'AVÍS ARRIBA QUAN VOL DINS D'UNA HORA, i el control
     setmanal ja va picar un divendres a les 7:37 amb en Pol camí de l'escola.
     Que la finestra sigui d'un quart i no d'una hora és el que fa que demanar
     les sis vulgui dir alguna cosa. */
  cal('els avisos dels mòduls demanen el minut, no només l\'hora',
      seus[0].minut === 0, JSON.stringify(seus));

  /* Les combinacions que importen. La que ha d'enviar és una de sola:
     DIUMENGE, a les sis, i amb el control encara per fer.

     El dia ja no és un número escrit al codi: el mòdul el llegeix del seu full
     de pla. Aquí es falseja aquesta lectura, que és exactament el forat pel
     qual el dia i l'avís es podrien tornar a separar. */
  const quan = (iso) => { ctx.Date = class extends Date { constructor() { super(iso); } }; };
  let diaDelPla = 7;
  ctx.Seguiment.diaDelControl = () => diaDelPla;
  const prova = (iso, fet) => {
    enviades = [];
    ctx.Seguiment.estat = () => ({ fetAquestaSetmana: fet });
    quan(iso);
    ctx.triggerAvisos();
    return enviades.length;
  };

  cal('diumenge a les 6 amb el control per fer: pica',
      prova('2026-08-09T06:10:00', false) === 1);
  cal('diumenge a les 6 amb el control ja fet: calla',
      prova('2026-08-09T06:10:00', true) === 0);
  cal('dissabte a les 6: no és el seu dia',
      prova('2026-08-08T06:10:00', false) === 0);
  cal('divendres a les 6 ja no pica: el dia s\'ha mogut',
      prova('2026-08-07T06:10:00', false) === 0);
  cal('diumenge a les 15: no és la seva hora',
      prova('2026-08-09T15:15:00', false) === 0);
  cal('diumenge a les 7: l\'avís de les sis ja ha passat, no es repeteix',
      prova('2026-08-09T07:15:00', false) === 0);

  /* EL QUART DE MENYS. `nearMinute(0)` pot picar ABANS de l'hora, i llavors el
     rellotge diu una hora que ningú no ha demanat. Si això no s'arrodonís,
     l'avís no s'enviaria i no ho sabria ningú. */
  cal('diumenge a les 5:50 encara compta com l\'avís de les sis',
      prova('2026-08-09T05:50:00', false) === 1);
  cal('diumenge a les 5:30 encara no toca',
      prova('2026-08-09T05:30:00', false) === 0);

  /* I l'arrodoniment ha de moure el DIA quan travessa la mitjanit: a les 23:50
     de dissabte, l'avís de les 0h és el de diumenge. Aquí es comprova al revés
     —dissabte a les 23:50 no és diumenge a les sis— però amb la mateixa peça. */
  cal('dissabte a les 23:50 no dispara res de diumenge que no sigui de les 0h',
      prova('2026-08-08T23:50:00', false) === 0);

  /* CANVIAR EL DIA AL FULL HA DE MOURE L'AVÍS, sense tornar a instal·lar res.
     Aquest és tot el motiu del canvi: abans el dia estava escrit dos cops —al
     full i al codi— i moure'n un deixava l'altre picant on no tocava. */
  diaDelPla = 3;
  cal('si al full hi posa dimecres, pica dimecres',
      prova('2026-08-05T06:10:00', false) === 1);
  cal('i llavors el diumenge calla', prova('2026-08-09T06:10:00', false) === 0);

  /* I si no es pot saber quin dia toca, NO pica cada dia. `dia: null` vol dir
     diàriament, i caure-hi per una avaria seria un avís cada matí a les sis
     fins que algú se n'adonés. */
  diaDelPla = null;
  ctx.Seguiment.diaDelControl = () => { throw new Error('el full de pla no hi és'); };
  const capDia = [prova('2026-08-09T06:10:00', false), prova('2026-08-05T06:10:00', false),
                  prova('2026-08-07T06:10:00', false)];
  cal('si no se sap quin dia toca, no pica cap dia',
      capDia.join('') === '000', capDia.join(''));
  ctx.Seguiment.diaDelControl = () => 7;

  /* Un mòdul que peti no se n'ha d'emportar cap altre: és la mateixa regla que
     a `elDia` i a `resumInici`, i aquí encara importa més perquè ningú no ho
     està mirant quan passa. */
  enviades = [];
  ctx.Seguiment.estat = () => { throw new Error('el full no hi és'); };
  quan('2026-08-07T06:10:00');
  let ha_petat = false;
  try { ctx.triggerAvisos(); } catch (e) { ha_petat = true; }
  cal('un avís que peta es registra i no tomba el repartidor', !ha_petat);

  /* CANVIAR L'HORA AL MÒDUL NO CANVIA L'AUTOMATISME que ja hi ha: els triggers
     miren l'hora quan es creen i mai més. I comptar-los no ho veu —n'hi ha un i
     n'hi ha d'haver un—, o sigui que l'avís arribaria a l'hora vella i el
     diagnòstic diria que tot va bé. Per això `instalaTriggers` apunta les hores
     i `provaAvisos` les compara. */
  let apuntat = null;
  ctx.PropertiesService = { getScriptProperties: () => ({
    getProperty: () => apuntat, setProperty: (k, v) => { apuntat = v; } }) };
  ctx.ScriptApp.getProjectTriggers = () => [{ getHandlerFunction: () => 'triggerAvisos' }];
  ctx.Notifica.disponible = () => false;
  ctx.Notifica.motiu = () => 'no és una prova de notificacions';
  ctx.Seguiment.estat = () => ({ fetAquestaSetmana: true });

  ctx.instalaTriggers();
  cal('en instal·lar, queda apuntat a quines hores han quedat els avisos',
      apuntat === '[6]', String(apuntat));
  cal('i acabats d\'instal·lar, el diagnòstic no es queixa de l\'hora',
      !/hora vella/.test(ctx.provaAvisos()));

  apuntat = '[7]';
  const informe = ctx.provaAvisos();
  cal('si el mòdul ha canviat d\'hora i ningú no ha reinstal·lat, ho diu',
      /FALLA/.test(informe) && /hora vella/.test(informe), informe);
  cal('i diu quina hora hi ha posada i quina es demana',
      /les 7h/.test(informe) && /les 6h/.test(informe), informe);
}


// --------------------------------------- les dues còpies de les regles del seguiment
/* HI HA DUES IMPLEMENTACIONS DE LES MATEIXES REGLES, i és a posta: al navegador
   perquè el veredicte surti sense cap viatge, i al servidor perquè `elDia`,
   `resumInici` i el context de la IA no passen pel navegador.

   Dues còpies deriven. I derivarien EN SILENCI: la pantalla diria una cosa i la
   notificació una altra, i tu no ho sabries fins que et fixessis. Això les fa
   córrer totes dues sobre els mateixos casos i compara què en surt. */
console.log('\nSeguiment: la còpia del navegador i la del servidor diuen el mateix');
{
  const font = fs.readFileSync('apps-script/40_Mod_Seguiment.gs', 'utf8');
  const vista = fs.readFileSync('apps-script/vista_seguiment.html', 'utf8');

  // --- la del servidor
  const srvFont = font.slice(font.indexOf('var Seguiment = (function ()'),
                             font.lastIndexOf('})();') + 5);
  const srvCtx = {
    Utils: { avui: () => '2026-08-03' }, Dades: { llegeix: () => [] },
    Log: { info() {}, avis() {}, error() {} }, IA: { disponible: () => false },
    Memoria: {}, Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array
  };
  vm.createContext(srvCtx);
  vm.runInContext(srvFont.replace('var Seguiment =', 'var Seguiment ='), srvCtx);
  const servidor = srvCtx.Seguiment;

  // --- la del navegador
  /* Es talla per on comencen les utilitats i per on s'acaben les regles. El
     final era «gràfiques», i el dia que la gràfica va sortir de la vista
     —perquè el visor també la fes servir— aquest tall va deixar de trobar
     res. Ara s'agafa pel que de debò delimita el que es prova. */
  const i0 = vista.indexOf('    function coma(n, dec) {');
  const i1 = vista.indexOf('    // -------------------------------------------------------------- capçalera');
  cal('es troba la còpia del navegador dins de la vista', i0 > 0 && i1 > i0);
  const cliCtx = { Date, Math, Number, String, JSON, Object, Array };
  vm.createContext(cliCtx);
  vm.runInContext(vista.slice(i0, i1) + '\nvar __regles = Regles;', cliCtx);
  const client = cliCtx.__regles;

  /* Els casos que importen: cadascun dispara una regla diferent, i n'hi ha un
     per cada error que el motor de referència tenia. */
  const L = servidor.LLINDAR;
  const c = (data, pes, cintura, valida, forca, trail, gros, energia) =>
    ({ data, pes, cintura, cinturaValida: valida, forca, trail, trailGros: gros,
       energia: energia || '', son: '', gana: '', dieta: '' });

  const CASOS = [
    ['ritme bo', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 69.4, 84.5, true, 2, 3, 0)]],
    ['massa ràpid', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 68.5, 84, true, 2, 3, 0)]],
    ['salt impossible', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 87, 84, true, 2, 3, 0)]],
    ['senyal bo', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 70.2, 84.5, true, 2, 3, 0)]],
    ['cintura incoherent', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 70.1, 82, true, 2, 3, 0)]],
    ['poca força', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 69.5, 84.5, true, 0, 3, 0)]],
    ['trail gros', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 69.5, 84.5, true, 2, 4, 2)]],
    ['energia baixa dues vegades', [c('2026-01-02', 70, 85, true, 2, 3, 0, 'baixa'),
                                    c('2026-01-09', 69.5, 84.5, true, 2, 3, 0, 'baixa')]],
    // Els tres que el motor de Python feia malament:
    ['interval de 10 dies', [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-12', 69.3, 84.5, true, 2, 3, 0)]],
    ['cintura marcada com a dolenta', [c('2026-01-02', 70, 89, false, 2, 3, 0),
                                       c('2026-01-09', 70.1, 84, true, 2, 3, 0)]],
    ['cintura de referència vella', [c('2026-01-02', 70, 85, true, 2, 3, 0),
                                     c('2026-01-09', 69.6, null, true, 2, 3, 0),
                                     c('2026-01-16', 69.2, 84.6, true, 2, 3, 0)]]
  ];

  let iguals = 0, diferents = [];
  CASOS.forEach(([nom, h]) => {
    for (let i = 0; i < h.length; i++) {
      const s = servidor.analitza(h, i).map((a) => a.id + ':' + a.nivell).sort().join(' ');
      const n = client.analitza(h, i, L).map((a) => a.id + ':' + a.nivell).sort().join(' ');
      if (s === n) iguals++;
      else diferents.push(nom + ' [' + i + ']  servidor=«' + s + '»  navegador=«' + n + '»');
    }
    const vs = servidor.veredicte(servidor.analitza(h, h.length - 1));
    const vn = client.veredicte(client.analitza(h, h.length - 1, L));
    if (vs !== vn) diferents.push(nom + ' veredicte  servidor=«' + vs + '»  navegador=«' + vn + '»');
  });

  cal('les dues còpies donen les mateixes regles a tots els casos',
      diferents.length === 0, '\n      ' + diferents.join('\n      '));
  cal('i s\'han comparat prou casos', iguals >= 20, iguals + ' comparacions');

  /* ══════════════════════════════════════════════════════════════════════
     UN CONTROL FET UN DIA ABANS NO POT DEIXAR L'AVÍS ENCÈS TOTA LA SETMANA

     En Pol va fer el control dissabte i el dia del control passava a diumenge.
     La pregunta era la bona: «si no el responc, tindré tota la setmana l'avís
     de que no he fet el seguiment?». La resposta havia de ser que no —dissabte
     i diumenge són la mateixa setmana ISO— i ho era per a la notificació, per
     al dia i per als senyals. Però NO per a la targeta de l'inici: preguntava
     per `toca`, que vol dir «ja ha arribat el dia», i deia «pendent» en vermell
     amb el control ja fet.
     ══════════════════════════════════════════════════════════════════════ */
  {
    const controls = [{ id: 's1', data: '2026-08-08', pes: 69.5, cintura: 82.5,
                        cintura_valida: 'SI', forca: 2, trail: 3, trail_gros: 1 }];
    const plaFiles = [{ clau: 'control.dia', valor: '7' }];
    const mira = (avui) => {
      const c = {
        Utils: { avui: () => avui, talla: (s, n) => String(s).slice(0, n), esDataValida: () => true },
        Dades: { llegeix: (f) => (f === 'Seguiment' ? controls
                                : f === 'SeguimentPla' ? plaFiles : []) },
        Log: { info() {}, avis() {}, error() {} },
        IA: { disponible: () => false, motiu: () => 'x' },
        Memoria: { recorda: (a, b, fer) => fer() },
        Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array
      };
      vm.createContext(c);
      vm.runInContext(fs.readFileSync('apps-script/40_Mod_Seguiment.gs', 'utf8'), c);
      const mod = c.MODUL_SEGUIMENT();
      /* EL MATEIX FILTRE QUE FA `triggerAvisos`: `mira()` només es crida el
         dia que l'avís demana. Sense el filtre, dimecres «picaria» —perquè la
         setmana nova encara no té control— i la prova diria una cosa que no
         passa mai. */
      const a = mod.avisos[0];
      const demana = typeof a.dia === 'function' ? a.dia() : a.dia;
      const avuiDia = (new Date(avui + 'T12:00:00').getDay() + 6) % 7 + 1;
      return { targeta: mod.resumInici(),
               avis: demana === avuiDia && !!a.mira(),
               dia: mod.elDia(avui), senyals: c.Seguiment.senyals().length };
    };

    const dissabte = mira('2026-08-08');
    cal('el mateix dia que el fas, la targeta no crida i diu «avui»',
        dissabte.targeta.urgent === false && dissabte.targeta.valor === 'avui',
        JSON.stringify(dissabte.targeta));

    /* L'endemà ÉS el dia del control, però el de la setmana ja està fet. */
    const diumenge = mira('2026-08-09');
    cal('l\'endemà, que és el dia del control, la targeta segueix sense cridar',
        diumenge.targeta.urgent === false && diumenge.targeta.valor === 'fa 1 d',
        JSON.stringify(diumenge.targeta));
    cal('i l\'avís de les sis calla, perquè la setmana ja té control',
        diumenge.avis === false);
    cal('i no surt ni al dia ni als senyals',
        diumenge.dia === null && diumenge.senyals === 0);

    /* Ni la resta de la setmana. */
    const dimecres = mira('2026-08-12');
    cal('ni a mitja setmana', dimecres.targeta.urgent === false &&
        dimecres.avis === false && dimecres.senyals === 0);

    /* I el diumenge SEGÜENT sí: aquell ja és d'una altra setmana. */
    const seguent = mira('2026-08-16');
    cal('i el diumenge següent torna a reclamar, que és el que ha de fer',
        seguent.targeta.urgent === true && seguent.avis === true &&
        seguent.senyals === 1 && seguent.dia !== null,
        JSON.stringify(seguent.targeta));
  }

  /* EL DIA DEL CONTROL, EN UN SOL LLOC.
     N'hi havia dos que havien de dir el mateix: el `dia: 5` del descriptor de
     l'avís i el `control.dia` del full del pla. Mentre coincidien no es notava;
     moure'n un hauria deixat l'altre picant on no toca, i en silenci. */
  const fontSeg = fs.readFileSync('apps-script/40_Mod_Seguiment.gs', 'utf8');
  cal('el dia de l\'avís no és un número escrit al codi',
      /dia: function \(\) \{ return Seguiment\.diaDelControl\(\); \}/.test(fontSeg));
  cal('i la pantalla llegeix el mateix dia que l\'avís',
      /var diaSetmana = diaDelControl\(\);/.test(fontSeg));
  cal('i per defecte és diumenge, que és quan s\'acaba la setmana',
      /return \(d >= 1 && d <= 7\) \? d : 7;/.test(fontSeg));
  const fontMod = fs.readFileSync('apps-script/20_Moduls.gs', 'utf8');
  cal('el nucli sap demanar el dia en calent',
      /if \(typeof dia === 'function'\)/.test(fontMod));

  /* Els tres arreglos respecte del motor de referència, comprovats un per un
     perquè si algú els desfés, la prova de dalt seguiria passant —les dues
     còpies estarien igual de malament—. */
  const regles = (h, i) => servidor.analitza(h, i).map((a) => a.id);

  /* EL CAS HA DE DISTINGIR. −1,0 kg en 10 dies son −0,70/setmana: franja bona.
     Sense normalitzar —que es el que feia el motor de referencia— serien
     −1,0/setmana i saltaria «massa rapid». I al reves: −0,5 kg en 4 dies son
     −0,875/setmana, massa; sense normalitzar semblarien una setmana bona.
     Amb aquests dos, desfer l arreglo trenca la prova. */
  const deuDies = [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-12', 69, 84.5, true, 2, 3, 0)];
  cal('10 dies i −1,0 kg són −0,70/setmana, no −1,0: franja bona',
      regles(deuDies, 1).indexOf('ritme_bo') !== -1 &&
      regles(deuDies, 1).indexOf('massa_rapid') === -1,
      JSON.stringify(regles(deuDies, 1)));

  const quatreDies = [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-06', 69.5, 84.5, true, 2, 3, 0)];
  cal('4 dies i −0,5 kg són −0,875/setmana: massa, i es diu que l interval és curt',
      regles(quatreDies, 1).indexOf('massa_rapid') !== -1 &&
      regles(quatreDies, 1).indexOf('interval_rar') !== -1,
      JSON.stringify(regles(quatreDies, 1)));

  const dolenta = [c('2026-01-02', 70, 89, false, 2, 3, 0), c('2026-01-09', 70.1, 84, true, 2, 3, 0)];
  cal('una cintura marcada com a dolenta no genera cap senyal',
      regles(dolenta, 1).indexOf('senyal_bo') === -1 &&
      regles(dolenta, 1).indexOf('cintura_incoherent') === -1,
      JSON.stringify(regles(dolenta, 1)));

  const gros = [c('2026-01-02', 70, 85, true, 2, 3, 0), c('2026-01-09', 69.5, 84.5, true, 2, 4, 2)];
  cal('els dies de trail gros avisen (la regla que no s\'havia implementat mai)',
      regles(gros, 1).indexOf('trail_gros') !== -1, JSON.stringify(regles(gros, 1)));
}

// ------------------------------------------------- les fotos serveixen per a algú
/* DURANT UN ANY LES FOTOS VAN SER UNA GALERIA, i una galeria no serveix de res:
   les té al telèfon i es veu cada dia al mirall. El que no pot fer sol és posar
   la primera i l'última del mateix angle una sobre l'altra. Això prova que la
   comparació es munti així —la més vella contra la d'ara, per angle, amb les
   xifres del dia al costat— i que hi vagin imatges de debò i no una descripció
   que el model s'hauria de creure. */
console.log('\nSeguiment: les fotos es comparen, no s\'ensenyen');
{
  const font = fs.readFileSync('apps-script/40_Mod_Seguiment.gs', 'utf8');
  const srvFont = font.slice(font.indexOf('var Seguiment = (function ()'),
                             font.lastIndexOf('})();') + 5);

  /* Tres controls: el primer amb frontal i perfil, el segon sense cap, el
     tercer amb frontal i esquena. Cada angle cau en un cas diferent. */
  const files = [
    { id: 's1', data: '2026-06-05', pes: 71.4, cintura: 88, cintura_valida: 'SI',
      forca: 2, trail: 3, trail_gros: 0,
      foto_frontal: 'F1', foto_perfil: 'P1', foto_esquena: '' },
    { id: 's2', data: '2026-06-12', pes: 70.8, cintura: 86, cintura_valida: 'SI',
      forca: 2, trail: 3, trail_gros: 1,
      foto_frontal: '', foto_perfil: '', foto_esquena: '' },
    { id: 's3', data: '2026-06-19', pes: 69.9, cintura: 84, cintura_valida: 'SI',
      forca: 2, trail: 3, trail_gros: 0,
      foto_frontal: 'F3', foto_perfil: '', foto_esquena: 'E3' }
  ];

  const munta = (hiHaIA) => {
    let enviat = null, obertes = [];
    const ctx = {
      Utils: { avui: () => '2026-06-19', talla: (s, n) => String(s).slice(0, n) },
      Dades: { llegeix: (full) => (full === 'Seguiment' ? files : []) },
      Log: { info() {}, avis() {}, error() {} },
      IA: { disponible: () => hiHaIA, motiu: () => 'no hi ha clau',
            genera: (p) => { enviat = p; return { text: 'la lectura' }; } },
      DriveApp: { getFileById: (id) => { obertes.push(id); return {
        getBlob: () => ({ getContentType: () => 'image/jpeg', getBytes: () => [1, 2, 3] }) }; } },
      Utilities: { base64Encode: () => 'AQID' },
      Memoria: {}, Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array
    };
    vm.createContext(ctx);
    vm.runInContext(srvFont, ctx);
    return { S: ctx.Seguiment, dit: () => enviat, obertes };
  };

  const m = munta(true);
  const r = m.S.analitzaFotos('2026-06-19');
  const parts = m.dit().missatges[0].parts;
  const imatges = parts.filter((p) => p.inlineData);
  const textos = parts.filter((p) => p.text).map((p) => p.text);

  cal('hi van imatges de debò i no una descripció',
      imatges.length === 4 && imatges.every((p) => p.inlineData.mimeType === 'image/jpeg'),
      imatges.length + ' imatges');
  cal('i el compte que torna és el que ha enviat', r.fotos === 4, String(r.fotos));

  cal('del frontal compara la més vella amb la d\'ara',
      textos.some((t) => /de front — ABANS, 2026-06-05/.test(t)) &&
      textos.some((t) => /de front — ARA, 2026-06-19/.test(t)),
      textos.join(' | '));

  /* El control d'ara no té perfil. Comparar-lo amb res seria perdre l'angle;
     s'agafa l'última que en tingui, encara que sigui la mateixa. */
  cal('un angle sense foto en aquest control agafa l\'última que en tingui',
      textos.some((t) => /de perfil — ARA, 2026-06-05/.test(t)) &&
      !textos.some((t) => /de perfil — ABANS/.test(t)),
      textos.join(' | '));

  /* Un angle estrenat avui no té amb què comparar-se, i no s'inventa cap parella. */
  cal('un angle amb una sola foto va sol i sense parella',
      textos.filter((t) => /d'esquena/.test(t)).length === 1, textos.join(' | '));

  cal('cada foto porta les xifres del seu dia',
      /71,4 kg/.test(textos.join(' ')) && /69,9 kg/.test(textos.join(' ')),
      textos.join(' | '));

  /* La instrucció és la meitat de la feina: sense demanar-li ON mira, contesta
     el que contesten tots. I sense permís per dir «no es veu res», se n'inventa. */
  const sis = String(m.dit().sistema || '');
  cal('se li demana on mira, i que pugui dir que no veu cap canvi',
      /QUÈ HI VEUS I ON/.test(sis) && /Si no es veu cap canvi/.test(sis), sis.slice(0, 80));

  /* Un control d'un dia que no existeix no ha de petar: es mira l'últim. */
  cal('una data desconeguda cau a l\'últim control',
      munta(true).S.analitzaFotos('2020-01-01').data === '2026-06-19');

  let quePassa = '';
  try { munta(false).S.analitzaFotos('2026-06-19'); } catch (e) { quePassa = e.message; }
  cal('sense capa d\'IA ho diu en comptes de fer veure que ha mirat',
      /no hi ha clau/.test(quePassa), quePassa);

  /* EL COMENTARI DEL CONTROL: EL QUE LI ARRIBA, NO EL MODEL.
     Amb dos controls i cap objectiu no es pot dir res que un xat qualsevol no
     digui millor, i això és exactament el que en Pol va notar. El que es prova
     aquí és que hi vagi el tram sencer i el que demana la fase. */
  const ambPla = {
    'pla.resum': 'Dèficit moderat, proteïna alta, trail com a prioritat.',
    'fase.1.desde': '2026-06-01', 'fase.1.nom': 'Base', 'fase.1.objectiu': 'més magre',
    'fase.1.forca': '3', 'fase.1.trail': '4', 'fase.1.kcal': '2000'
  };
  let ditAlCoach = null;
  const ctxC = {
    Utils: { avui: () => '2026-06-19', talla: (s, n) => String(s).slice(0, n) },
    Dades: { llegeix: (full) => (full === 'Seguiment' ? files
      : Object.keys(ambPla).map((k) => ({ clau: k, valor: ambPla[k] }))) },
    Log: { info() {}, avis() {}, error() {} },
    IA: { disponible: () => true, motiu: () => null,
          genera: (p) => { ditAlCoach = p; return { text: 'el comentari' }; } },
    DriveApp: {}, Utilities: {}, Memoria: {},
    Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array
  };
  vm.createContext(ctxC);
  vm.runInContext(srvFont, ctxC);
  ctxC.Seguiment.comenta('2026-06-19');
  const quediu = String(ditAlCoach.missatges[0].parts[0].text);

  cal('al comentari hi va el tram sencer, no dos controls',
      /2026-06-05/.test(quediu) && /2026-06-12/.test(quediu) && /2026-06-19/.test(quediu),
      quediu.slice(0, 120));
  cal('i el que demana la fase, que és el que fa que un número vulgui dir alguna cosa',
      /3 sessions de força/.test(quediu) && /4 sortides de trail/.test(quediu), quediu);
  cal('i el resum del pla', /Dèficit moderat/.test(quediu));
  cal('i se li diu quin és l\'últim de la llista',
      /2026-06-19.*← aquest/.test(quediu), quediu);
  cal('i té espai per lligar-ho', ditAlCoach.maxTokens >= 500,
      String(ditAlCoach.maxTokens));

  /* LA CÀRREGA DE DEBÒ AL COSTAT DEL CONTROL.
     «3 trail» no distingeix tres sortides planes de tres amb mil sis-cents
     metres, i aquesta és justament la diferència que explica per què una
     setmana ha anat com ha anat. Aquí es prova que hi arribi —i, sobretot,
     que el seguiment segueixi sencer si el mòdul d'entrenaments no hi és: el
     que mana en aquesta pantalla és el cos, i la càrrega és context. */
  cal('sense el mòdul d\'entrenaments, el seguiment funciona igual',
      !/entrenat:/.test(quediu) && ctxC.Seguiment.pantalla().carregues &&
      Object.keys(ctxC.Seguiment.pantalla().carregues).length === 0);

  let ditAmbCarrega = null;
  const ctxE = Object.assign({}, ctxC, {
    IA: { disponible: () => true, motiu: () => null,
          genera: (p) => { ditAmbCarrega = p; return { text: 'x' }; } },
    Entrenaments: {
      sessions: () => [{ data: '2026-06-19', mena: 'trail', kmEsforc: 25 }],
      setmana: (dl) => (dl === '2026-06-15'
        ? { sessions: 3, trail: 3, forca: 0, km: 30, desnivell: 1600,
            kmEsforc: 46, llargues: 2 }
        : { sessions: 0, trail: 0, forca: 0, km: 0, desnivell: 0, kmEsforc: 0, llargues: 0 })
    }
  });
  vm.createContext(ctxE);
  vm.runInContext(srvFont, ctxE);

  const ambC = ctxE.Seguiment.pantalla().carregues;
  cal('amb el mòdul, la càrrega arriba a la pantalla per dilluns',
      ambC['2026-06-15'] && ambC['2026-06-15'].kmEsforc === 46, JSON.stringify(ambC));
  cal('i les setmanes sense cap entrenament queden a null, no a zero',
      ambC['2026-06-08'] === null || ambC['2026-06-08'] === undefined,
      JSON.stringify(ambC));

  ctxE.Seguiment.comenta('2026-06-19');
  const textC = String(ditAmbCarrega.missatges[0].parts[0].text);
  cal('i al comentari hi va la càrrega de la setmana, no el nombre de sortides',
      /entrenat: 46 km-esforç/.test(textC) && /1600 m D\+/.test(textC),
      textC.slice(0, 400));
  cal('i se li diu que no parli de sortides quan tingui la càrrega',
      /No parlis de sortides quan tinguis la càrrega/.test(String(ditAmbCarrega.sistema)));
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

// ------------------------------------------------- els entrenaments: la càrrega
/* LA QUEIXA, LITERAL: «canvia molt un entreno de 2 km amb 0 de desnivell a un de
   6 km amb 1000 de desnivell». Comptant sortides els dos són «1». Això prova que
   els quilòmetres d'esforç els separin, i que la setmana sencera també: quatre
   sortides planes contra tres amb desnivell de debò. Si algú toqués la fórmula,
   aquestes dues assercions cauen abans que ningú s'ho miri a la pantalla. */
console.log('\nEntrenaments: dues sortides no són dues sortides');
{
  const font = fs.readFileSync('apps-script/40_Mod_Entrenaments.gs', 'utf8');
  const srvFont = font.slice(font.indexOf('var Entrenaments = (function ()'),
                             font.lastIndexOf('})();') + 5);

  const munta = (files, opcions) => {
    const o = opcions || {};
    let desats = [], seguit = 0, ditAlModel = null;
    const ctx = {
      Utils: {
        avui: () => o.avui || '2026-08-03',
        talla: (s, n) => String(s).slice(0, n),
        esDataValida: (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')),
        dillunsDe: (iso) => {
          const d = new Date(iso + 'T12:00:00');
          d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          return d.toISOString().slice(0, 10);
        },
        sumaDies: (iso, n) => {
          const d = new Date(iso + 'T12:00:00');
          d.setDate(d.getDate() + n);
          return d.toISOString().slice(0, 10);
        },
        rangDates: (a, b) => {
          const l = []; let d = new Date(a + 'T12:00:00');
          const f = new Date(b + 'T12:00:00');
          while (d <= f) { l.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
          return l;
        },
        desJson: (t, x) => { try { return JSON.parse(t); } catch (e) { return x; } }
      },
      Dades: {
        llegeix: (full) => (full === 'Entrenaments' ? files
                          : full === 'EntrenamentsPassos' ? (o.passos || []) : []),
        desa: (full, fila, claus, prefix) => {
          desats.push({ full, fila });
          return { id: prefix + (++seguit) };
        },
        perId: (full, id) => files.filter((f) => f.id === id)[0] || null,
        actualitza: (full, id, canvis) => { desats.push({ full, id, canvis }); }
      },
      Log: { info() {}, avis() {}, error() {} },
      IA: {
        disponible: () => o.ia !== false, motiu: () => 'no hi ha clau',
        genera: (p) => { ditAlModel = p; return { text: o.resposta || '{}' }; }
      },
      Memoria: {}, Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array
    };
    vm.createContext(ctx);
    vm.runInContext(srvFont, ctx);
    return { E: ctx.Entrenaments, desats, dit: () => ditAlModel };
  };

  const s = (data, mena, titol, km, des, min) =>
    ({ id: 'e' + data + titol, data, mena, titol, km, desnivell: des, minuts: min,
       kcal: '', pulsacions: '', font: 'captura', notes: '' });

  /* Els dos exemples seus, clavats. */
  const dos = munta([]).E;
  cal('6 km amb 1000 de desnivell són 16 km-esforç',
      dos.kmEsforc({ km: 6, desnivell: 1000 }) === 16,
      String(dos.kmEsforc({ km: 6, desnivell: 1000 })));
  cal('i 2 km plans en són 2, o sigui vuit vegades menys',
      dos.kmEsforc({ km: 2, desnivell: 0 }) === 2,
      String(dos.kmEsforc({ km: 2, desnivell: 0 })));
  cal('una sessió de força sense km ni desnivell no en té',
      dos.kmEsforc({ km: null, desnivell: null }) === null);

  /* LA SETMANA, QUE ÉS ON ES VEIA EL FORAT. Quatre sortides planes contra tres
     amb desnivell: amb el número de sortides la primera setmana guanya. */
  const planes = munta([
    s('2026-07-20', 'trail', 'A', 5, 30, 30), s('2026-07-21', 'trail', 'B', 5, 20, 30),
    s('2026-07-22', 'trail', 'C', 6, 40, 35), s('2026-07-23', 'trail', 'D', 5, 10, 30)
  ]).E.setmana('2026-07-20');
  const dures = munta([
    s('2026-07-27', 'trail', 'A', 8, 500, 60), s('2026-07-28', 'trail', 'B', 7, 450, 55),
    s('2026-07-29', 'trail', 'C', 14, 1100, 150)
  ]).E.setmana('2026-07-27');

  cal('comptant sortides, la setmana plana en té MÉS',
      planes.sessions === 4 && dures.sessions === 3,
      planes.sessions + ' vs ' + dures.sessions);
  cal('però amb més sortides no arriba ni a la meitat de la càrrega',
      planes.kmEsforc * 2 < dures.kmEsforc,
      planes.kmEsforc + ' vs ' + dures.kmEsforc);
  cal('i la més dura de la setmana és la de catorze quilòmetres i mil cent',
      dures.mesLlarga.titol === 'C' && dures.mesLlarga.kmEsforc === 25,
      JSON.stringify(dures.mesLlarga.kmEsforc));
  cal('les que buiden es marquen: dues de les tres',
      dures.llargues === 2, String(dures.llargues));
  cal('i cap de les planes no ho és', planes.llargues === 0);

  // -------------------------------------------------------------- la captura
  /* LA PROPIETAT QUE NO ES POT PERDRE MAI: llegir una captura no escriu res.
     Una lectura d'imatge s'equivoca en silenci, i una xifra falsa dins de la
     sèrie se la creuen les regles i les gràfiques. */
  const bo = JSON.stringify({ sessions: [
    { data: '2026-07-28', mena: 'trail', titol: 'Sèries', km: 7.8, desnivell: 480, minuts: 62 },
    { data: null, mena: 'trail', titol: 'Sense dia', km: 5, desnivell: 100, minuts: 30 },
    { data: '2025-07-29', mena: 'forca', titol: 'Any mal llegit', km: null, desnivell: null, minuts: 40 }
  ], avis: '' });

  const cap = munta([], { resposta: bo });
  const r = cap.E.llegeixCaptura({ contingut: 'data:image/jpeg;base64,AQID',
                                   mena: 'trail', dilluns: '2026-07-27' });

  cal('llegir una captura no escriu absolutament res', cap.desats.length === 0,
      JSON.stringify(cap.desats));
  cal('i torna una sessió per fila llegida', r.sessions.length === 3,
      String(r.sessions.length));
  cal('la que porta dia bo no és dubtosa i ja té la seva càrrega',
      r.sessions[0].dubtosa === false && r.sessions[0].kmEsforc === 12.6,
      JSON.stringify(r.sessions[0]));
  cal('la que no té dia queda marcada, no se n\'hi inventa cap',
      r.sessions[1].dubtosa === true && r.sessions[1].data === null);
  /* L any mal llegit es el error tipic d aquestes pantalles: no hi surt mai. */
  cal('i una data fora de la setmana que s\'importa també queda marcada',
      r.sessions[2].dubtosa === true && r.sessions[2].data === '2025-07-29');

  /* I se li ha de DEMANAR que no endevini: sense aquesta frase, omple el buit. */
  const demanat = cap.dit().missatges[0].parts[0].text;
  cal('al model se li diu que deixi la data en blanc si no la sap',
      /posa null\. No l'endevinis/.test(demanat) || /No l'endevinis/.test(demanat), demanat.slice(0, 200));
  cal('i que la imatge hi va de debò',
      cap.dit().missatges[0].parts.some((x) => x.inlineData));
  cal('i que contesti JSON i res més', cap.dit().json === true);

  /* Confirmar sí que escriu, i només el que porta dia. */
  const conf = munta([], {});
  const x = conf.E.confirmaCaptura({ sessions: [
    { data: '2026-07-28', mena: 'trail', titol: 'Sèries', km: 7.8, desnivell: 480, minuts: 62 },
    { data: null, mena: 'trail', titol: 'Sense dia', km: 5 }
  ] });
  cal('confirmar-la desa només les que tenen dia',
      x.desats === 1 && conf.desats.length === 1, JSON.stringify(x));
  cal('i queden marcades com a vingudes d\'una captura',
      conf.desats[0].fila.font === 'captura');

  let quePassa = '';
  try { munta([], { ia: false }).E.llegeixCaptura({ contingut: 'x', mena: 'trail' }); }
  catch (e) { quePassa = e.message; }
  cal('sense capa d\'IA no es fa veure que ha llegit res', /no hi ha clau/.test(quePassa),
      quePassa);

  /* «HE MIRAT LA IMATGE I NO HI HA RES» NO ÉS UNA AVARIA: és l'únic final que
     vol dir que tot el camí ha anat bé. Va marcat a l'error i no al text del
     missatge, perquè la comprovació d'instal·lació comparava cadenes —buscava
     «no he sabut veure» i el missatge diu «no HI he sabut veure»— i donava per
     fallat el cas bo amb un consell equivocat a sota. */
  const buides = [
    ['cap entrenament', 'trail', JSON.stringify({ sessions: [], avis: '' })],
    ['cap xifra de passos', 'passos', JSON.stringify({ passos: {}, avis: '' })]
  ];
  buides.forEach(([nom, mena, resposta]) => {
    let err = null;
    try {
      munta([], { resposta }).E.llegeixCaptura({ contingut: 'data:image/png;base64,AQID', mena });
    } catch (e) { err = e; }
    cal('una captura sense ' + nom + ' es distingeix d\'una avaria',
        err && err.buida === true, err ? err.message : 'no ha petat');
  });

  let real = null;
  try { munta([], { resposta: 'no és json' }).E.llegeixCaptura({ contingut: 'x', mena: 'trail' }); }
  catch (e) { real = e; }
  cal('i una avaria de debò NO porta la marca', real && !real.buida,
      real ? real.message : 'no ha petat');

  /* I la comprovació d'instal·lació ha de mirar la marca, no el text. */
  const inst = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  cal('la comprovació d\'instal·lació mira la marca i no el missatge',
      /if \(err\.buida\)/.test(inst) && !/no he sabut veure cap entrenament/.test(inst));

  /* TREURE-NE UNA LA DEIXA SENSE DIA, i una fila sense dia no és de cap
     setmana. Si passa el filtre, `dillunsDe('')` no és cap dilluns i les
     sèries peten senceres: una setmana amb una sessió esborrada s'enduria la
     pantalla d'entrenaments i la de relacions. */
  const ambTreta = munta([
    s('2026-07-28', 'trail', 'A', 8, 500, 60),
    { id: 'e0', data: '', mena: 'trail', titol: '(esborrada) B', km: 5,
      desnivell: 100, minuts: 30, kcal: '', pulsacions: '', font: 'ma', notes: '' }
  ], {}).E;
  cal('una sessió treta no compta enlloc', ambTreta.sessions().length === 1,
      JSON.stringify(ambTreta.sessions().map((x) => x.data)));
  let peta = '';
  try { ambTreta.seriesDiaries('2026-07-06', '2026-08-02'); }
  catch (e) { peta = e.message; }
  cal('i no fa petar les sèries', peta === '', peta);

  // --------------------------------------------------------------- els passos
  const pas = munta([], {});
  const p1 = pas.E.desaPassos({ dilluns: '2026-07-27', total: 81250 });
  cal('amb el total de la setmana, la mitjana surt sola', p1.mitjana === 11607,
      String(p1.mitjana));
  const p2 = munta([], {}).E.desaPassos({ dilluns: '2026-07-27', mitjana: 10000 });
  cal('i amb la mitjana, el total', p2.total === 70000, String(p2.total));

  // ------------------------------------------------- el que es pot creuar
  /* Un dimarts sense sortida d'una setmana importada és descans i val zero. Un
     dimarts d'una setmana que no has importat mai no és un zero: no se sap. */
  const ser = munta([s('2026-07-21', 'trail', 'Z', 4, 100, 25),
                     s('2026-07-28', 'trail', 'A', 8, 500, 60)], {
    passos: [{ id: 'p1', dilluns: '2026-07-27', total: 81250, mitjana: 11607, font: 'captura' }]
  }).E.seriesDiaries('2026-07-06', '2026-08-02');
  const carrega = ser.filter((x) => x.id === 'esforc')[0];
  /* Quatre setmanes al rang i només dues importades: catorze dies, no vint-i-vuit. */
  cal('només compten els dies de setmanes que has importat',
      carrega && Object.keys(carrega.dies).length === 14,
      carrega ? String(Object.keys(carrega.dies).length) : 'no hi és');
  cal('i dins d\'aquella setmana, un dia sense sortida sí que és un zero',
      carrega && carrega.dies['2026-07-29'] === 0 && carrega.dies['2026-07-28'] === 13,
      carrega ? JSON.stringify(carrega.dies) : '');
}

// -------------------------- la imatge de prova de provaEntrenaments() és una imatge
/* La comprovació d'entrenaments envia una imatge de debò al model per veure si
   la clau i el model accepten imatges. Va escrita al codi en base64 i partida en
   tres línies perquè hi càpiga, i partir-la és exactament com es trenca: una
   línia reflowada i el que arriba és una cadena que no és cap PNG. Llavors la
   comprovació falla i sembla que falli el model.
   Això la torna a muntar i la desxifra: capçalera, mida i el bloc de píxels. */
console.log('\nLa imatge de prova dels entrenaments encara és un PNG');
{
  const s = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  const i = s.indexOf("var PROVA = 'data:image/png;base64,'");
  cal('es troba la imatge de prova dins de la comprovació', i > 0);

  const tros = s.slice(i, s.indexOf("';\n", i + 40) + 2);
  const parts = [...tros.matchAll(/'([^']*)'/g)].map((x) => x[1]);
  const buf = Buffer.from(parts.slice(1).join(''), 'base64');

  cal('i porta la signatura d\'un PNG', buf.slice(1, 4).toString() === 'PNG',
      buf.slice(0, 8).toString('hex'));
  const ample = buf.readUInt32BE(16), alt = buf.readUInt32BE(20);
  /* Un píxel el rebutgen: ha de ser prou gran per ser una imatge de debò. */
  cal('i és prou grossa perquè el model l\'accepti', ample >= 8 && alt >= 8,
      ample + 'x' + alt);

  const idat = buf.indexOf(Buffer.from('IDAT')) + 4;
  let pixels = 0;
  try { pixels = zlib.inflateSync(buf.slice(idat, idat + buf.readUInt32BE(idat - 8))).length; }
  catch (e) { pixels = -1; }
  cal('i els píxels es descomprimeixen: no s\'ha partit malament',
      pixels === alt * (1 + ample * 3), String(pixels));
}

// ------------------------------------------- la pantalla del seguiment, per parts
/* Les quatre coses que en Pol va dir que no li feien el pes, cadascuna amb la
   seva prova. Són de forma i no de càlcul, però són exactament el que va fallar:
   una etiqueta que no volia dir res, unes fotos sempre a la vista, una lectura
   que no existia i el trail com a lletra petita. */
console.log('\nSeguiment: la pantalla diu el que ha de dir');
{
  const v = fs.readFileSync('apps-script/vista_seguiment.html', 'utf8');
  const e = fs.readFileSync('apps-script/ui_estil.html', 'utf8');

  cal('«De grosses» ja no és l\'etiqueta de res', !/De grosses/.test(v));
  cal('i el camp diu què és una sortida llarga al costat del camp',
      /Llargues<\/label>/.test(v) && /que et deixen buit/.test(v));

  cal('les fotos comencen amagades', /var fotosObertes = false;/.test(v) &&
      /id="seg-tires"' \+ \(fotosObertes \? '' : ' hidden'\)/.test(v));
  cal('i hi ha un botó que les ensenya i les torna a amagar',
      /data-ulls/.test(v) && /aria-expanded/.test(v) && /Amaga-les/.test(v));
  /* Amagades vol dir amagades de debò: sense `src` no hi ha cap petició a
     Google, i no depèn de si el navegador carrega el que no es veu. */
  cal('i amagades no es demanen a Google fins que s\'obren',
      /\(fotosObertes \? 'src' : 'data-src'\)/.test(v) &&
      /img\[data-src\]/.test(v) && /im\.src = im\.dataset\.src/.test(v));

  /* La lectura ha d'anar ABANS de les imatges: és el que ha de sortir de
     fer-se les fotos. Si va darrere, per llegir-la has de passar per elles. */
  cal('la lectura va abans de les imatges, no darrere',
      v.indexOf('data-mira="') < v.indexOf("id=\"seg-tires\"") &&
      v.indexOf('data-mira="') > 0);
  cal('i la demana al servidor i la desa al telèfon',
      /crida\('seguiment', 'analitzaFotos'/.test(v) && /Cau\.set\('seg\.ullada\.'/.test(v));
  cal('canviar una foto llença les lectures desades',
      (v.match(/Cau\.oblida\('seg\.ullada\.'\)/g) || []).length === 2);

  cal('el trail té columna pròpia al resum de la setmana',
      /xifra\('Trail'/.test(v) && /xifra\('Pes'/.test(v) &&
      /xifra\('Cintura'/.test(v) && /xifra\('Força'/.test(v));
  cal('i ja no penja com a lletra petita de la força',
      !/cur\.trail \+ ' trail'/.test(v));
  cal('i quatre columnes no s\'escanyen al mòbil',
      /\.seg-xifres \{ display: grid; grid-template-columns: repeat\(2, 1fr\)/.test(e) &&
      /min-width: 420px\) \{ \.seg-xifres \{ grid-template-columns: repeat\(4, 1fr\)/.test(e));
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
  cal('es troben les pantalles registrades', vistes.size >= 8, [...vistes].join(', '));

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
  cal('es troben les notificacions del codi', destins.length >= 7, destins.length + ' trobades');

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
  cal('es miren totes les notificacions del codi', mirades >= 9, mirades + ' mirades');
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
  cal('es troben els títols escrits al codi', titols.length >= 4, titols.length + ' trobats');
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


// ------------------------------------------------ el repàs de demà, a les 23:30
/* No inventa res: demana als mòduls el mateix que la pàgina del dia però amb
   la data de demà. Per això el que s'ha de comprovar és que pregunti pel dia
   bo, que un mòdul nou hi surti sol, i que si demà no hi ha res no piqui. */
console.log('\nEl repàs de demà: què tens i què no cal dir-te');
{
  const ctx = carregaTotElServidor();
  ctx.Utilities.formatDate = (d) => d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  ctx.Config = { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, d) => d };
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Utils.avui = () => '2026-08-06';

  let enviades = [];
  ctx.Notifica = { junta: (a, b) => a + b, disponible: () => true, motiu: () => '',
                   dispositius: () => [{}],
                   envia: (t, c, o) => { enviades.push({ t, c, url: o.url }); return { enviades: 1 }; } };

  ctx.Moduls = { elDia: (d) => { ctx.__data = d; return [
    { titol: 'Al calendari', coses: [{ text: '09:00 Claustre' }, { text: '17:00 Reunió' }] },
    { titol: 'Tasques', coses: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }, { text: 'e' }] }
  ]; } };
  ctx.triggerDema();

  cal('pregunta pel dia de DEMÀ, no per avui', ctx.__data === '2026-08-07', String(ctx.__data));
  cal('el títol diu quina pantalla obre i quin dia',
      enviades.length === 1 && enviades[0].t === 'El dia · demà',
      JSON.stringify(enviades[0]));
  cal('el cos porta un bloc per línia',
      enviades[0].c.split('\n').length === 2, JSON.stringify(enviades[0].c));
  cal('i talla les llistes llargues dient quantes en queden',
      /i 1 més/.test(enviades[0].c), enviades[0].c);
  cal('i tocar-la obre el dia de demà, no el d\'avui',
      enviades[0].url === './#dia:2026-08-07', enviades[0].url);

  enviades = [];
  ctx.Moduls = { elDia: () => [] };
  ctx.triggerDema();
  cal('si demà no hi ha res, NO pica', enviades.length === 0, String(enviades.length));

  ctx.Moduls = { elDia: () => { throw new Error('el full no hi és'); } };
  let petat = false;
  try { ctx.triggerDema(); } catch (e) { petat = true; }
  cal('i si alguna cosa peta, no tomba el trigger', !petat);

  /* EL BANC I EL PATRIMONI, tal com arriben. Els dos deien alguna cosa dues
     vegades: el banc repetia «moviments» tres cops en dues frases i el
     patrimoni escrivia el nom del valor abans i dins del detall. */
  ctx.Notifica.junta = (a, b) => (!a ? b : !b ? a : a + '. ' + b);
  ctx.ambBloqueig_ = (fn) => fn();
  ctx.Finances = { eur: (n) => n.toFixed(2).replace('.', ',') + ' €',
                   generaRecurrents: () => [] };
  ctx.FinancesBanc = { disponible: () => true,
                       sincronitzaSiCal: () => ({ nous: 5, perRevisar: 3, jaSabuts: 2 }) };
  enviades = [];
  ctx.triggerBanc();
  cal('el banc diu què has de fer i d\'on surt, sense repetir-se',
      enviades[0].t === 'Finances · banc' &&
      enviades[0].c === '3 moviments per classificar. N\'han entrat 5 i de 2 ja sabia què eren.',
      JSON.stringify(enviades[0]));

  ctx.FinancesBanc.sincronitzaSiCal = () => ({ nous: 1, perRevisar: 1, jaSabuts: 0 });
  enviades = [];
  ctx.triggerBanc();
  cal('i si tots els que entren són per classificar, no ho diu dues vegades',
      enviades[0].c === '1 moviment nou per classificar.', enviades[0].c);

  ctx.Finances.patrimoni = () => ({ total: 12345.6, actius: [{ nom: 'El pis', dies: 40 }] });
  enviades = [];
  ctx.triggerPatrimoni();
  cal('amb un sol valor, el patrimoni no escriu el nom dues vegades',
      enviades[0].t === 'Finances · patrimoni' &&
      enviades[0].c === 'Toca actualitzar El pis (fa 40 dies). Ara mateix tens anotat 12345,60 €.',
      JSON.stringify(enviades[0]));

  /* Els mòduls que no tenen res a dir d'un dia futur han de callar ells
     mateixos: si no, el repàs de la nit et diria «et falten 9 hàbits» cada
     nit, que és evident i no és cap informació. */
  const habits = fs.readFileSync('apps-script/40_Mod_Habits.gs', 'utf8');
  const diari = fs.readFileSync('apps-script/40_Mod_Diari.gs', 'utf8');
  const callaAlFutur = (t) => {
    const i = t.indexOf('elDia: function (data) {');
    return i !== -1 && t.slice(i, i + 400).indexOf('data > Utils.avui()') !== -1;
  };
  cal('els hàbits callen per a un dia que no ha arribat', callaAlFutur(habits));
  cal('i el diari també', callaAlFutur(diari));

  /* I que el hash sàpiga portar la data, que és el que ho lliga tot: sense
     això la notificació t'obriria el dia d'avui, que és justament el dia del
     qual NO et parlava. */
  const app = fs.readFileSync('apps-script/ui_app.html', 'utf8');
  const tros = app.slice(app.indexOf('    deLAdreca: function (hash) {'),
                         app.indexOf('    ves: function (id, params'));
  const c2 = { String, RegExp };
  vm.createContext(c2);
  vm.runInContext('var App = { ' + tros.replace(/,\s*$/, '') + ' };', c2);
  cal('«#dia:2026-08-07» obre aquell dia',
      c2.App.deLAdreca('#dia:2026-08-07').params.data === '2026-08-07');
  cal('«#dia» a seques obre avui, sense inventar-se cap data',
      c2.App.deLAdreca('#dia').params.data === undefined);
  cal('i el que no és una data s\'ignora en comptes de petar',
      c2.App.deLAdreca('#dia:dema').params.data === undefined &&
      c2.App.deLAdreca('#dia:2026-8-7').params.data === undefined);
}

/* -------------------------------------------------- el client també la porta
   El servidor ja no deixa entrar sense clau. Si el client de dins d'Apps
   Script no l'envia —o l'envia on no toca— l'app es queda muda contra el seu
   propi servidor, i això no ho veuria cap prova del servidor. */
console.log('\nEl client: la clau va davant a les dues bandes');
{
  const app = fs.readFileSync('apps-script/ui_app.html', 'utf8');

  const local = app.slice(app.indexOf('function cridaLocal_'), app.indexOf('function cridaRemota_'));
  cal('la crida de dins passa la clau com a primer argument',
      /\.api\(clau,\s*modul,\s*accio/.test(local), local.slice(-200));
  cal('i si no en té, ni ho intenta',
      /senseServidor\s*=\s*true/.test(local) && local.indexOf('Servidor.clau()') !== -1);

  const remota = app.slice(app.indexOf('function cridaRemota_'), app.indexOf('function crida('));
  cal('la crida de fora també la porta', /clau:\s*cfg\.clau/.test(remota));

  cal('i totes dues saben reconèixer que la clau no és bona',
      (local.match(/clauDolenta/g) || []).length >= 1 &&
      (remota.match(/clauDolenta/g) || []).length >= 1);

  /* `llest()` és qui decideix si cal demanar-la: dins d'Apps Script no fa
     falta adreça, però la clau sí. */
  const servidor = app.slice(app.indexOf('var Servidor = {'), app.indexOf('function cridaLocal_'));
  const c3 = { dinsAppsScript: () => true, Cau: { get: () => ({ clau: 'x' }) } };
  vm.createContext(c3);
  vm.runInContext(servidor + '\n;', c3);
  cal('amb clau i sense adreça, dins d\'Apps Script ja està llest',
      c3.Servidor.llest() === true);
  c3.Cau.get = () => ({ url: 'https://x/exec' });
  cal('amb adreça i sense clau, no', c3.Servidor.llest() === false);
  c3.dinsAppsScript = () => false;
  c3.Cau.get = () => ({ clau: 'x' });
  cal('i servit de fora, amb clau però sense adreça, tampoc',
      c3.Servidor.llest() === false);

  /* I que la pantalla d'error tingui sortida: sense servidor ha d'oferir
     connectar, no un «torna-ho a provar» que tornarà a fallar. */
  const comp = app.slice(app.indexOf('    error: function (err, reintenta)'),
                         app.indexOf('    avis: function (titol, text)'));
  cal('sense servidor, l\'error ofereix connectar', /data-connecta-ara/.test(comp));
  cal('i sempre hi ha una porta de sortida a l\'índex', /data-va-inici/.test(comp));
  cal('i qui escolta aquests dos botons existeix',
      /\[data-connecta-ara\]/.test(app) && /\[data-va-inici\]/.test(app));
}

// ------------------------------------- les tasques, ara que manen les de Google
/* El full ja no és qui les guarda: les tasques són de Google Tasks i el full
   només diu quines llistes mires i les dues coses que Google no sap desar
   —prioritat i «hi estic»—. Aquí es prova amb un Google de mentida a sota,
   perquè el que s'ha de comprovar és el que decideix el nostre codi: on cau el
   que apuntes, com s'ordena, què passa quan mous una tasca de llista, i que si
   el permís no hi és no caigui res més. */
console.log('\nLes tasques: Google mana, i el full només hi posa el que ell no sap');
{
  const ctx = carregaTotElServidor();
  const AVUI = '2026-08-04';
  ctx.Utils.avui = () => AVUI;
  ctx.Utils.faQuant = () => 'fa uns dies';
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.CacheService = { getScriptCache: () => ({ get: () => null, put() {} }) };

  // --- el full, en memòria
  const fulls = { LlistesTasques: [], TasquesMarques: [] };
  let seguit = 0;
  ctx.Dades = {
    llegeix: (full) => JSON.parse(JSON.stringify(fulls[full] || [])),
    un: (full, q) => (fulls[full] || []).filter(
      (f) => Object.keys(q).every((k) => f[k] === q[k]))[0] || null,
    perId: (full, id) => (fulls[full] || []).filter((f) => f.id === id)[0] || null,
    insereix: (full, fila, prefix) => {
      const f = Object.assign({ id: fila.id || (prefix || 'x') + (++seguit) }, fila);
      fulls[full].push(f);
      return f;
    },
    actualitza: (full, id, canvis) => {
      const f = (fulls[full] || []).filter((x) => x.id === id)[0];
      if (!f) return null;
      Object.assign(f, canvis);
      return f;
    }
  };

  // --- el Google Tasks de mentida
  const llistes = [{ id: 'L1', title: 'Meves tasques' }, { id: 'L2', title: 'Docència' }];
  const tasques = {
    L1: [{ id: 'g1', title: 'Trucar al taller', status: 'needsAction' }],
    L2: [
      { id: 'g2', title: 'Corregir els controls', status: 'needsAction',
        due: '2026-08-01T00:00:00.000Z' },
      { id: 'g3', title: 'Preparar la reunió', status: 'needsAction' },
      { id: 'g4', title: 'Enviar les notes', status: 'completed',
        completed: '2026-08-03T10:00:00.000Z' }
    ]
  };
  let idNou = 100;
  ctx.Tasks = {
    Tasklists: {
      list: () => ({ items: llistes.map((l) => ({ id: l.id, title: l.title })) }),
      get: () => ({ id: 'L1', title: 'Meves tasques' })
    },
    Tasks: {
      list: (llista, p) => ({
        items: (tasques[llista] || []).filter(
          (t) => (p && p.showCompleted) || t.status !== 'completed')
      }),
      get: (llista, id) => {
        const t = (tasques[llista] || []).filter((x) => x.id === id)[0];
        return t ? JSON.parse(JSON.stringify(t)) : null;
      },
      insert: (t, llista) => {
        const nova = Object.assign({ id: 'g' + (++idNou), status: 'needsAction' }, t);
        (tasques[llista] = tasques[llista] || []).push(nova);
        return nova;
      },
      update: (t, llista, id) => {
        tasques[llista] = (tasques[llista] || []).map((x) => (x.id === id ? t : x));
        return t;
      },
      remove: (llista, id) => {
        tasques[llista] = (tasques[llista] || []).filter((x) => x.id !== id);
      }
    }
  };

  // --- les llistes
  const sinc = ctx.Tasques.sincronitzaLlistes();
  cal('llegeix les teves llistes de Google i les apunta', sinc.total === 2 && sinc.nous === 2,
      JSON.stringify(sinc));
  cal('i les noves s\'encenen soles', ctx.Tasques.llistes().every((l) => l.mostra));

  ctx.Tasques.mostra('L2', false);
  cal('apagar-ne una la treu de la pantalla',
      ctx.Tasques.pantalla({}).blocs.length === 1);
  ctx.Tasques.sincronitzaLlistes();
  cal('i tornar a llegir-les de Google NO te la torna a encendre',
      ctx.Tasques.llistes().filter((l) => l.id === 'L2')[0].mostra === false);
  ctx.Tasques.mostra('L2', true);

  // --- la pantalla
  const p = ctx.Tasques.pantalla({});
  cal('una caixa per llista', p.blocs.length === 2 &&
      p.blocs.map((b) => b.nom).join('|') === 'Meves tasques|Docència',
      JSON.stringify(p.blocs.map((b) => b.nom)));
  cal('les fetes no surten amb les pendents',
      p.tasques.every((t) => t.text !== 'Enviar les notes'));
  cal('la que ja ha vençut es marca com a vençuda',
      p.tasques.filter((t) => t.text === 'Corregir els controls')[0].vencuda === true);
  cal('i el venciment de Google es llegeix com el dia que és, sense saltar-ne cap',
      p.tasques.filter((t) => t.text === 'Corregir els controls')[0].vencEl === '2026-08-01');
  cal('dins la caixa, primer el que venç i al final el que no té data',
      p.blocs[1].tasques[0].text === 'Corregir els controls', JSON.stringify(p.blocs[1].tasques));

  // --- apuntar
  const nova = ctx.Tasques.captura('Comprar cartolines');
  cal('el que apuntes cau a la llista principal, sense preguntar res',
      nova.llista === 'L1' && tasques.L1.filter((t) => t.id === nova.id).length === 1);

  // --- la prioritat, que és nostra
  ctx.Tasques.edita({ id: nova.id, llista: 'L1', prioritat: true });
  const ambPrio = ctx.Tasques.pantalla({}).tasques.filter((t) => t.id === nova.id)[0];
  cal('la prioritat es desa al nostre full i torna amb la tasca',
      ambPrio.prioritat === 'alta' && fulls.TasquesMarques.length === 1,
      JSON.stringify(fulls.TasquesMarques));
  cal('i no s\'escriu res del text de la tasca al nostre full: si el perds, no perds cap tasca',
      Object.keys(fulls.TasquesMarques[0]).indexOf('text') === -1,
      JSON.stringify(Object.keys(fulls.TasquesMarques[0])));

  // --- moure de llista
  /* Google no sap moure una tasca de llista: se'n fa una de nova i s'esborra la
     vella, o sigui que canvia d'id. Si la marca no el segueix, la prioritat es
     queda enganxada a una tasca que ja no existeix. */
  const moguda = ctx.Tasques.edita({ id: nova.id, llista: 'L1', llistaNova: 'L2' });
  cal('moure-la de llista la treu de la vella i la posa a la nova',
      tasques.L1.filter((t) => t.id === nova.id).length === 0 &&
      tasques.L2.filter((t) => t.id === moguda.id).length === 1);
  cal('i la prioritat la segueix encara que Google li canviï l\'id',
      ctx.Tasques.pantalla({}).tasques.filter((t) => t.id === moguda.id)[0].prioritat === 'alta',
      JSON.stringify(fulls.TasquesMarques));

  // --- completar
  ctx.Tasques.completa('g2', 'L2');
  cal('completar-la la treu de les pendents',
      ctx.Tasques.pantalla({}).tasques.every((t) => t.id !== 'g2'));
  cal('i la trobes a les fetes, no esborrada',
      ctx.Tasques.fetes({}).fetes.filter((t) => t.id === 'g2').length === 1);
  ctx.Tasques.completa('g2', 'L2', true);
  cal('i es pot desfer', ctx.Tasques.pantalla({}).tasques.filter((t) => t.id === 'g2').length === 1);

  // --- treure
  ctx.Tasques.treu('g3', 'L2');
  cal('treure-la l\'esborra de Google de debò', tasques.L2.every((t) => t.id !== 'g3'));

  // --- la pàgina del dia
  const dia = ctx.MODUL_TASQUES().elDia(AVUI);
  cal('a la pàgina del dia hi surt el que ha vençut i el d\'avui',
      dia && dia.coses.length > 0, JSON.stringify(dia));
  cal('i del futur no en diu res', ctx.MODUL_TASQUES().elDia('2026-08-09') === null);

  // --- sense permís
  /* El permís es dóna un cop i pot no estar-hi encara. Si Google diu que no,
     això no pot tombar la pàgina del dia ni els avisos: cadascú se n'aparta. */
  ctx.Tasks.Tasks.list = () => { throw new Error('Authorization required'); };
  const sensePermis = ctx.Tasques.pantalla({});
  cal('si Google encara no li dóna permís, ho diu i no peta',
      sensePermis.hiHaServei === false && sensePermis.tasques.length === 0,
      JSON.stringify(sensePermis).slice(0, 120));
  cal('i llavors la pàgina del dia calla en comptes de caure',
      ctx.MODUL_TASQUES().elDia(AVUI) === null);
  cal('i la fitxa de la IA també', ctx.MODUL_TASQUES().contextIA() === '');

  delete ctx.Tasks;
  cal('i si el servei ni tan sols hi és, igual',
      ctx.Tasques.pantalla({}).hiHaServei === false &&
      ctx.MODUL_TASQUES().elDia(AVUI) === null);
}

// ---------------------- obrir l'app no pot construir res que costi segons
/* Mesurat el 4 d'agost del 2026 a l'app d'en Pol: `nucli.inici` trigava entre
   8 i 16 segons, i el registre en tenia quinze de seguits. D'aquells, 6,5 s
   eren la targeta del calendari i 2 s la de tasques: cadascuna construïa allà
   mateix el que necessitava —tres mesos de totes les agendes, una volta a
   l'API de Tasks per llista— mentre ell mirava la pantalla.
   Ara les targetes NO construeixen res: agafen el que hi ha desat i, si no hi
   ha res, tornen l'última que es va poder fer. Qui ho munta és el trigger.
   Això comprova precisament això: amb la memòria cau buida, demanar la targeta
   no pot tocar ni Google Calendar ni Google Tasks. */
console.log('\nObrir l\'app: les targetes no poden anar a buscar res a Google');
{
  const ctx = carregaTotElServidor();
  ctx.Utils.avui = () => '2026-08-04';
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Config = { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, d) => d };

  // Una memòria cau buida que apunta tot el que li demanen.
  const desat = {};
  ctx.CacheService = { getScriptCache: () => ({
    get: (k) => (desat[k] === undefined ? null : desat[k]),
    put: (k, v) => { desat[k] = v; },
    remove: (k) => { delete desat[k]; }
  }) };

  // Si algú toca Google, ho sabrem.
  let tocatCalendar = 0, tocatTasks = 0;
  ctx.CalendarApp = {
    getAllCalendars: () => { tocatCalendar++; return []; },
    getCalendarById: () => { tocatCalendar++; return null; },
    getDefaultCalendar: () => { tocatCalendar++; return { getId: () => 'x' }; }
  };
  ctx.Tasks = {
    Tasklists: { list: () => { tocatTasks++; return { items: [] }; },
                 get: () => { tocatTasks++; return { id: 'x' }; } },
    Tasks: { list: () => { tocatTasks++; return { items: [] }; } }
  };
  ctx.Dades = {
    llegeix: () => [], un: () => null, perId: () => null,
    insereix: (f, x) => x, actualitza: () => null
  };
  ctx.CalendariPont = { hiEs: () => false };
  ctx.Utilities.formatDate = (d) => d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

  const tCal = ctx.MODUL_CALENDARI().resumInici();
  cal('amb la memòria cau buida, la targeta del calendari no truca a Google',
      tocatCalendar === 0, 'l\'ha tocat ' + tocatCalendar + ' vegades');
  cal('i tot i així torna una targeta que es pot pintar',
      !!tCal && tCal.accio === 'calendari', JSON.stringify(tCal));

  const tTas = ctx.MODUL_TASQUES().resumInici();
  cal('amb la memòria cau buida, la targeta de tasques no truca a Google',
      tocatTasks === 0, 'l\'ha tocat ' + tocatTasks + ' vegades');
  cal('i tot i així torna una targeta que es pot pintar',
      !!tTas && tTas.accio === 'tasques', JSON.stringify(tTas));

  /* I qui SÍ que hi va és l'escalfor, que corre des d'un trigger. Si això
     deixés d'anar-hi, les targetes es quedarien velles per sempre i ningú se
     n'assabentaria: per això es comprova que hi vagi. */
  ctx.MODUL_CALENDARI().escalfa();
  cal('l\'escalfor sí que va a buscar el calendari', tocatCalendar > 0);
  ctx.MODUL_TASQUES().escalfa();
  cal('i les tasques també', tocatTasks > 0);

  /* El trigger no pot saltar-se cap mòdul que sàpiga escalfar-se: era
     exactament el que passava —`triggerEscalfa` es saltava els volàtils, que
     són els cars—, i per això obrir l'app trigava el que trigava. */
  const inst = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  cal('hi ha un trigger per al que es llegeix de fora',
      /function triggerEscalfaFora\(\)/.test(inst));
  cal('i s\'instal·la sol amb els altres',
      /newTrigger\('triggerEscalfaFora'\)/.test(inst));

  const capEscalfa = ['40_Mod_Calendari.gs', '40_Mod_Tasques.gs']
    .filter((f) => !/escalfa: function/.test(fs.readFileSync('apps-script/' + f, 'utf8')));
  cal('i els dos mòduls que llegeixen de fora saben escalfar-se',
      capEscalfa.length === 0, capEscalfa.join(', '));
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

  const AVUI = '2026-08-04';
  const clau = (m) => c2.P.clauDe(m, AVUI);

  /* Què llegeix cada vista de debò, tret del seu propi codi. */
  const llegeix = (fitxer, expressio) => {
    const s = fs.readFileSync('apps-script/' + fitxer, 'utf8');
    return expressio(s);
  };

  const esperat = {
    habits: 'habits.' + AVUI,
    tasques: 'tasques.llista',
    seguiment: 'seguiment',
    diari: 'diari.' + AVUI,
    nutricio: 'nutricio.dia.' + AVUI,
    finances: 'finances.mes.ara',
    calendari: 'calendari.2026-08'
  };
  Object.keys(esperat).forEach((m) => {
    cal('la clau de ' + m + ' és la que espera la seva vista',
        clau(m) === esperat[m], clau(m) + ' ≠ ' + esperat[m]);
  });

  /* ELS HÀBITS ES DESEN PARTITS. La seva resposta porta el dia i el full del
     mes, i cadascun va a la seva clau. La precàrrega hi va desar la resposta
     sencera i la pantalla petava en obrir-la: «Cannot read properties of
     undefined». Aquí es comprova que la precàrrega ho parteixi igual, i que la
     vista no es refiï del que hi trobi. */
  const desa = app.slice(app.indexOf('    desa: function (modul, dades, avui) {'),
                         app.indexOf('  var Cua = {'));
  cal('la precàrrega desa el dia dels hàbits, no la resposta sencera',
      /Cau\.set\('habits\.' \+ avui, dades\.dia\)/.test(desa));
  cal('i el full del mes a la seva clau',
      /Cau\.set\('habits\.mes', dades\.mes\)/.test(desa));
  const vh = fs.readFileSync('apps-script/vista_habits.html', 'utf8');
  cal('i la vista no pinta una còpia desada que no sigui un dia',
      /if \(cau && !Array\.isArray\(cau\.habits\)\) cau = null;/.test(vh));

  /* I la del calendari, a més, ha de sortir de la MATEIXA funció que fa servir
     la vista per desar i per llegir: si tornen a ser dues, torna a passar. */
  const calv = llegeix('vista_calendari.html', (s) => s);
  cal('el calendari desa i llegeix amb la mateixa funció',
      /Cau\.set\(claCau\(d\.mes\), r\)/.test(calv) &&
      /Cau\.get\(claCau\(\), null\)/.test(calv),
      'algú ha tornat a escriure la clau a mà');
  cal('i la clau del mes en curs no és mai «ara»',
      !/'calendari\.' \+ \(mes \|\| 'ara'\)/.test(calv) && !/calendari\.ara/.test(app));

  /* El paquet ha de portar el dia amb la forma que la seva vista sap pintar:
     el que la vista demana és `conversa.elDia`, no una altra cosa. */
  const enc = fs.readFileSync('apps-script/30_Encaminador.gs', 'utf8');
  cal('el paquet porta la pàgina del dia tal com la demana la seva vista',
      /out\._dia = Conversa\.elDia\(/.test(enc));
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

  cal('n\'hi ha uns quants de creats', creats.length >= 8, String(creats.length));
  const fora = creats.filter((t) => llista.indexOf(t) === -1);
  cal('i tots surten a la llista que els esborra',
      fora.length === 0, 'en falten: ' + fora.join(', '));

  /* I a l'inrevés: un nom a la llista que ja no es crea enlloc no fa mal, però
     vol dir que hi ha codi mort o un nom mal escrit. */
  const morts = llista.filter((t) => creats.indexOf(t) === -1);
  cal('i a la llista no hi ha noms que ja no existeixin',
      morts.length === 0, 'sobren: ' + morts.join(', '));
}

// ------------- llegir el calendari per l'API en comptes de per CalendarApp
/* `CalendarApp.getEvents` no és una crida a l'API: és una capa que va a buscar
   cada peça quan la demanes, i llegir cinc mesos de vuit agendes hi costava 40
   segons —mesurat el 4 d'agost del 2026—. Amb l'API és una petició per agenda.
   El que es prova aquí és la traducció, que és on es trenquen aquestes coses:
   un dia de festa acaba «l'endemà a les 00:00» i sortia marcat dos dies; una
   cita cancel·lada segueix venint a la llista; i les dues formes —l'API i
   CalendarApp— han de tornar EXACTAMENT el mateix, perquè la pantalla no sap
   ni ha de saber d'on ha sortit. */
console.log('\nEl calendari, llegit per l\'API: la traducció ha de dir el mateix');
{
  const ctx = carregaTotElServidor();
  const TZ = 'Europe/Madrid';
  ctx.Config = { zonaHoraria: () => TZ, get: () => null, getNum: (k, d) => d, full: () => null };
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Utils.avui = () => '2026-08-04';
  ctx.Utilities.formatDate = (d, tz, f) => {
    const p = (n) => ('0' + n).slice(-2);
    return f === 'HH:mm' ? p(d.getHours()) + ':' + p(d.getMinutes())
                         : d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  ctx.CacheService = { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) };
  ctx.CalendariPont = { hiEs: () => false };

  const AGENDA = { id: 'a@g.com', nom: 'El meu', color: '#123456', pont: false, mostra: true };
  ctx.Dades = {
    llegeix: () => [{ id: AGENDA.id, nom: AGENDA.nom, color: AGENDA.color,
                      mostra: 'SI', principal: 'SI', meu: 'SI', pont: 'NO', ordre: 1 }],
    un: () => null, perId: () => null, insereix: (f, x) => x, actualitza: () => null
  };

  /* El que tornaria l'API de debò, amb els casos que fan mal. */
  const ITEMS = [
    { id: 'e1', summary: 'Reunió de cicle', status: 'confirmed',
      start: { dateTime: '2026-08-04T17:00:00+02:00' },
      end:   { dateTime: '2026-08-04T18:30:00+02:00' }, location: 'Sala 2' },
    { id: 'e2', summary: 'Festa major', status: 'confirmed',
      start: { date: '2026-08-05' }, end: { date: '2026-08-06' } },   // UN dia
    { id: 'e3', summary: 'Vacances', status: 'confirmed',
      start: { date: '2026-08-10' }, end: { date: '2026-08-15' } },   // cinc dies
    { id: 'e4', summary: 'Anul·lada', status: 'cancelled',
      start: { dateTime: '2026-08-04T09:00:00+02:00' },
      end:   { dateTime: '2026-08-04T10:00:00+02:00' } }
  ];

  let peticions = 0;
  ctx.Calendar = { Events: { list: (id, p) => {
    peticions++;
    if (p.pageToken === 'seg') return { items: [] };
    return { items: ITEMS, nextPageToken: peticions === 1 ? 'seg' : null };
  } } };
  ctx.CalendarApp = { getCalendarById: () => { throw new Error('no s\'ha de tocar'); } };

  const l = ctx.Calendari.rang('2026-08-01', '2026-08-31');
  const per = {};
  l.forEach((e) => { per[e.id] = e; });

  cal('una sola petició per agenda, no una per esdeveniment', peticions <= 2, String(peticions));
  cal('la cita amb hora surt amb la seva hora i la seva durada',
      per.e1 && per.e1.hora === '17:00' && per.e1.horaFi === '18:30' && per.e1.minuts === 90,
      JSON.stringify(per.e1));
  cal('i amb el lloc i el color de la seva agenda',
      per.e1.lloc === 'Sala 2' && per.e1.color === '#123456');

  /* El final d'un dia de festa és EXCLUSIU a l'API: si no es resta un dia, la
     festa del 5 surt marcada també el 6. */
  cal('un dia de festa ocupa el seu dia i no l\'endemà',
      per.e2 && per.e2.totElDia && per.e2.data === '2026-08-05' && per.e2.dataFi === '2026-08-05',
      JSON.stringify(per.e2));
  cal('i unes vacances ocupen del primer a l\'últim, no un dia de més',
      per.e3 && per.e3.data === '2026-08-10' && per.e3.dataFi === '2026-08-14',
      JSON.stringify(per.e3));
  cal('una cita anul·lada no es pinta', !per.e4);

  /* I ara la mateixa lectura per CalendarApp: han de sortir iguals. Si un dia
     l'API falla, la pantalla no pot canviar de cara. */
  const cita = (ini, fi, totElDia, titol) => ({
    getId: () => titol, getTitle: () => titol, getLocation: () => '',
    getDescription: () => '', getColor: () => '',
    getStartTime: () => ini, getEndTime: () => fi, isAllDayEvent: () => totElDia
  });
  ctx.Calendar = undefined;      // com si el servei no hi fos
  ctx.CalendarApp = { getCalendarById: () => ({ getEvents: () => [
    cita(new Date(2026, 7, 4, 17, 0), new Date(2026, 7, 4, 18, 30), false, 'Reunió de cicle'),
    cita(new Date(2026, 7, 5, 0, 0), new Date(2026, 7, 6, 0, 0), true, 'Festa major')
  ] }) };
  const vell = ctx.Calendari.rang('2026-08-01', '2026-08-31');
  const perV = {};
  vell.forEach((e) => { perV[e.titol] = e; });

  cal('sense el servei avançat, segueix llegint com sempre', vell.length === 2);
  cal('i el dia de festa cau al mateix dia per tots dos camins',
      perV['Festa major'].data === per.e2.data && perV['Festa major'].dataFi === per.e2.dataFi,
      JSON.stringify([perV['Festa major'].data, perV['Festa major'].dataFi]));
  cal('i la cita amb hora, també',
      perV['Reunió de cicle'].hora === per.e1.hora &&
      perV['Reunió de cicle'].minuts === per.e1.minuts);

  const man = fs.readFileSync('apps-script/appsscript.json', 'utf8');
  cal('i el servei de Calendar està declarat al manifest', /"serviceId": "calendar"/.test(man));
}

// ------------------------- vuit agendes no poden ser vuit voltes seguides
/* Apps Script no sap esperar dues coses alhora excepte amb `fetchAll`. Amb el
   servei avançat una per una, les vuit agendes d'en Pol trigaven tretze
   segons; de cop han de trigar el que trigui la més lenta.
   Aquí es comprova que les demani TOTES en una sola tirada, que en tregui el
   mateix que pel camí d'una en una, i —sobretot— que si alguna falla no es
   perdi: ha de tornar a demanar-se sola. */
console.log('\nLes agendes, demanades totes de cop');
{
  const ctx = carregaTotElServidor();
  const TZ = 'Europe/Madrid';
  ctx.Config = { zonaHoraria: () => TZ, get: () => null, getNum: (k, d) => d };
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Utils.avui = () => '2026-08-04';
  ctx.Utilities.formatDate = (d, tz, f) => {
    const p = (n) => ('0' + n).slice(-2);
    return f === 'HH:mm' ? p(d.getHours()) + ':' + p(d.getMinutes())
                         : d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  ctx.CacheService = { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) };
  ctx.CalendariPont = { hiEs: () => false };
  ctx.ScriptApp = { getOAuthToken: () => 'un-testimoni' };

  const AGENDES = ['a@g.com', 'b@g.com', 'c@g.com'];
  ctx.Dades = {
    llegeix: () => AGENDES.map((id, i) => ({
      id: id, nom: 'Agenda ' + i, color: '#000', mostra: 'SI',
      principal: i === 0 ? 'SI' : 'NO', meu: 'SI', pont: 'NO', ordre: i + 1
    })),
    un: () => null, perId: () => null, insereix: (f, x) => x, actualitza: () => null
  };

  const cita = (id, dia) => ({ id: id, summary: id, status: 'confirmed',
    start: { dateTime: '2026-08-0' + dia + 'T09:00:00+02:00' },
    end: { dateTime: '2026-08-0' + dia + 'T10:00:00+02:00' } });

  let tirades = 0, urls = [];
  ctx.UrlFetchApp = { fetchAll: (p) => {
    tirades++;
    urls = p.map((x) => x.url);
    return p.map((x, i) => ({
      getResponseCode: () => (i === 2 ? 500 : 200),      // la tercera falla
      getContentText: () => JSON.stringify({ items: [cita('de-cop-' + i, i + 1)] })
    }));
  } };

  // El camí d'una en una, per a la que ha fallat.
  let solesDemanades = [];
  ctx.Calendar = { Events: { list: (id) => {
    solesDemanades.push(id);
    return { items: [cita('sola-' + id, 4)] };
  } } };
  ctx.CalendarApp = { getCalendarById: () => { throw new Error('no s\'ha de tocar'); } };

  const l = ctx.Calendari.rang('2026-08-01', '2026-08-31');
  const ids = l.map((e) => e.id).sort();

  cal('les demana totes en UNA sola tirada', tirades === 1, String(tirades));
  cal('i una per agenda, amb el seu identificador a l\'adreça',
      urls.length === 3 && urls[0].indexOf(encodeURIComponent('a@g.com')) !== -1,
      JSON.stringify(urls[0] || ''));
  cal('el que torna de cop es pinta igual que el que torna d\'una en una',
      ids.indexOf('de-cop-0') !== -1 && ids.indexOf('de-cop-1') !== -1);
  cal('i la que ha fallat es torna a demanar sola, no es perd',
      solesDemanades.length === 1 && solesDemanades[0] === 'c@g.com' &&
      ids.indexOf('sola-c@g.com') !== -1,
      JSON.stringify({ soles: solesDemanades, ids: ids }));

  /* Sense testimoni no hi ha drecera possible: ha de seguir funcionant. */
  ctx.ScriptApp = { getOAuthToken: () => { throw new Error('sense permís'); } };
  solesDemanades = [];
  const l2 = ctx.Calendari.rang('2026-08-01', '2026-08-31');
  cal('i si no hi ha manera de demanar-les de cop, es demanen d\'una en una',
      solesDemanades.length === 3 && l2.length === 3,
      JSON.stringify({ soles: solesDemanades.length, quantes: l2.length }));
}

// ------ el verdicte del dia: la còpia del navegador i la del servidor
/* Posar les calories cremades i esperar dos segons per saber si estàs en
   dèficit és esperar un càlcul que ja es pot fer al navegador: el que has
   menjat i el que has cremat són totes dues xifres allà, i la resta és una
   resta. Per això n'hi ha una còpia a la vista.
   Dues còpies deriven, i derivarien EN SILENCI: la pantalla diria una cosa i
   la notificació de la nit una altra. Això les fa córrer totes dues sobre els
   mateixos casos —inclosos els de vora, que són els que es fan malbé— i
   compara el text lletra per lletra. */
console.log('\nEl verdicte del dia: el navegador i el servidor diuen el mateix');
{
  const font = fs.readFileSync('apps-script/40_Mod_Nutricio.gs', 'utf8');
  const vista = fs.readFileSync('apps-script/vista_nutricio.html', 'utf8');

  const talla = (text, desde, fins) => {
    const i0 = text.indexOf(desde);
    const i1 = text.indexOf(fins, i0);
    return (i0 >= 0 && i1 > i0) ? text.slice(i0, i1) : '';
  };

  const srv = talla(font, '  function verdicte_(', '\n  }\n') + '\n  }\n';
  const cli = talla(vista, '    function verdicteLocal(', '\n    }\n') + '\n    }\n';
  cal('es troben les dues còpies', srv.length > 100 && cli.length > 100,
      JSON.stringify([srv.length, cli.length]));

  const ctxS = { Math }; vm.createContext(ctxS);
  vm.runInContext(srv + '\nvar __f = verdicte_;', ctxS);
  const ctxC = { Math }; vm.createContext(ctxC);
  vm.runInContext(cli + '\nvar __f = verdicteLocal;', ctxC);

  /* Els casos de vora primer: el zero, l'objectiu clavat i el que hi passa
     just per un. Són els que una còpia feta a mà es menja. */
  const CASOS = [
    [false, null, 500], [false, 300, 500],
    [true, 500, 500], [true, 499, 500], [true, 501, 500],
    [true, 0, 500], [true, -1, 500], [true, -350, 500],
    [true, 700, 0], [true, 0, 0], [true, -200, 0],
    [true, 123.4, 500], [true, 1200, 500]
  ];

  let diferents = [];
  CASOS.forEach(([te, net, obj]) => {
    const a = ctxS.__f(te, net, obj);
    const b = ctxC.__f(te, net, obj);
    if (a.estat !== b.estat || a.text !== b.text) {
      diferents.push(JSON.stringify({ cas: [te, net, obj], servidor: a, navegador: b }));
    }
  });
  cal('els ' + CASOS.length + ' casos donen el mateix estat i el mateix text',
      diferents.length === 0, diferents.join(' | '));

  cal('i la vista pinta el verdicte abans d\'enviar-lo, no després',
      /dades\.verdicte = verdicteLocal\(/.test(vista) &&
      vista.indexOf('dades.verdicte = verdicteLocal(') <
      vista.indexOf("escriu('nutricio', 'activitat'"));
}

// ------------- les calories cremades, que ja les escriu cada dia i no es creuaven
/* La xifra que dona el rellotge era l'única mesura diària del que s'ha mogut de
   debò que hi ha a l'app, i només sortia dins del dèficit. El dèficit barreja
   dues coses: un dia de sortida llarga i un dia de menjar poc donen el mateix
   número i no són el mateix dia. Aquí es comprova que les cremades surtin soles
   —perquè es puguin creuar amb el pes, la cintura, el son— i que segueixin a la
   família del dèficit, que és el que evita la troballa que no ho és. */
console.log('\nLes calories cremades es poden creuar amb la resta');
{
  const font = fs.readFileSync('apps-script/40_Mod_Nutricio.gs', 'utf8');
  const srvFont = font.slice(font.indexOf('var Nutricio = (function ()'),
                             font.lastIndexOf('})();') + 5);

  /* Quaranta dies: prou perquè la sèrie tingui vida (en demana catorze). Els
     parells amb cremades, els senars sense: així es comprova que un dia sense
     la xifra del rellotge no compti com un zero. */
  const dies = [];
  for (let n = 1; n <= 40; n++) {
    dies.push('2026-06-' + String(n <= 30 ? n : n - 30).padStart(2, '0'));
  }
  const calendari = [];
  for (let n = 1; n <= 30; n++) calendari.push('2026-06-' + String(n).padStart(2, '0'));

  const ctx = {
    Utils: { rangDates: () => calendari, avui: () => '2026-06-30' },
    Config: { getNum: () => 0, get: () => '', esSi: () => false },
    Log: { info() {}, avis() {}, error() {} },
    Dades: {
      llegeix: (full, filtre) => {
        if (full === 'Ingestes') {
          return calendari.map((d) => ({ id: 'i' + d, data: d, grams: 100,
            kcal100: 2000, prot100: 120 })).filter((f) => !filtre || filtre(f));
        }
        if (full === 'NutricioDies') {
          return calendari.filter((d, k) => k % 2 === 0)
            .map((d) => ({ data: d, activitat: 2500 }))
            .filter((f) => !filtre || filtre(f));
        }
        return [];
      }
    },
    Memoria: {}, Date, Math, Number, String, JSON, parseFloat, isFinite, Object, Array
  };
  vm.createContext(ctx);
  vm.runInContext(srvFont, ctx);

  const series = ctx.Nutricio.seriesDiaries('2026-06-01', '2026-06-30');
  const perId = {};
  series.forEach((s) => { perId[s.id] = s; });

  cal('les cremades surten com a sèrie pròpia', !!perId.cremades,
      series.map((s) => s.id).join(', '));
  cal('i porten la unitat, que és el que la fa llegible',
      perId.cremades && perId.cremades.unitat === 'kcal al dia',
      perId.cremades && perId.cremades.unitat);
  /* Amb el dèficit comparteixen la meitat de la xifra: «els dies que cremes
     més tens més dèficit» és aritmètica, no una troballa. La família ho tapa. */
  cal('i van a la família del dèficit perquè no es creuin entre elles',
      perId.cremades && perId.deficit &&
      perId.cremades.familia === perId.deficit.familia,
      perId.cremades && perId.cremades.familia);
  cal('un dia sense la xifra del rellotge no compta com un zero',
      Object.keys(perId.cremades.dies).length === 15 &&
      Object.keys(perId.cremades.dies).every((d) => perId.cremades.dies[d] === 2500),
      String(Object.keys(perId.cremades.dies).length));
}

// ---------------- els comptadors, dibuixats a la pantalla d'hàbits
/* En Pol vol veure com va el tabac SENSE entrar enlloc, i no vol la llegenda
   de la graella —que explica com llegir una taula, cosa que s'aprèn el primer
   dia—. Això comprova que la sèrie arribi amb el full del mes i no amb el dia:
   el dia torna a CADA toc que fa, i noranta números per toc són noranta
   números que ningú mira. */
console.log('\nEls comptadors: la corba a la pantalla, i sense pagar-la a cada toc');
{
  const font = fs.readFileSync('apps-script/40_Mod_Habits.gs', 'utf8');
  const vista = fs.readFileSync('apps-script/vista_habits.html', 'utf8');

  cal('la pantalla demana el mes AMB els comptadors',
      /Habits\.mes\(d, n, true\)/.test(font));
  cal('i marcar un hàbit el demana SENSE',
      /d\.mes = Habits\.mes\(p\.data \|\| Utils\.avui\(\), 30\);/.test(font));
  cal('la sèrie dels comptadors es munta per dies i per mesos',
      /function comptadors_\(/.test(font) && /mesos: mesos/.test(font));

  cal('la llegenda de la graella ja no hi és', !/class="llegenda"/.test(vista));
  cal('i al seu lloc hi ha la corba', /blocComptadors\(\)/.test(vista));
  cal('amb les tres finestres', /\['setmana', 'Setmana'\], \['mes', 'Mes'\], \['tot', 'Tot'\]/.test(vista));
  cal('i la finestra triada es recorda entre visites',
      /Cau\.set\('habits\.finestraCompt'/.test(vista));

  /* El zero SEMPRE a baix: una corba que arrenca la base al mínim fa que un
     cigarro de diferència sembli una muntanya. */
  cal('la corba té la base al zero i no al mínim',
      /var y = function \(v\) \{ return H - marge - \(v \/ sostre\) \* \(H - marge \* 2\); \};/.test(vista));

  const app = fs.readFileSync('apps-script/ui_app.html', 'utf8');
  cal('el botó de canviar a full de dia ja no hi és enlloc',
      !/data-tema="1"/.test(vista) &&
      !/data-tema="1"/.test(fs.readFileSync('apps-script/vista_inici.html', 'utf8')));
  cal('i el tema es queda fosc sense preguntar',
      /aplicaTema: function \(\) \{/.test(app) && /temaActual: function \(\) \{ return 'fosc'; \}/.test(app));
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
  const declaren = ['40_Mod_Tasques.gs', '40_Mod_Habits.gs', '40_Mod_Nutricio.gs',
                    '40_Mod_Seguiment.gs', '40_Mod_Finances.gs']
    .filter((f) => /senyals:\s*function/.test(fs.readFileSync('apps-script/' + f, 'utf8')));
  cal('cinc mòduls saben dir què els passa', declaren.length === 5, declaren.join(', '));

  const inst = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  cal('i hi ha un trigger que ho mira, i surt a la llista de neteja',
      /newTrigger\('triggerSenyals'\)/.test(inst) && /'triggerSenyals'\]/.test(inst));
}

// ------------------------------------ la memòria: el que sap d'ell perquè li ha dit
/* La fitxa que llegeix la IA es refà cada dia dels fulls: serveix per saber com
   està, no per saber qui és. Això és l'altra meitat.
   El que es prova aquí és el que fa que serveixi: que dir dues vegades la
   mateixa cosa no en deixi dues de guardades —amb dues, una és vella i no se
   sap quina—, que oblidar no esborri mai la fila, i que el que sap arribi de
   debò a la fitxa. */
console.log('\nLa memòria: una cosa per fila, i res que no es pugui desdir');
{
  const ctx = carregaTotElServidor();
  ctx.Utils.avui = () => '2026-08-05';
  ctx.Utils.ara = () => '2026-08-05T10:00:00+02:00';
  ctx.Log = { info() {}, avis() {}, error() {} };

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

  const R = ctx.Records;

  R.recorda('La Marta és la tutora de 2nB', 'persona', 'conversa');
  R.recorda('Els dimarts a les 17h tinc claustre', 'rutina', 'conversa');
  cal('desa el que li dius', files.length === 2, String(files.length));

  /* La mateixa cosa dita d'una altra manera: ha d'actualitzar, no duplicar. */
  const r = R.recorda('la marta es la tutora de 2n B', 'persona', 'conversa');
  cal('dir la mateixa cosa dues vegades no en deixa dues de guardades',
      files.length === 2 && r.actualitzat === true,
      JSON.stringify(files.map((f) => f.fet)));

  /* Una de diferent de debò sí que és nova. */
  R.recorda('No vull que m\'avisi de res abans de les vuit', 'preferencia', 'conversa');
  cal('i una de diferent sí que hi entra', files.length === 3);

  const p = R.pantalla({});
  cal('la pantalla les agrupa per menes', p.blocs.length === 3, JSON.stringify(p.blocs.map((b) => b.mena)));
  cal('i en compta tres', p.quants === 3);

  /* Oblidar no esborra: la fila es queda amb data. */
  const quin = files.filter((f) => /claustre/.test(f.fet))[0];
  R.oblida(quin.id);
  cal('oblidar no esborra la fila', files.length === 3 && !!quin.oblidat_el);
  cal('i deixa de comptar', R.pantalla({}).quants === 2);
  cal('però es pot recuperar', (R.recupera(quin.id), R.pantalla({}).quants === 3));

  /* Si el torna a dir després d'oblidar-lo, mana el que diu ara. */
  R.oblida(quin.id);
  const tornat = R.recorda('Els dimarts a les 17h tinc claustre', 'rutina', 'conversa');
  cal('i si el torna a dir, torna a valer', tornat.recuperat === true && !quin.oblidat_el);

  const fitxa = R.contextIA();
  cal('el que sap arriba a la fitxa de la IA',
      /marta/i.test(fitxa) && /claustre/.test(fitxa) && /abans de les vuit/.test(fitxa), fitxa);
  cal('i hi arriba agrupat, no com una llista plana',
      /Persones:/.test(fitxa) && /Rutines fixes:/.test(fitxa), fitxa);

  /* Buscar-hi sense accents ni majúscules: ell escriu com parla. */
  cal('la cerca no depèn dels accents',
      R.pantalla({ conte: 'MARTA' }).quants === 1 &&
      R.consultaIA({ conte: 'claustre' }).quants === 1);

  /* I el nom no pot xocar amb el `Memoria` del nucli, que és una altra cosa. */
  const font = fs.readFileSync('apps-script/40_Mod_Memoria.gs', 'utf8');
  cal('l\'objecte no es diu com el del nucli',
      /var Records = \(function/.test(font) && !/^var Memoria = /m.test(font));

  const idx = fs.readFileSync('apps-script/ui_index.html', 'utf8');
  cal('i la seva pantalla està muntada a l\'app', /include\('vista_memoria'\)/.test(idx));
}

// -------------------------------------------------------------------- setmana
console.log('\nLa setmana: cada cosa al seu dia, i el que no en té a la pila');
{
  const ctx = carregaTotElServidor();
  const AVUI = '2026-08-05';                     // dimecres
  ctx.Utils.avui = () => AVUI;
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Config = { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, d) => d };
  /* El formatador ha de formatar de debò: `dillunsDe` fa servir `sumaDies`, i
     amb un fals que torni sempre el mateix dia la regla del cap de setmana no
     es podria comprovar mai. */
  ctx.Utilities.formatDate = (d) => d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  ctx.Memoria = { recordaComu: (clau, fes) => fes(), recorda: (m, c, fes) => fes() };

  /* Els mòduls de debò fora i quatre d'inventats a dins. Es fa pel registre
     —els `MODUL_*` del global— i no falsejant `Moduls.actius`, perquè el que
     es vol provar és justament el repartidor del nucli: si el falsegés, la
     prova passaria amb el repartidor desconnectat. */
  const MODUL_CONVERSA = ctx.MODUL_CONVERSA;
  Object.keys(ctx).filter((k) => /^MODUL_[A-Z0-9_]+$/.test(k)).forEach((k) => { delete ctx[k]; });
  ctx._memoModuls = null;
  const posaModuls = (l) => {
    Object.keys(ctx).filter((k) => /^MODUL_[A-Z0-9_]+$/.test(k)).forEach((k) => { delete ctx[k]; });
    l.forEach((m, i) => { ctx['MODUL_P' + i] = () => m; });
    ctx._memoModuls = null;
  };

  /* Un mòdul que contesta i un que no. El que no ha de ser invisible, no una
     excepció: el contracte diu que és opcional. */
  posaModuls([
    { id: 'calendari', nom: 'Calendari', laSetmana: () => ({
        titol: 'Al calendari', accio: 'calendari', coses: [
          { data: '2026-08-06', text: 'Claustre', hora: '09:00', minuts: 90 },
          { data: '2026-08-06', text: 'Reunió', hora: '17:00', minuts: 60 },
          { data: '2026-08-04', text: 'Visita', hora: '12:00', minuts: 30 },
          { data: '2026-08-20', text: 'Fora de la setmana', hora: '10:00', minuts: 600 }
        ] }) },
    { id: 'tasques', nom: 'Tasques', laSetmana: () => ({
        titol: 'Tasques', accio: 'tasques', coses: [
          { data: '2026-08-07', text: 'Amb dia' },
          { data: null, text: 'Sense dia',
            mou: { accio: 'edita', camp: 'venc_el', params: { id: 't1', llista: 'l1' } } }
        ] }) },
    { id: 'mut', nom: 'Mut' },
    { id: 'peta', nom: 'Peta', laSetmana: () => { throw new Error('m\'he trencat'); } }
  ]);

  const s = ctx.Conversa.laSetmana();
  cal('la setmana d\'un dimecres és la d\'aquest dimecres',
      s.desde === '2026-08-03' && s.fins === '2026-08-09', s.desde + ' → ' + s.fins);
  cal('i són set dies, ni sis ni vuit', s.dies.length === 7);

  const dj = s.dies.filter((d) => d.data === '2026-08-06')[0];
  cal('les coses van al seu dia', dj.coses.length === 2, JSON.stringify(dj.coses));
  cal('i els minuts se sumen', dj.minuts === 150, dj.minuts);
  cal('el dia més ple de la setmana surt comptat', s.minutsPle === 150, s.minutsPle);

  cal('el que cau fora de la setmana no s\'hi cola',
      JSON.stringify(s).indexOf('Fora de la setmana') === -1);

  cal('sense data, a la pila', s.pila.length === 1 && s.pila[0].text === 'Sense dia',
      JSON.stringify(s.pila));
  cal('i la pila porta com moure-ho', !!s.pila[0].mou && s.pila[0].mou.camp === 'venc_el');
  cal('la cosa de la pila sap de quin mòdul és, que si no no es pot moure',
      s.pila[0].modul === 'tasques');

  cal('un mòdul que no la implementa no fa cap soroll',
      JSON.stringify(s).indexOf('Mut') === -1);
  /* Quatre coses als dies —tres cites de dins i una tasca amb dia— més la de
     la pila. La que cau fora de la setmana no compta enlloc. */
  cal('i un que peta no s\'endú la pantalla', s.quantes === 5, s.quantes);

  /* AVUI, ABANS I DESPRÉS. Sense això, la pantalla no pot dir on ets. */
  cal('només un dia és avui', s.dies.filter((d) => d.esAvui).length === 1);
  cal('i els d\'abans van marcats', s.dies.filter((d) => d.esPassat).length === 2,
      s.dies.filter((d) => d.esPassat).map((d) => d.data).join(' '));

  /* Dins d'un dia, les hores manen: el que no en té va a dalt i la resta en
     ordre. Un dia desordenat no es llegeix. */
  cal('les coses del dia surten per hora',
      dj.coses[0].hora === '09:00' && dj.coses[1].hora === '17:00');

  /* LA REGLA DEL CAP DE SETMANA. Diumenge la setmana que t'importa ja no és
     la que s'acaba: és la que ve. */
  ctx.Utils.avui = () => '2026-08-09';           // diumenge
  cal('diumenge obre la setmana que ve', ctx.Conversa.laSetmana().desde === '2026-08-10',
      ctx.Conversa.laSetmana().desde);
  ctx.Utils.avui = () => '2026-08-08';           // dissabte
  cal('dissabte també', ctx.Conversa.laSetmana().desde === '2026-08-10');
  ctx.Utils.avui = () => '2026-08-07';           // divendres
  cal('divendres encara no', ctx.Conversa.laSetmana().desde === '2026-08-03');

  /* I si en demanes una, la que has demanat: qualsevol dia seu val. */
  cal('demanant-ne una, surt la seva',
      ctx.Conversa.laSetmana('2026-08-19').desde === '2026-08-17');

  /* EL SENYAL DE DIUMENGE. No pot sonar cap altre dia ni amb la pila buida. */
  const modConv = MODUL_CONVERSA();
  ctx.Utils.ara = () => '2026-08-09T18:00:00+02:00';
  ctx.Utils.avui = () => '2026-08-05';
  cal('entre setmana no diu res de preparar la setmana', modConv.senyals().length === 0);
  ctx.Utils.avui = () => '2026-08-09';
  ctx.Utils.ara = () => '2026-08-09T08:00:00+02:00';
  cal('i diumenge al matí tampoc: encara no toca', modConv.senyals().length === 0);
  ctx.Utils.ara = () => '2026-08-09T18:00:00+02:00';
  const sen = modConv.senyals();
  cal('diumenge sí', sen.length === 1 && sen[0].accio === 'setmana', JSON.stringify(sen));
  cal('i no renya: ofereix el primer pas', /Cinc minuts/.test(sen[0].text), sen[0].text);

  posaModuls([{ id: 'tasques', nom: 'Tasques', laSetmana: () => null }]);
  cal('amb la pila buida, diumenge calla', modConv.senyals().length === 0);

  /* La pantalla ha d'estar muntada a l'app: sense això el senyal porta enlloc. */
  const idxS = fs.readFileSync('apps-script/ui_index.html', 'utf8');
  cal('i la pantalla està muntada', /include\('vista_setmana'\)/.test(idxS));
}

console.log('\nEls dies d\'un esdeveniment llarg: un per un, i les hores un sol cop');
{
  const ctx = carregaTotElServidor();
  ctx.Utils.avui = () => '2026-08-05';
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Config = { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, d) => d };
  ctx.Utilities.formatDate = (d) => d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

  /* `rangPerDies` s'alimenta de `rang`, que aquí es falseja: el que es prova
     és el repartiment per dies, no la lectura dels calendaris. */
  const src = fs.readFileSync('apps-script/40_Mod_Calendari.gs', 'utf8');
  const tros = src.slice(src.indexOf('  function rangPerDies('),
                         src.indexOf('  function novaData_('));
  const c2 = { Utils: ctx.Utils, Object, String, Number, Math };
  c2.rang = () => [
    { data: '2026-08-04', dataFi: '2026-08-06', titol: 'Sortida de tres dies',
      totElDia: true, hora: '', horaFi: '', minuts: 0 },
    { data: '2026-08-05', dataFi: '2026-08-05', titol: 'Claustre',
      totElDia: false, hora: '09:00', horaFi: '10:30', minuts: 90 },
    { data: '2026-08-05', dataFi: '2026-08-05', titol: 'Tot el dia',
      totElDia: true, hora: '', horaFi: '', minuts: 0 }
  ];
  vm.createContext(c2);
  vm.runInContext(tros + '\nvar __r = rangPerDies;', c2);

  const l = c2.__r('2026-08-03', '2026-08-09');
  cal('la sortida de tres dies surt tres cops',
      l.filter((x) => x.titol === 'Sortida de tres dies').length === 3);
  cal('i cada cop amb el seu dia',
      l.filter((x) => x.titol === 'Sortida de tres dies').map((x) => x.dia).join(',') ===
      '2026-08-04,2026-08-05,2026-08-06');
  cal('les hores del claustre només compten un cop',
      l.filter((x) => x.minuts).length === 1 && l.filter((x) => x.minuts)[0].minuts === 90);

  const cinc = l.filter((x) => x.dia === '2026-08-05');
  cal('dins d\'un dia, el de tot el dia va primer i les hores després',
      cinc[cinc.length - 1].titol === 'Claustre', cinc.map((x) => x.titol).join(' · '));

  /* Un esdeveniment que comença abans de la finestra no ha de començar abans
     de la finestra: si no, la pantalla rebria dies que no té on posar. */
  c2.rang = () => [{ data: '2026-07-28', dataFi: '2026-08-04', titol: 'Vacances',
                     totElDia: true, hora: '', horaFi: '', minuts: 0 }];
  const l2 = c2.__r('2026-08-03', '2026-08-09');
  cal('el que ve d\'abans es retalla per l\'esquerra',
      l2.length === 2 && l2[0].dia === '2026-08-03', JSON.stringify(l2.map((x) => x.dia)));
}

/* El pas de dies a setmanes, per poder comptar a fora el que sortiria sense
   el control de falsos descobriments. */
function C_perSetmanes(ctx, serie) { return ctx.Creuaments.perSetmanes(serie); }

// ------------------------------------------------------------------ creuar
console.log('\nCreuar dades: els números, contra valors que ja se saben');
{
  const ctx = carregaTotElServidor();
  ctx.Log = { info() {}, avis() {}, error() {} };
  const C = ctx.Creuaments;

  /* Els rangs, amb repeticions. Sense repartir-les, tres zeros rebrien 1, 2 i
     3 i s'inventarien un ordre que no existeix. */
  cal('els rangs surten ordenats', C.rangs([10, 30, 20]).join(',') === '1,3,2');
  cal('i les repeticions es reparteixen', C.rangs([5, 5, 5, 9]).join(',') === '2,2,2,4',
      C.rangs([5, 5, 5, 9]).join(','));

  /* Spearman mira ORDRES. Aquestes dues sèries no són proporcionals però van
     ordenades igual: ha de donar 1 exacte, que és el que separa Spearman de
     Pearson i la raó per la qual es fa servir aquest. */
  cal('dues sèries amb el mateix ordre donen 1',
      Math.abs(C.spearman([1, 2, 3, 4, 5], [1, 4, 9, 100, 5000]) - 1) < 1e-12);
  cal('i a l\'inrevés, -1',
      Math.abs(C.spearman([1, 2, 3, 4, 5], [9, 8, 7, 6, 5]) + 1) < 1e-12);
  cal('una sèrie plana no es relaciona amb res',
      C.spearman([1, 2, 3, 4], [7, 7, 7, 7]) === 0);
  /* Cas de llibre, calculat a mà: les diferències de rang són −1, 1, −1, 1, 0,
     o sigui Σd² = 4, i rho = 1 − 6·4/(5·24) = 0,8. */
  cal('i un cas amb els números coneguts dona 0,8',
      Math.abs(C.spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]) - 0.8) < 1e-9,
      C.spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]));

  /* EL VALOR P. Aquí és on una errada faria dir coses que no són: es compara
     amb els valors de la taula de la t de Student, que són públics i fixos.
     Amb n=12 (10 graus de llibertat), t=2,228 correspon a p=0,05; el rho que
     dona aquella t és 0,5760. */
  const prop = (a, b, tol) => Math.abs(a - b) < tol;
  cal('rho 0,576 amb 12 setmanes val p=0,05',
      prop(C.valorP(0.576, 12), 0.05, 0.002), C.valorP(0.576, 12));
  /* t=3,169 amb df=10 → p=0,01 → rho = 0,7079 */
  cal('rho 0,708 amb 12 setmanes val p=0,01',
      prop(C.valorP(0.7079, 12), 0.01, 0.001), C.valorP(0.7079, 12));
  /* t=2,086 amb df=20 → p=0,05 → rho = 0,4227 */
  cal('i amb 22 setmanes en fa falta menys: rho 0,423 ja val p=0,05',
      prop(C.valorP(0.4227, 22), 0.05, 0.002), C.valorP(0.4227, 22));
  cal('cap relació val p=1', prop(C.valorP(0, 12), 1, 1e-9), C.valorP(0, 12));
  cal('i una de perfecta, gairebé zero', C.valorP(0.999, 20) < 1e-10);
  cal('amb tres setmanes no es diu res', C.valorP(0.99, 3) === 1);

  /* BENJAMINI–HOCHBERG amb l'exemple clàssic: de vuit valors p, només els dos
     primers passen amb q=0,05. Si això falla, es dirien relacions que són
     casualitat i tota la pantalla deixaria de valer. */
  const ps = [0.041, 0.001, 0.205, 0.008, 0.06, 0.039, 0.074, 0.042]
    .map((p, i) => ({ p, i }));
  const jutjats = C.passenBH(ps, 0.05);
  const passen = jutjats.filter((x) => x.passa).map((x) => x.p).sort();
  cal('de vuit parelles, en passen dues', passen.length === 2, JSON.stringify(passen));
  cal('i són les dues més petites', passen[0] === 0.001 && passen[1] === 0.008);
  cal('amb res que passi, no passa res',
      C.passenBH([{ p: 0.9 }, { p: 0.8 }], 0.05).filter((x) => x.passa).length === 0);

  /* DE DIES A SETMANES. Una setmana a mitges no és una setmana. */
  ctx.Utilities.formatDate = (d) => d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  ctx.Config = { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, v) => v };

  const dl = '2026-08-03';                       // dilluns
  const suma = (n) => ctx.Utils.sumaDies(dl, n);
  const sumaSerie = { agrega: 'suma', dies: {} };
  [0, 1, 2].forEach((n) => { sumaSerie.dies[suma(n)] = 3; });
  cal('tres dies no fan una setmana de les que se sumen',
      Object.keys(C.perSetmanes(sumaSerie)).length === 0);
  [3, 4].forEach((n) => { sumaSerie.dies[suma(n)] = 3; });
  cal('cinc sí, i se sumen', C.perSetmanes(sumaSerie)[dl] === 15,
      JSON.stringify(C.perSetmanes(sumaSerie)));

  const mitjSerie = { agrega: 'mitjana', dies: {} };
  mitjSerie.dies[suma(2)] = 80;
  cal('una pesada sola SÍ que és la dada de la setmana',
      C.perSetmanes(mitjSerie)[dl] === 80);
  const exigent = { agrega: 'mitjana', minimDies: 4, dies: {} };
  [0, 1].forEach((n) => { exigent.dies[suma(n)] = 5; });
  cal('però un mòdul pot demanar-ne més i llavors manen els seus',
      Object.keys(C.perSetmanes(exigent)).length === 0);

  /* LA FRASE no diu mai «perquè». */
  const f = C.frase({ a: 'Son', b: 'Cigarros', rho: -0.7 });
  cal('la frase diu que van juntes, no que una causi l\'altra',
      /Les setmanes de més/.test(f) && !/perqu/i.test(f) && !/causa/i.test(f), f);
  cal('i amb rho negatiu diu «menys»', /menys/.test(f), f);
  cal('amb rho positiu diu «també»', /també/.test(C.frase({ a: 'A', b: 'B', rho: 0.8 })));
}

console.log('\nCreuar dades: una relació de veritat enmig de soroll');
{
  const ctx = carregaTotElServidor();
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Config = { zonaHoraria: () => 'Europe/Madrid', get: () => null, getNum: (k, v) => v };
  ctx.Utilities.formatDate = (d) => d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  ctx.Utils.avui = () => '2026-08-05';

  let desat = null;
  ctx.Dades = {
    un: () => desat,
    insereix: (full, fila) => { desat = fila; return fila; },
    actualitza: (full, id, canvis) => { desat = Object.assign({}, desat, canvis); return desat; }
  };

  /* Vint setmanes. Una relació PLANTADA —b segueix a a— i sis sèries de
     soroll fet amb una successió fixa (res d'atzar: la prova ha de donar el
     mateix cada cop que s'executi). */
  const dl0 = ctx.Utils.dillunsDe('2026-08-05');
  const setmanes = [];
  for (let s = 20; s >= 1; s--) setmanes.push(ctx.Utils.sumaDies(dl0, -7 * s));

  const serie = (id, familia, fn) => {
    const dies = {};
    setmanes.forEach((dl, k) => {
      for (let i = 0; i < 7; i++) dies[ctx.Utils.sumaDies(dl, i)] = fn(k, i);
    });
    return { id, nom: id, unitat: '', agrega: 'suma', familia, dies };
  };

  /* SOROLL DE DEBÒ, I SEMPRE EL MATEIX. El primer intent va ser una successió
     modular —`(k * llavor) % 23`— i no era soroll: tenia pendent, es
     relacionava amb tot i la prova acusava el codi d'una cosa que feia ella.
     Això és un generador pseudoaleatori amb llavor fixa: sembla atzar per a
     l'estadística i dona el mateix cada cop que s'executa la prova. */
  const daus = (llavor) => {
    let s = llavor >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
    };
  };
  const soroll = (llavor) => {
    const d = daus(llavor), vals = [];
    for (let k = 0; k < 40; k++) vals.push(Math.round(d() * 20) + 1);
    return (k) => vals[k];
  };

  const SOROLL = 12;                             // 66 parelles de soroll pur
  const series = [
    /* A i B van agafades de la mà: B = 40 − A, o sigui relació perfecta i
       negativa. Ha de sortir sí o sí. */
    Object.assign(serie('a', 'fa', (k) => k + 1), { modul: 'm1', nom: 'A' }),
    Object.assign(serie('b', 'fb', (k) => 40 - k), { modul: 'm2', nom: 'B' }),
    /* G és de la MATEIXA FAMÍLIA que A i també va perfecta amb ella: la
       parella A-G no s'ha de provar mai, perquè dir-la seria una obvietat.
       (Amb B sí que es prova, i hi surt: en aquest món inventat B i G es
       mouen de debò juntes, i això no és cap error.) */
    Object.assign(serie('g', 'fa', (k) => (k + 1) * 2), { modul: 'm1', nom: 'G' })
  ];
  for (let n = 0; n < SOROLL; n++) {
    series.push(Object.assign(serie('n' + n, 'fn' + n, soroll(1000 + n * 37)),
                              { modul: 'mn' + n, nom: 'N' + n }));
  }
  ctx.Moduls.seriesDiaries = () => series;

  const r = ctx.Creuaments.calcula({ fins: '2026-08-05' });
  const esSoroll = (t) => /^N\d+$/.test(t.a) || /^N\d+$/.test(t.b);

  cal('la relació plantada surt', r.trobades.some((t) => t.a === 'A' && t.b === 'B'),
      JSON.stringify(r.trobades.map((t) => t.a + '/' + t.b)));
  cal('i surt com a inversa', r.trobades.filter((t) => t.a === 'A' && t.b === 'B')[0].rho === -1);

  /* LA PROVA QUE VAL. Amb 105 parelles i vint setmanes, unes quantes de
     soroll passen el llindar de sempre (p < 0,05) per pura aritmètica. El
     control de falsos descobriments les ha de tallar. No es demana que en
     surti ZERO —Benjamini–Hochberg controla la PROPORCIÓ, no el compte, i
     prometre zero seria prometre el que no fa—: es demana que en talli la
     immensa majoria, i es comprova contra el que sortiria sense ell. */
  let sensControl = 0;
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      if (series[i].familia === series[j].familia) continue;
      if (!/^N\d+$/.test(series[i].nom) && !/^N\d+$/.test(series[j].nom)) continue;
      const sa = C_perSetmanes(ctx, series[i]), sb = C_perSetmanes(ctx, series[j]);
      const claus = Object.keys(sa).filter((k) => sb[k] !== undefined);
      const rho = ctx.Creuaments.spearman(claus.map((k) => sa[k]), claus.map((k) => sb[k]));
      if (ctx.Creuaments.valorP(rho, claus.length) < 0.05) sensControl++;
    }
  }
  const ambControl = r.trobades.filter(esSoroll).length;
  cal('sense control, el soroll donaria relacions', sensControl >= 2, sensControl);
  cal('amb control, en queden molt poques o cap',
      ambControl <= 1 && ambControl < sensControl,
      ambControl + ' de ' + sensControl);

  cal('el que és de la mateixa família no s\'ha ni provat',
      !r.trobades.some((t) => (t.a === 'A' && t.b === 'G') || (t.a === 'G' && t.b === 'A')));
  /* 15 sèries → 105 parelles, menys A-G que és de la mateixa família. */
  cal('s\'han provat les parelles que toquen', r.provades === 104, r.provades);
  cal('i queda desat per a la pantalla', !!desat && !!desat.resultat);

  /* La setmana en curs no hi entra: està a mitges i faria de setmana fluixa
     una que encara no ha acabat. */
  cal('no es mira la setmana que s\'està vivint',
      r.fins === ctx.Utils.sumaDies(dl0, -1), r.fins);

  /* I amb poques setmanes, silenci. Set no arriben al mínim de vuit. */
  const poques = setmanes.slice(-7);
  ctx.Moduls.seriesDiaries = () => [
    Object.assign((() => { const d = {}; poques.forEach((dl, k) => {
      for (let i = 0; i < 7; i++) d[ctx.Utils.sumaDies(dl, i)] = k + 1; });
      return { id: 'x', nom: 'X', agrega: 'suma', familia: 'fx', dies: d }; })(), { modul: 'm1' }),
    Object.assign((() => { const d = {}; poques.forEach((dl, k) => {
      for (let i = 0; i < 7; i++) d[ctx.Utils.sumaDies(dl, i)] = 40 - k; });
      return { id: 'y', nom: 'Y', agrega: 'suma', familia: 'fy', dies: d }; })(), { modul: 'm2' })
  ];
  const r2 = ctx.Creuaments.calcula({ fins: '2026-08-05' });
  cal('amb set setmanes, per perfecta que sigui, no es diu res',
      r2.trobades.length === 0, JSON.stringify(r2.trobades));

  /* I la pantalla ha d'estar muntada, que si no el senyal porta enlloc. */
  const idxR = fs.readFileSync('apps-script/ui_index.html', 'utf8');
  cal('la pantalla està muntada a l\'app', /include\('vista_relacions'\)/.test(idxR));
}

// ------------------------------------------------------------ procrastinació
console.log('\nEl primer pas: què es diu d\'una tasca encallada, i què no');
{
  const ctx = carregaTotElServidor();
  const AVUI = '2026-08-06';
  ctx.Utils.avui = () => AVUI;
  ctx.Utils.faQuant = () => 'fa uns dies';
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.CacheService = { getScriptCache: () => ({ get: () => null, put() {} }) };

  const fulls = { LlistesTasques: [], TasquesMarques: [] };
  let seguit = 0;
  ctx.Dades = {
    llegeix: (full) => JSON.parse(JSON.stringify(fulls[full] || [])),
    un: (full, q) => (fulls[full] || []).filter(
      (f) => Object.keys(q).every((k) => f[k] === q[k]))[0] || null,
    perId: (full, id) => (fulls[full] || []).filter((f) => f.id === id)[0] || null,
    insereix: (full, fila, prefix) => {
      const f = Object.assign({ id: fila.id || (prefix || 'x') + (++seguit) }, fila);
      fulls[full].push(f); return f;
    },
    actualitza: (full, id, canvis) => {
      const f = (fulls[full] || []).filter((x) => x.id === id)[0];
      if (f) Object.assign(f, canvis);
      return f || null;
    }
  };

  /* Tres tasques sense data: una de fa dotze dies, una de fa cinquanta i una
     de fa dos. Els dies els porta `updated`, que és el que dona Google. */
  const fa = (n) => {
    const d = new Date(AVUI + 'T12:00:00'); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10) + 'T09:00:00.000Z';
  };
  const tasques = { L1: [
    { id: 'g1', title: 'Informe de la batuda', status: 'needsAction', updated: fa(12) },
    { id: 'g2', title: 'Demanar hora al dentista', status: 'needsAction', updated: fa(50) },
    { id: 'g3', title: 'Comprar pinso', status: 'needsAction', updated: fa(2) }
  ] };
  ctx.Tasks = {
    Tasklists: { list: () => ({ items: [{ id: 'L1', title: 'Meves tasques' }] }) },
    Tasks: {
      list: (ll, p) => ({ items: (tasques[ll] || []).filter(
        (t) => (p && p.showCompleted) || t.status !== 'completed') }),
      get: (ll, id) => JSON.parse(JSON.stringify((tasques[ll] || []).filter((x) => x.id === id)[0])),
      update: (t, ll, id) => { tasques[ll] = tasques[ll].map((x) => (x.id === id ? t : x)); return t; }
    }
  };
  ctx.Tasques.sincronitzaLlistes();

  const senyalDe = (quin) => {
    const s = ctx.Tasques.senyals().filter((x) => x.id.indexOf(quin) === 0)[0];
    return s || null;
  };

  /* NOMÉS EN SURT UNA, la més antiga: és una regla que ja hi era —dir-li que
     en té set és donar-li set motius per no obrir res—. Per això cada cas es
     prova amb la seva tasca sola. */
  const totes = tasques.L1.slice();
  const nomes = function (id) {
    tasques.L1 = totes.filter(function (t) { return t.id === id; });
  };

  // --- 1. La de dotze dies: demana el pas, no la feina
  nomes('g1');
  let s = senyalDe('tasca_encallada:g1');
  cal('la de dotze dies surt', !!s, JSON.stringify(ctx.Tasques.senyals()));
  cal('i no demana que la faci: demana el primer pas',
      /primers deu minuts/.test(s.text) && /i quan/.test(s.text), s.text);

  nomes('g3');
  cal('la de dos dies no surt: la vida va així',
      !/Comprar pinso/.test(JSON.stringify(ctx.Tasques.senyals())));
  tasques.L1 = totes.slice();

  /* CAP SENYAL POT RENYAR NI COMPTAR FRACASSOS. És la regla que fa que això
     serveixi: sentir-se malament amb una tasca és el que fa que l'apartis. */
  const totsElsTextos = () => ctx.Tasques.senyals().map((x) => x.text).join(' § ');
  cal('cap senyal fa retret',
      !/hauries|per fi|encara no|una altra vegada|ja va sent hora|vergony/i.test(totsElsTextos()),
      totsElsTextos());

  // --- 2. Passat un mes, canvia de to i no diu els dies
  nomes('g2');
  s = senyalDe('tasca_encallada:g2');
  cal('passat un mes, ja no compta els dies', !/50 dies|\d+ dies/.test(s.text), s.text);
  cal('i diu que això passa, que és el que redueix la següent vegada',
      /no passa res/.test(s.text), s.text);
  cal('i ofereix la sortida honesta: si no la faràs, treu-la',
      /treu-la/.test(s.text), s.text);

  // --- 3. Amb pla escrit, el senyal el recorda en comptes de demanar-ne un
  ctx.Tasques.edita({ id: 'g2', llista: 'L1',
                      primer_pas: 'Buscar el telèfon del dentista i apuntar-lo',
                      pas_quan: 'demà després de dinar' });
  const marca = fulls.TasquesMarques.filter((f) => f.tasca === 'g2')[0];
  cal('el pla es desa a JEFE, no a Google',
      !!marca && marca.primer_pas === 'Buscar el telèfon del dentista i apuntar-lo' &&
      marca.pas_quan === 'demà després de dinar', JSON.stringify(marca));
  cal('i Google Tasks no se n\'assabenta',
      !/dentista i apuntar/.test(JSON.stringify(tasques)));

  const ambPla = ctx.Tasques.senyals().filter((x) => x.id.indexOf('tasca_pla:') === 0)[0];
  cal('amb pla, el senyal el recorda', !!ambPla, JSON.stringify(ctx.Tasques.senyals()));
  cal('i el recorda sencer: què i quan',
      /Buscar el telèfon/.test(ambPla.text) && /després de dinar/.test(ambPla.text),
      ambPla.text);
  cal('i ja no en demana cap altre', !/primers deu minuts/.test(ambPla.text), ambPla.text);

  // --- 4. La pantalla el porta, i la pila de la setmana també
  const p = ctx.Tasques.pantalla({});
  const t2 = p.tasques.filter((x) => x.id === 'g2')[0];
  cal('la pantalla porta el pas i el quan',
      t2.primerPas === 'Buscar el telèfon del dentista i apuntar-lo' &&
      t2.passQuan === 'demà després de dinar');

  const set = ctx.Tasques.laSetmana('2026-08-03', '2026-08-09');
  const aLaPila = set.coses.filter((c) => c.data === null)[0];
  cal('a la pila de la setmana hi surt el pas i no els dies que fa',
      /Buscar el telèfon/.test(aLaPila.menut) && !/dies sense moure/.test(aLaPila.menut),
      aLaPila.menut);

  // --- 5. Dit parlant
  ctx.Tasques.primerPasPerNom({ text: 'dentista', pas: 'Obrir el web i mirar els horaris',
                                quan: 'dilluns al matí' });
  const m2 = fulls.TasquesMarques.filter((f) => f.tasca === 'g2')[0];
  cal('també es pot apuntar parlant-hi', m2.primer_pas === 'Obrir el web i mirar els horaris');
  let error = '';
  try { ctx.Tasques.primerPasPerNom({ text: 'dentista', pas: '  ' }); }
  catch (e) { error = e.message; }
  cal('i un pas buit no es desa', /primer pas/.test(error), error);
}

console.log('\nLa quota és per model: si el bo diu prou, la pregunta passa al petit');
{
  const ctx = carregaTotElServidor();
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Utils.ara = () => '2026-08-06T22:35:00+02:00';
  ctx.Utils.avui = () => '2026-08-06';
  ctx.Config = {
    get: (k) => ({ model_bo: 'flash-gros', model_barat: 'flash-petit',
                   proveidor_ia: 'gemini', ia_activa: 'SI' }[k] || null),
    esSi: (k) => k === 'ia_activa',
    zonaHoraria: () => 'Europe/Madrid', getNum: (k, d) => d
  };
  ctx.PropertiesService = { getScriptProperties: () => ({
    getProperty: () => 'una-clau', setProperty() {} }) };
  ctx.CacheService = { getScriptCache: () => ({ get: () => null, put() {} }) };
  ctx.Utilities.sleep = () => {};

  /* GEMINI DE MENTIDA, però pel mateix forat que el de debò: es falseja
     `UrlFetchApp`, no cap funció interna. Així la prova passa també per la
     lectura del 429 i per com se'n treu el temps d'espera, que és on hi
     havia el detall que ho explicava tot. */
  var demanats = [];
  var tocats = { 'flash-gros': true, 'flash-petit': false };

  var resposta429 = {
    getResponseCode: function () { return 429; },
    getContentText: function () {
      return JSON.stringify({ error: { code: 429, message: 'Quota exceeded', details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '40s' }
      ] } });
    }
  };
  var respostaBona = function (text) {
    return {
      getResponseCode: function () { return 200; },
      getContentText: function () {
        return JSON.stringify({
          candidates: [{ content: { parts: [{ text: text }], role: 'model' }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 }
        });
      }
    };
  };

  ctx.UrlFetchApp.fetch = function (url) {
    var model = decodeURIComponent(String(url).split('/models/')[1].split(':')[0]);
    demanats.push(model);
    return tocats[model] ? resposta429 : respostaBona('contestat pel ' + model);
  };

  var r = ctx.IA.genera({ sistema: 's', missatges: [], eines: [], model: 'bo' });
  cal('la pregunta es contesta igualment', r.text === 'contestat pel flash-petit', r.text);
  cal('i la contesta el model petit', r.model === 'flash-petit', r.model);
  cal('ho diu, que la resposta ve del petit', r.rebaixat === true);
  cal('ha provat el gros primer i el petit després',
      demanats.join(' → ') === 'flash-gros → flash-petit', demanats.join(' → '));

  /* NO ES BAIXA DUES VEGADES. Si el petit també està tocat, es falla i es
     diu; insistir només gastaria més quota per acabar igual. */
  demanats = []; tocats['flash-petit'] = true;
  var error = '';
  try { ctx.IA.genera({ sistema: 's', missatges: [], eines: [], model: 'bo' }); }
  catch (e) { error = e.message; }
  cal('si tots dos estan tocats, es falla', /límit|Quota|quota/.test(error), error);
  cal("i no s'hi insisteix: un intent per model i prou",
      demanats.length === 2, demanats.join(' → '));
  cal("i el missatge diu quant s'ha d'esperar", /40/.test(error), error);

  /* Demanant el petit directament, no hi ha cap altre camí on anar. */
  demanats = [];
  try { ctx.IA.genera({ sistema: 's', missatges: [], eines: [], model: 'barat' }); } catch (e) {}
  cal('des del petit no es baixa enlloc', demanats.length === 1, demanats.join(' → '));

  /* I la primera volta de l'assistent ha de demanar el barat: és on se'n
     va la meitat de les peticions, i triar una eina no vol el model bo. */
  const font = fs.readFileSync('apps-script/55_Assistent.gs', 'utf8');
  cal('la primera volta demana el model petit',
      /model:\s*volta === 0 \? 'barat' : 'bo'/.test(font));

  /* ══════════════════════════════════════════════════════════════════════
     UNA RESPOSTA A MITGES NO ES POT ENSENYAR COM SI FOS SENCERA

     El proveïdor diu per què ha parat i aquí no ho mirava ningú. Va sortir a
     la llum amb la lectura de les fotos: «...i a la part baixa de l'abdomen.
     La caiguda» i s'acabava allà, presentada com la resposta. El sostre de
     tokens el comparteixen el que escriu i el que rumia, i un model que
     rumia vuit-cents deixa trenta paraules.
     ══════════════════════════════════════════════════════════════════════ */
  tocats['flash-gros'] = false; tocats['flash-petit'] = false;

  let sostres = [];
  const respostaTallada = (text, pensats) => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      candidates: [{ content: { parts: [{ text }], role: 'model' }, finishReason: 'MAX_TOKENS' }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 30, thoughtsTokenCount: pensats }
    })
  });

  /* Primer cas: es talla, i amb més sostre acaba la frase. */
  ctx.UrlFetchApp.fetch = function (url, opcions) {
    sostres.push(JSON.parse(opcions.payload).generationConfig.maxOutputTokens);
    return sostres.length === 1
      ? respostaTallada('La caiguda', 820)
      : respostaBona('La caiguda de l\'abdomen és clara. I ja està.');
  };
  let r2 = ctx.IA.genera({ sistema: 's', missatges: [], model: 'bo', maxTokens: 900 });
  cal('si es talla, es torna a demanar amb més sostre', sostres.length === 2,
      sostres.join(' → '));
  cal('i el sostre nou és molt més gran, no un pèl més',
      sostres[1] >= sostres[0] * 3, sostres.join(' → '));
  cal('i el que arriba és la frase sencera', /I ja està/.test(r2.text), r2.text);
  cal('i no queda marcada com a tallada', !r2.tallat);

  /* Segon cas: es torna a tallar. Llavors NO s'amaga: va marcada. */
  sostres = [];
  ctx.UrlFetchApp.fetch = function (url, opcions) {
    sostres.push(JSON.parse(opcions.payload).generationConfig.maxOutputTokens);
    return respostaTallada('La caiguda', 2400);
  };
  let r3 = ctx.IA.genera({ sistema: 's', missatges: [], model: 'bo', maxTokens: 900 });
  cal('si torna a tallar-se, es diu que està tallada', r3.tallat === true);
  cal('però no s\'insisteix més enllà del segon intent', sostres.length === 2,
      sostres.join(' → '));

  /* I una resposta normal no ha de portar cap marca ni cap petició de més. */
  sostres = [];
  ctx.UrlFetchApp.fetch = function (url, opcions) {
    sostres.push(JSON.parse(opcions.payload).generationConfig.maxOutputTokens);
    return respostaBona('sencera');
  };
  let r4 = ctx.IA.genera({ sistema: 's', missatges: [], model: 'bo', maxTokens: 900 });
  cal('una resposta que acaba bé es demana un sol cop i no porta marca',
      sostres.length === 1 && !r4.tallat, sostres.join(' → '));

  /* I qui la reculli ho ha de fer arribar a la pantalla: una lectura del cos
     a mitges no és mitja lectura, és una que diu una cosa diferent. */
  const seg = fs.readFileSync('apps-script/40_Mod_Seguiment.gs', 'utf8');
  const cos = (desde, fins) => {
    const i0 = seg.indexOf(desde), i1 = seg.indexOf(fins, i0);
    return i0 >= 0 && i1 > i0 ? seg.slice(i0, i1) : '';
  };
  const fotos = cos('function analitzaFotos(data) {', '// ------------------------------------------------------ CONTEXT I RESUMS');
  const coment = cos('function comenta(data) {', 'function linia_(');
  cal('la lectura de les fotos torna la marca', /tallat: !!r\.tallat/.test(fotos),
      fotos.slice(-200));
  cal('i el comentari del control també', /tallat: !!r\.tallat/.test(coment),
      coment.slice(-200));
  const vs = fs.readFileSync('apps-script/vista_seguiment.html', 'utf8');
  cal('i la pantalla ho diu en comptes de fer veure que està acabat',
      /S\\'ha quedat a mitges/.test(vs));
  cal('i una lectura tallada no es desa al telèfon',
      /if \(!r\.tallat\) Cau\.set\('seg\.ullada\.'/.test(vs));
}

// ------------------------------------------------------------------- diari
console.log('\nEl diari: dues desades alhora no poden fer dos dies');
{
  const ctx = carregaTotElServidor();
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Utils.avui = () => '2026-08-06';
  ctx.Utils.ara = () => '2026-08-06T23:50:00+02:00';

  let files = [], seguit = 0;
  ctx.Dades = {
    llegeix: (full, filtre) => files.filter((f) => !filtre || filtre(f))
      .map((f) => JSON.parse(JSON.stringify(f))),
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

  /* El bloqueig, comptat. El que es prova no és que el LockService funcioni
     —això és de Google— sinó que l'escriptura hi passi per dins: sense això,
     dues desades que arriben juntes fan dues files del mateix dia. */
  let bloquejos = 0;
  ctx.LockService = { getScriptLock: () => ({
    tryLock: () => { bloquejos++; return true; }, releaseLock() {} }) };

  ctx.Diari.escriu('2026-08-06', 'Avui dia llarg al centre', 3, 'app');
  cal('escriure el diari passa pel bloqueig', bloquejos === 1, bloquejos);
  cal('i ha fet una fila', files.length === 1, files.length);

  /* La segona desada del mateix dia ACTUALITZA, no n'afegeix una altra. És
     el que ja feia, i el que la cursa es saltava. */
  ctx.Diari.escriu('2026-08-06', 'Avui dia llarg al centre, amb un cafè', 3, 'app');
  cal('desar dos cops el mateix dia no fa dos dies', files.length === 1, files.length);
  cal('i el text és el segon', /cafè/.test(files[0].text), files[0].text);

  /* Un altre dia sí que és una fila nova. */
  ctx.Diari.escriu('2026-08-05', 'Ahir', 2, 'app');
  cal('un altre dia sí que n\'afegeix', files.length === 2);

  /* I la neteja del que ja va quedar duplicat: es queda la més llarga i les
     altres es marquen, no s'esborren. */
  files.push({ id: 'dup1', data: '2026-08-04', tipus: 'entrada',
               text: 'Text curt', anim: 3, creat_el: '2026-08-04T20:00:00+02:00' });
  files.push({ id: 'dup2', data: '2026-08-04', tipus: 'entrada',
               text: 'Text molt més llarg amb tot el que va passar', anim: 3,
               creat_el: '2026-08-04T20:00:01+02:00' });

  const src = fs.readFileSync('apps-script/90_Instalacio.gs', 'utf8');
  const tros = src.slice(src.indexOf('function reparaDiari('),
                         src.indexOf('/** El mateix, mirant i sense tocar. */'));
  ctx.Logger = { log() {} };
  vm.runInContext(tros, ctx);

  ctx.reparaDiari(true);
  cal('en simulació no es toca res',
      files.filter((f) => f.esborrat_el).length === 0);

  ctx.reparaDiari();
  const vius = files.filter((f) => !f.esborrat_el && f.data === '2026-08-04');
  cal('després de reparar en queda una', vius.length === 1, vius.length);
  cal('i es queda la que té més text', /molt més llarg/.test(vius[0].text), vius[0].text);
  cal('l\'altra no s\'esborra: es marca',
      files.filter((f) => f.id === 'dup1')[0].esborrat_el !== undefined);

  /* I el client no ha d'enviar dues desades a la vegada. */
  const vd = fs.readFileSync('apps-script/vista_diari.html', 'utf8');
  cal('el client no envia dues desades alhora', /var desant = false, pendent = null;/.test(vd));
  cal('i la que s\'ha demanat mentrestant es fa després', /function acabaDesada\(\)/.test(vd));
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
  cal('hi ha eines que saben ensenyar', ambEnsenya.length >= 3,
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

// ═══════════════════════════════════════════════ EL FULL ÍNDEX: CAP SENSE PORTA
/* La pantalla d'arrencada era la conversa, i des d'allà un botó de quadrícula
   obria el tauler amb TOTS els apartats. En treure-la, aquell botó se'n va
   anar amb ella i sis pantalles es van quedar sense manera d'obrir-se: hi
   eren, funcionaven, i no s'hi podia arribar. Ho vaig veure comptant portes,
   no provant-ho —i és exactament la mena de cosa que no es nota fins que un
   dia en necessites una.

   Ara l'índex les llista totes: les que reporten una xifra van a la graella
   i la resta a la tira de sota. Això ho comprova. */
console.log('\nEl full índex: cap apartat es pot quedar sense porta');
{
  const ctx = carregaTotElServidor();
  ctx.Log = { info() {}, avis() {}, error() {} };
  ctx.Dades = { llegeix: () => [] };
  ctx.Config = { get: () => null, getNum: (k, v) => v, esSi: () => false };

  const ambVista = ctx.Moduls.perAlClient().filter((m) => m.teVista);
  cal('hi ha mòduls amb pantalla', ambVista.length >= 8, String(ambVista.length));

  const inici = fs.readFileSync('apps-script/vista_inici.html', 'utf8');
  cal('l\'índex llista TOTS els mòduls que tenen pantalla',
      /m\.teVista && m\.id !== 'conversa'/.test(inici));

  /* ELS QUE NO SÓN PER A ELL. La memòria i les relacions són eines de dins
     —què sap l'app de tu i què ha vist creuant dades—: hi entra molt de tant
     en tant i a la graella ocupaven el mateix que els hàbits. Van a una icona
     al marge del capçal. Ho declara el mòdul i no la pantalla, perquè si demà
     en neix un altre d'aquesta mena s'ha de col·locar sol. */
  const secundaris = ctx.Moduls.perAlClient().filter((m) => m.secundari);
  cal('la memòria i les relacions es declaren eines de dins',
      secundaris.map((m) => m.id).sort().join(',') === 'memoria,relacions',
      secundaris.map((m) => m.id).join(','));
  cal('i el nucli ho porta fins a la pantalla',
      /secundari: !!m\.secundari/.test(fs.readFileSync('apps-script/20_Moduls.gs', 'utf8')));
  cal('la graella les deixa fora',
      /function apartats\(\)[\s\S]{0,140}!m\.secundari/.test(inici));
  cal('i el capçal les recull, que si no desapareixerien',
      /function eines\(\)[\s\S]{0,140}m\.secundari/.test(inici) && /class="cap-eina"/.test(inici));

  /* Les pantalles que no són de cap mòdul s'han d'afegir a mà, i per tant són
     les que es poden oblidar. Aquestes dues han de tenir porta sempre. */
  cal('el dia hi és, i per partida doble: la data i el botó',
      (inici.match(/data-ves="dia"/g) || []).length >= 2, inici.match(/data-ves="dia"/g) + '');
  cal('i la setmana també', /data-ves="setmana"/.test(inici));

  /* I EL FONS DE CORBES. És l'única cosa del disseny que en Pol ha demanat
     expressament que no es perdi, i viu en una línia que és fàcil que caigui
     en una neteja: sense ella la pàgina segueix funcionant i es veu plana. */
  cal('el fons de corbes de nivell hi és', /Relleu\.fons\(/.test(inici));
  const estil = fs.readFileSync('apps-script/ui_estil.html', 'utf8');
  cal('i té on posar-se, darrere de tot i sense agafar cap toc',
      /\.reticula \{[^}]*position: fixed[^}]*pointer-events: none/.test(estil));

  /* I LA LLISTA DEL MIRALL NO POT ANAR PER LLIURE. S'ha desincronitzat dues
     vegades —primer hi faltava l'escola, després la memòria—, i des del
     mirall no es nota: senzillament hi ha una porta menys que a l'app. */
  const dades = fs.readFileSync('eines/mirall-dades.mjs', 'utf8');
  const bloc = dades.slice(dades.indexOf('const nucliInici'), dades.indexOf('targetes:', dades.indexOf('const nucliInici')));
  const alMirall = (bloc.match(/id: '([a-z]+)'/g) || []).map((s) => s.slice(5, -1));
  const falten = ambVista.map((m) => m.id).filter((id) => alMirall.indexOf(id) === -1);
  cal('el mirall ensenya els mateixos apartats que l\'app', falten.length === 0,
      'al mirall hi falta: ' + falten.join(', '));
}

// ═════════════════════════════════════════════ LA IA, AMAGADA I A LA CANTONADA
/* Va ser la pantalla d'arrencada i es va treure: per FER una cosa és més
   ràpid fer-la que demanar-la. Per PREGUNTAR encara serveix, i torna com el
   que havia de ser des del principi —un botó a la cantonada i un calaix—.

   El que es comprova aquí és el que no pot caure mai: que res del que
   escrigui passi sense confirmar-ho. */
console.log('\nEl calaix de preguntar: la IA amagada');
{
  const xat = fs.readFileSync('apps-script/ui_xat.html', 'utf8');
  const index = fs.readFileSync('apps-script/ui_index.html', 'utf8');
  const estil = fs.readFileSync('apps-script/ui_estil.html', 'utf8');
  const icones = fs.readFileSync('apps-script/ui_icones.html', 'utf8');

  cal('el botó viu fora de les vistes, per poder preguntar des d\'on siguis',
      /id="b-jefe"/.test(index) && /include\('ui_xat'\)/.test(index));
  cal('i porta la marca de l\'app', /use href="#ic-jefe"/.test(index) &&
      /symbol id="ic-jefe"/.test(icones));
  cal('va a la cantonada, sobre la marca de versió',
      /\.flotant \{[^}]*position: fixed/.test(estil));

  /* LA REGLA QUE NO POT CAURE. Les eines que escriuen no s'executen: tornen
     una proposta amb un botó. Si això es perdés, la IA passaria a poder
     tocar el full sense que ell ho sàpiga. */
  cal('cap escriptura passa sense confirmar-la',
      /crida\('conversa', 'confirma', \{ eina: p\.eina, args: p\.args \}\)/.test(xat));
  cal('i mentre no la confirmes, hi ha els dos botons',
      /data-si="1"/.test(xat) && /data-no="1"/.test(xat));
  cal('un cop resolta, els botons se\'n van i queda com ha anat',
      /if \(!p \|\| p\.resolta\) return;/.test(xat) && /function finalDe\(p\)/.test(xat));

  /* En confirmar, el que hi ha desat d'aquell mòdul ja no val. El mòdul ve
     amb la proposta, o sigui que un mòdul nou no ha de tocar res d'aquí. */
  cal('i el que hi havia desat d\'aquell mòdul s\'oblida',
      /if \(p\.modul\) Cau\.oblida\(p\.modul\);/.test(xat));

  /* El text del model porta asteriscos i guions. S'escapa PRIMER i es
     formata després: al revés, un text amb un `<` s'hi colaria com a
     etiqueta. */
  cal('el text s\'escapa abans de formatar-lo',
      /var t = esc\(String\(text \|\| ''\)\)\.trim\(\);/.test(xat));

  cal('no hi ha micròfon enlloc',
      !/micro|SpeechRecognition|enviaVeu/.test(xat), 'n\'hi ha quedat algun rastre');
}

console.log(falles ? '\n' + falles + ' falla(des).\n' : '\nTot correcte.\n');
process.exit(falles ? 1 : 0);
