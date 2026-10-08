/**
 * JEFE — MIRALL: l'app de debò al navegador, amb un servidor fingit
 *
 *   npm run mirall [vista]        habits · nutricio · finances · tasques · diari · conversa · inici
 *
 * Agafa el `index.html` construït —el mateix codi que et serveix Apps Script—
 * i, just abans de l'arrencada, canvia `crida()` i `escriu()` per un servidor
 * de mentida amb dades inventades. Així es pot obrir qualsevol pantalla i
 * tocar-la sense clau, sense connexió i sense tocar ni una dada teva.
 *
 * PER QUÈ EXISTEIX
 *   `npm run comprova` i `npm run prova` no veuen res del que es VEU. Scroll
 *   horitzontal al mòbil, un text que no es llegeix sobre el seu fons, un
 *   botó que queda fora de pantalla: tot això passa totes les comprovacions i
 *   es veu en tres segons mirant-ho. Aquesta eina és per mirar-ho.
 *
 * LES DADES SÓN INVENTADES i la pàgina ho diu a baix amb una barra vermella.
 * No s'assemblen a les d'en Pol a posta. Viuen a `mirall-dades.mjs`.
 *
 * Genera també `amplades.html`, que ensenya la mateixa pantalla a l'amplada
 * d'un mòbil i a la d'un escriptori alhora: és on surten els desbordaments,
 * que a la finestra del navegador tal com està no es veuen mai.
 */
import fs from 'fs';
import path from 'path';
import { dades } from './mirall-dades.mjs';

const VISTA = process.argv[2] || 'habits';
const CARPETA = process.env.MIRALL_CARPETA || '.mirall';

const ARA = new Date();
/* La data LOCAL, no la de Greenwich. Amb `toISOString` a dos quarts d'una
   de la nit a Madrid encara surt el dia d'abans, i llavors el mirall et
   marca «ahir» al dia d'avui i et fa perseguir un error que no hi és. */
const iso = (d) => [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2),
                    ('0' + d.getDate()).slice(-2)].join('-');
const AVUI = iso(ARA);
const menys = (n) => { const d = new Date(ARA); d.setDate(d.getDate() - n); return iso(d); };

const D = dades(AVUI, menys);
const j = (v) => JSON.stringify(v);

const font = fs.readFileSync('index.html', 'utf8');

// -------------------------------------------------------------- el servidor fals

const MOCK = `
<script>
(function () {
  var AVUI = ${j(AVUI)};
  var HABITS_DIA  = ${j(D.habitsDia(AVUI))};
  var HABITS_MES  = ${j(D.habitsMes())};
  var HISTORICS   = ${j(Object.fromEntries(D.HABITS.map(h => [h.id, D.habitsHistoric(h.id)])))};
  var NUTRI       = { dia: ${j(D.nutriPantalla({ periode: 'dia' }))},
                      setmana: ${j(D.nutriPantalla({ periode: 'setmana' }))},
                      mes: ${j(D.nutriPantalla({ periode: 'mes' }))} };
  var FIN         = { mes: ${j(D.finPantalla({ periode: 'mes' }))},
                      mesos: ${j(D.finPantalla({ periode: 'mesos' }))},
                      estad: ${j(D.finPantalla({ periode: 'estad' }))},
                      revisar: ${j(D.finPantalla({ periode: 'revisar' }))},
                      recurrents: ${j(D.finPantalla({ periode: 'recurrents' }))},
                      patrimoni: ${j(D.finPantalla({ periode: 'patrimoni' }))} };
  var TASQUES       = ${j(D.tasquesPantalla())};
  var TASQUES_FETES = ${j(D.tasquesFetes())};
  var seguit        = 0;
  var MEM = [
    { id: 'mem1', fet: 'La tutora de 2nB és qui em passa les substitucions', mena: 'persona', font: 'conversa', oblidat: false },
    { id: 'mem2', fet: 'Els dimarts a les 17h tinc claustre', mena: 'rutina', font: 'conversa', oblidat: false },
    { id: 'mem3', fet: 'No vull avisos abans de les vuit del matí', mena: 'preferencia', font: 'app', oblidat: false },
    { id: 'mem4', fet: 'Vaig deixar la carrera de muntanya llarga per la lesió del genoll', mena: 'decisio', font: 'conversa', oblidat: false },
    { id: 'mem5', fet: 'Provar de llevar-me a les sis', mena: 'fet', font: 'app', oblidat: true }
  ];
  var DIARI       = ${j(D.diariPantalla({}))};
  var CONV_ESTAT  = ${j(D.conversaEstat())};
  var CONV_HIST   = ${j(D.conversaHistorial())};
  var INICI       = ${j(D.nucliInici())};
  var SEGUIMENT   = ${j(D.segPantalla())};
  /* Cinc setmanes cuinades. La del 20 de juliol son quatre sortides planes i
     la del 27 tres amb desnivell: es el cas que en Pol demanava veure. */
  var ENTRENA     = ${j(Object.fromEntries(
    ['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27', '2026-08-03']
      .map((dl) => [dl, D.entPantalla(dl)])))};
  var DIA_BASE    = ${j(D.elDia({}))};
  var DIA_PAGINA  = function (p) {
    var d = copia(DIA_BASE);
    if (p && p.data && p.data !== AVUI) { d.data = p.data; d.esAvui = false; }
    return d;
  };
  /* LA SETMANA, cinc de fetes. Al mirall no hi ha servidor que en pugui
     calcular una de nova quan toques la fletxa, i una pantalla on les fletxes
     no van no serveix per provar-la: es cuinen aquí cinc setmanes seguides i
     el mirall en tria una per dilluns. */
  var SETMANES    = ${j(Object.fromEntries(
       [-2, -1, 0, 1, 2].map(n => {
         const d = new Date(AVUI + 'T12:00:00');
         d.setDate(d.getDate() + n * 7);
         const s = D.laSetmana({ desde: d.toISOString().slice(0, 10) });
         return [s.desde, s];
       })))};
  var SETMANA_ARA = ${j(D.laSetmana({}).desde)};

  var FOCUS       = ${j(D.focusPantalla())};
  var RELACIONS   = ${j(D.relacions())};
  var CAL         = { calendaris: ${j(D.CALENDARIS)} , fets: [], trets: [] };
  var CAL_MESOS   = ${j(Object.fromEntries(
       [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(n => {
         const d = new Date(Number(AVUI.slice(0,4)), Number(AVUI.slice(5,7)) - 1 + n, 1);
         const m = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
         return [m, D.calendariPantalla({ mes: m })];
       })))};

  var estatDia = JSON.parse(JSON.stringify(HABITS_DIA));
  var nSeq = 100;

  function recalculaNutri() {
    var d = NUTRI.dia.dades;
    d.apats.forEach(function (a) {
      a.kcal = a.items.reduce(function (s, i) { return s + i.kcal; }, 0);
      a.proteina = a.items.reduce(function (s, i) { return s + i.prot; }, 0);
    });
    d.totals = {
      ingerides: d.apats.reduce(function (s, a) { return s + a.kcal; }, 0),
      proteina: d.apats.reduce(function (s, a) { return s + a.proteina; }, 0)
    };
    d.net = d.teCremades ? d.cremades - d.totals.ingerides : null;
    d.verdicte = d.teCremades
      ? { estat: d.net >= d.objectius.deficit ? 'deficit_assolit' : (d.net > 0 ? 'deficit' : 'superavit'),
          text: (d.net >= 0 ? 'Dèficit de ' : 'Superàvit de ') + Math.round(Math.abs(d.net)) + ' kcal' +
                (d.net >= d.objectius.deficit ? ' — objectiu assolit' : '') }
      : { estat: 'sense_dades', text: 'Introdueix les calories cremades per tancar el dia.' };
  }
  var copia = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* Bessona d'Utils.aixafa. Amb normalize('NFD') la a amb accent es parteix en
     dos i queda «pa gina»: per aixo el servidor fa servir una taula, i aqui
     tambe, que si no el mirall no prova el mateix que passa de debo. */
  function aixafa(text) {
    var s = String(text || '').toLowerCase();
    var amb = 'àáâäèéêëìíîïòóôöùúûüñç';
    var sense = 'aaaaeeeeiiiioooouuuunc';
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var n = amb.indexOf(s.charAt(i));
      var c = n === -1 ? s.charAt(i) : sense.charAt(n);
      out += /[a-z0-9]/.test(c) ? c : ' ';
    }
    return out.replace(/ +/g, ' ').trim();
  }

  function habitPerId(id) {
    for (var i = 0; i < estatDia.habits.length; i++) {
      if (estatDia.habits[i].id === id) return estatDia.habits[i];
    }
    return null;
  }

  function respon(modul, accio, p) {
    p = p || {};

    if (modul === 'nucli') {
      if (accio === 'inici') return copia(INICI);
      if (accio === 'moduls') return { moduls: copia(INICI).moduls };
      if (accio === 'estat') return { versio: 'mirall', configurat: true, moduls: INICI.moduls,
                                      problemesEsquema: [], triggers: [], ia: { disponible: false } };
      if (accio === 'notificacions') return { disponible: false, motiu: 'mirall', dispositius: 0 };
      if (accio === 'ping') return { ara: AVUI, versio: 'mirall' };

      /* El paquet: totes les pantalles en una anada. Aquí es munta amb les
         mateixes dades que tornaria cadascuna per separat, que és justament el
         que ha de passar: si el paquet tornés una altra forma, el client
         desaria una cosa que la vista no sap pintar. */
      if (accio === 'paquet') {
        var dins = function (m, a) {
          try { return respon(m, a, {}); } catch (e) { return null; }
        };
        return { avui: AVUI, pantalles: {
          habits: dins('habits', 'pantalla'),
          calendari: dins('calendari', 'pantalla'),
          tasques: dins('tasques', 'pantalla'),
          seguiment: dins('seguiment', 'pantalla'),
          nutricio: dins('nutricio', 'pantalla'),
          finances: dins('finances', 'pantalla'),
          diari: dins('diari', 'pantalla'),
          _dia: copia(DIA_PAGINA({}))
        } };
      }
    }

    /* La memòria del mirall: quatre records inventats i tocables, perquè es
       pugui provar afegir-ne, treure'n i recuperar-ne un. */
    if (modul === 'memoria') {
      var pinta = function (conte) {
        var q = String(conte || '').toLowerCase();
        var vius = MEM.filter(function (r) { return !r.oblidat; });
        if (q) vius = vius.filter(function (r) { return r.fet.toLowerCase().indexOf(q) !== -1; });
        var menes = ['persona', 'preferencia', 'decisio', 'rutina', 'fet'];
        return {
          quants: vius.length,
          blocs: menes.map(function (m) {
            return { mena: m, records: vius.filter(function (r) { return r.mena === m; }) };
          }).filter(function (b) { return b.records.length; }),
          oblidats: MEM.filter(function (r) { return r.oblidat; })
        };
      };
      if (accio === 'pantalla') return copia(pinta(p.conte));
      if (accio === 'recorda') {
        MEM.push({ id: 'mem' + (++seguit), fet: String(p.fet || ''), mena: 'fet',
                   font: 'app', oblidat: false });
        return copia(pinta(''));
      }
      if (accio === 'oblida') {
        MEM.forEach(function (r) { if (r.id === p.id) r.oblidat = true; });
        return copia(pinta(p.conte));
      }
      if (accio === 'recupera') {
        MEM.forEach(function (r) { if (r.id === p.id) r.oblidat = false; });
        return copia(pinta(p.conte));
      }
      return copia(pinta(''));
    }

    if (modul === 'seguiment') {
      if (accio === 'pantalla') return copia(SEGUIMENT);
      if (accio === 'desa') { return { desat: true, data: p.data, id: 'seg_mirall' }; }
      if (accio === 'pujaFoto') return { id: 'mirall', angle: p.angle, data: p.data };
      if (accio === 'esborraFoto') { window.__ultimEsborrat = p; return { tret: true, paperera: true }; }
      if (accio === 'comenta') return { comentari: 'Comentari inventat del mirall: aqui no hi ha cap IA.', data: p.data };
      /* La lectura de les fotos. Aqui no s obre cap imatge ni es crida ningu:
         el que es prova es que el boto la demani, que la resposta es pinti i
         que quedi desada al telefon per no tornar-la a demanar. */
      if (accio === 'analitzaFotos') {
        window.__ultimaUllada = p;
        return { comentari: 'Lectura inventada del mirall: aqui no hi ha cap IA ni cap foto.',
                 data: p.data, fotos: 3, desde: '2026-06-12' };
      }
    }

    if (modul === 'entrenaments') {
      if (accio === 'pantalla') {
        /* La setmana que demani, o la mes recent que hi hagi cuinada. */
        var claus = Object.keys(ENTRENA).sort();
        var vol = p && p.desde ? p.desde : claus[claus.length - 1];
        var tria = claus[0];
        for (var ci = 0; ci < claus.length; ci++) if (claus[ci] <= vol) tria = claus[ci];
        return copia(ENTRENA[tria]);
      }
      if (accio === 'desa') return { desat: true, id: 'ent_mirall', data: p.data };
      if (accio === 'esborra') return { tret: true };
      if (accio === 'desaPassos') return { desat: true, dilluns: p.dilluns,
        total: p.total || (p.mitjana || 0) * 7, mitjana: p.mitjana || Math.round((p.total || 0) / 7) };
      /* La lectura de la captura. Aqui no s obre cap imatge ni es crida ningu:
         es torna una proposta cuinada —amb una fila dubtosa a posta— per poder
         provar que es pugui repassar, corregir la data i desar nomes el que
         s hagi marcat. */
      if (accio === 'llegeixCaptura') {
        window.__ultimaCaptura = { mena: p.mena, mida: String(p.contingut || '').length };
        if (p.mena === 'passos') {
          return { mena: 'passos', dilluns: p.dilluns,
                   passos: { total: 81250, mitjana: null }, avis: '' };
        }
        return { mena: p.mena, dilluns: p.dilluns, avis: '', sessions: [
          { data: '2026-07-28', mena: 'trail', titol: 'Sèries a la pujada', km: 7.8,
            desnivell: 480, minuts: 62, pulsacions: 163, font: 'captura',
            kmEsforc: 12.6, dubtosa: false },
          { data: '2026-07-29', mena: 'forca', titol: 'Esquena i espatlles', km: null,
            desnivell: null, minuts: 38, pulsacions: null, font: 'captura',
            kmEsforc: null, dubtosa: false },
          { data: null, mena: 'trail', titol: 'Sortida sense dia', km: 5.4,
            desnivell: 120, minuts: 36, pulsacions: 150, font: 'captura',
            kmEsforc: 6.6, dubtosa: true }
        ] };
      }
      if (accio === 'confirmaCaptura') {
        window.__ultimaConfirmacio = p;
        return { desats: (p.sessions || []).length };
      }
    }

    if (modul === 'conversa') {
      if (accio === 'estat') {
        var ce = copia(CONV_ESTAT);
        if (p.ambHistorial) ce.historial = copia(CONV_HIST);
        return ce;
      }
      if (accio === 'historial') return copia(CONV_HIST);
      if (accio === 'nova') return { id_conversa: 'cnv_nou', missatges: [] };
      if (accio === 'elDia') return DIA_PAGINA(p);
      if (accio === 'laSetmana') {
        var dl = SETMANA_ARA;
        if (p && p.desde) {
          /* El dilluns del que demani. Les claus són dilluns; qualsevol dia
             de la setmana ha de trobar la seva. */
          var claus = Object.keys(SETMANES).sort();
          dl = claus[0];
          for (var ci = 0; ci < claus.length; ci++) if (claus[ci] <= p.desde) dl = claus[ci];
        }
        var s = SETMANES[dl];
        if (!s) throw new Error('El mirall només té cinc setmanes cuinades.');
        return copia(s);
      }
      if (accio === 'enviaVeu') {
        /* El mirall no pensa, però sí que diu QUÈ li ha arribat. És l'única
           manera de comprovar que el so surt d'aquí sencer i ben format sense
           tenir cap micròfon al davant. */
        var b64 = p.audio || '';
        window.__ultimSo = { mida: b64.length, mime: p.mime, cap: b64.slice(0, 64) };
        // El mirall fingeix que ha transcrit el que se li digui a __digues.
        var dit = window.__digues || 'quants cigarros he fumat avui';
        var net = aixafa(dit);   // com ho fa el servidor: taula, no normalize
        if (net.indexOf('pagina del dia') !== -1) {
          return { id_conversa: 'cnv_mirall', pregunta: dit,
                   drecera: { vista: 'dia', params: null },
                   temps: { total: 900, veu: 900, ia: 0, context: 0, eines: 0, voltes: 0, rumiat: 0 } };
        }
        return { id_conversa: 'cnv_mirall', pregunta: dit,
                 resposta: 'He rebut ' + Math.round(b64.length * 0.75 / 1024) + ' kB de so.',
                 eines: [], propostes: [], tokens: { entrada: 0, sortida: 0 },
                 temps: { total: 2600, veu: 900, ia: 1700, context: 0, eines: 0, voltes: 1 } };
      }
      /* CONFIRMAR UNA ESCRIPTURA. Aquí no es desa res: el que s'ha de poder
         mirar és la roda sencera —proposta, «sí», «Fet.»— sense cap IA. */
      if (accio === 'confirma') {
        window.__confirmades = (window.__confirmades || []).concat([{ eina: p.eina, args: p.args }]);
        return { fet: true, eina: p.eina };
      }

      /* EL MIRALL NO PENSA, PERÒ SÍ QUE SAP FER UNA PROPOSTA.
         Cap escriptura de JEFE passa sense confirmar-la, i des que també es
         pot confirmar DIENT-HO, aquell requadre és el pas per on passa tot el
         que fas parlant. Sense poder-lo veure aquí, l'única manera de mirar-lo
         seria a l'app de debò i gastant quota. Les propostes surten de verbs,
         no de cap model: escriu «apunta 30 euros de gasolina» i ja hi és. */
      if (accio === 'envia') {
        var q = aixafa(String((p && p.text) || ''));
        var verbs = ['apunta', 'apuntam', 'marca', 'esborra', 'treu', 'peso', 'registra', 'posa'];
        var escriu = verbs.some(function (v) { return q.indexOf(v) === 0 || q.indexOf(' ' + v + ' ') !== -1; });
        if (!escriu) {
          /* El mirall no pensa, però contesta amb la FORMA d'una resposta:
             negreta, un parell de pics i prou. Sense això, l'única manera de
             mirar com queda el calaix de preguntar era a l'app de debò
             gastant quota, i per tant no es mirava. */
          return { id_conversa: 'cnv_mirall',
                   resposta: 'Aquest mes portes **320,40 €** gastats, que és menys que el ' +
                             'passat pel mateix dia.\\n- Menjar: 148,20 €\\n- Cotxe: 92,00 €\\n' +
                             '- La resta: 80,20 €\\nEl mirall no pensa: aquesta resposta és inventada.',
                   eines: [], propostes: [], tokens: { entrada: 0, sortida: 0 },
                   temps: { total: 1400, ia: 1400, context: 0, eines: 0, voltes: 1 } };
        }

        var quantes = q.indexOf(' i ') !== -1 ? 2 : 1;
        var props = [];
        for (var pi = 0; pi < quantes; pi++) {
          props.push({ eina: 'eina_del_mirall', modul: 'mirall', accio: 'inventada',
                       etiqueta: pi === 0 ? '30,00 € · gasolina · avui'
                                          : 'Marcar «córrer» com a fet · avui',
                       args: { i: pi } });
        }
        return { id_conversa: 'cnv_mirall', resposta: 'Ho deixo preparat.',
                 eines: [], propostes: props, tokens: { entrada: 0, sortida: 0 },
                 temps: { total: 1200, ia: 1200, context: 0, eines: 0, voltes: 1 } };
      }
    }

    if (modul === 'focus') {
      if (accio === 'pantalla') return copia(FOCUS);
      if (accio === 'apunta') {
        var f = copia(FOCUS);
        f.blocs.push({ hora: '—', minuts: p.minuts, complet: !!p.complet,
                       tasca: p.tasca_text || '' });
        f.minutsAvui += p.minuts;
        FOCUS = f;
        return copia(f);
      }
    }

    if (modul === 'relacions') {
      if (accio === 'pantalla') return copia(RELACIONS);
      if (accio === 'recalcula') return copia(RELACIONS);
    }

    if (modul === 'habits') {
      if (accio === 'dia') {
        var d = copia(estatDia);
        if (p.data && p.data !== d.data) {          // un altre dia: buit, com a la vida
          d.data = p.data; d.esAvui = false;
          d.habits.forEach(function (h) { h.valor = null; h.registrat = false; h.complert = false; });
        }
        return d;
      }
      if (accio === 'mes') {
        /* Amb corbes només si les demanen, com el servidor. */
        var mm = copia(HABITS_MES);
        if (!(p && p.comptadors)) delete mm.comptadors;
        return mm;
      }
      if (accio === 'pantalla') {
        var dd = copia(estatDia);
        if (p.data && p.data !== dd.data) {
          dd.data = p.data; dd.esAvui = false;
          dd.habits.forEach(function (h) { h.valor = null; h.registrat = false; h.complert = false; });
        }
        return { dia: dd, mes: HABITS_MES };
      }
      if (accio === 'historic') return HISTORICS[p.id] || HISTORICS.h1;
      if (accio === 'marca') {
        var h = habitPerId(p.id);
        if (h) {
          h.valor = (p.valor === null || p.valor === undefined)
            ? (h.complert ? 0 : h.objectiu) : p.valor;
          h.registrat = true;
          h.complert = h.esComptador ? false : h.valor >= h.objectiu;
        }
        /* EL MES QUE TORNA DE MARCAR NO PORTA LES CORBES, com al servidor
           de debò: calcular-les a cada toc són noranta dies de full per res.
           El mirall ho tornava amb corbes i per això aquí no es veia mai el
           problema que en Pol sí que tenia: el gràfic del tabac desapareixia
           en marcar qualsevol hàbit. Un mirall que ensenya més del que dona
           el servidor no és un mirall. */
        var m = copia(estatDia);
        m.mes = copia(HABITS_MES);
        delete m.mes.comptadors;
        return m;
      }
      if (accio === 'ordena') {
        var nou = [];
        (p.ids || []).forEach(function (id) { var x = habitPerId(id); if (x) nou.push(x); });
        estatDia.habits.forEach(function (x) { if (nou.indexOf(x) === -1) nou.push(x); });
        estatDia.habits = nou;
        return copia(estatDia);
      }
      if (accio === 'crea' || accio === 'edita' || accio === 'arxiva' || accio === 'reactiva') {
        return { ok: true };
      }
    }

    if (modul === 'nutricio') {
      if (accio === 'pantalla') {
        var n = copia(NUTRI[p.periode || 'dia'] || NUTRI.dia);
        // Un altre dia és un dia en blanc, com a la vida.
        if ((p.periode || 'dia') === 'dia' && p.data && p.data !== AVUI) {
          n.dades.data = p.data;
          n.dades.apats.forEach(function (a) { a.items = []; a.kcal = 0; a.proteina = 0; });
          n.dades.totals = { ingerides: 0, proteina: 0 };
          n.dades.cremades = 0; n.dades.activitat = 0;
          n.dades.teCremades = false; n.dades.teActivitat = false; n.dades.net = null;
          n.dades.verdicte = { estat: 'sense_dades',
                               text: 'Introdueix les calories cremades per tancar el dia.' };
        }
        return n;
      }
      if (accio === 'aliments') return copia(NUTRI.dia.aliments);
      if (accio === 'ajustos') return copia(NUTRI.dia.ajustos);
      /* Escriure de veritat: si el mirall contesta sempre el mateix, un
         formulari que desa sembla que no faci res i no es pot provar el cicle. */
      if (accio === 'afegeix') {
        var d = NUTRI.dia.dades;
        var ap = d.apats.filter(function (a) { return a.clau === p.apat; })[0];
        if (ap) {
          var g = Number(p.grams) || 0;
          ap.items.push({ id: 'i' + (++nSeq), nom: p.nom, grams: g,
                          kcal100: Number(p.kcal100) || 0, prot100: Number(p.prot100) || 0,
                          kcal: g * (Number(p.kcal100) || 0) / 100,
                          prot: g * (Number(p.prot100) || 0) / 100 });
          recalculaNutri();
        }
        return { ok: true };
      }
      if (accio === 'treu') {
        NUTRI.dia.dades.apats.forEach(function (a) {
          a.items = a.items.filter(function (i) { return i.id !== p.id; });
        });
        recalculaNutri();
        return { ok: true };
      }
      if (accio === 'activitat') {
        NUTRI.dia.dades.cremades = NUTRI.dia.dades.activitat = Number(p.kcal) || 0;
        NUTRI.dia.dades.teCremades = (Number(p.kcal) || 0) > 0;
        recalculaNutri();
        return { ok: true };
      }
      if (accio === 'desaAliment' || accio === 'treuAliment' || accio === 'desaAjustos') {
        return { ok: true };
      }
      if (accio === 'importaFitFat') return { simulacio: true, dies: 0, ingestes: 0, avisos: [] };
    }

    if (modul === 'finances') {
      if (accio === 'pantalla') {
        var r = copia(FIN[p.periode || 'mes'] || FIN.mes);
        /* EL MES QUE ES DEMANA, NO SEMPRE EL D'AVUI. La maqueta tornava
           l'agost passés el que passés, i per això el mirall no va poder
           ensenyar que el botó d'anar al mes actual no anava: totes les
           respostes deien el mateix. */
        if ((p.periode || 'mes') === 'mes' && p.mes && r.dades) {
          r.dades.mes = p.mes;
          if (p.mes !== AVUI.slice(0, 7)) {
            r.dades.moviments = (r.dades.moviments || []).filter(function () { return false; });
            r.dades.ingressos = 0; r.dades.despeses = 0; r.dades.balanc = 0;
          }
        }
        return r;
      }
      if (accio === 'categories') return copia(FIN.mes.categories);
      if (accio === 'suggeriments') return copia(FIN.mes.suggeriments);
      if (accio === 'recurrents') return copia(FIN.recurrents.dades.llista);
      if (accio === 'patrimoni') return copia(FIN.patrimoni.dades);
      if (accio === 'perRevisar') return copia(FIN.revisar.dades);
      if (accio === 'estatBanc') return { connectat: false, motiu: 'mirall' };
      /* Dir que no a una proposta la treu de la llista. Al mirall es treu de
         debo de les dades, que es l unica manera de veure que la pantalla
         queda com ha de quedar despres de dir que no. */
      if (accio === 'descarta') {
        window.__ultimDescartat = p.clau;
        var rec = FIN.recurrents.dades;
        rec.propostes = (rec.propostes || []).filter(function (x) { return x.clau !== p.clau; });
        rec.triables = (rec.triables || []).filter(function (x) { return x.clau !== p.clau; });
        return { ok: true };
      }
      if (accio === 'desaRecurrent') {
        window.__ultimRecurrent = p;
        var r2 = FIN.recurrents.dades;
        if (!p.id) {
          r2.llista = r2.llista.concat([{ id: 'r_nou', descripcio: p.descripcio,
            import: p['import'], tipus: p.tipus, categoria: p.categoria,
            categoriaNom: p.categoria, metode: p.metode, dia: p.dia, actiu: true,
            clau: p.clau || '', ultim_mes: '' }]);
          if (p.clau) {
            r2.propostes = (r2.propostes || []).filter(function (x) { return x.clau !== p.clau; });
            r2.triables = (r2.triables || []).filter(function (x) { return x.clau !== p.clau; });
          }
        }
        return { ok: true };
      }
      return { ok: true, tocats: 1 };
    }

    /* Les tasques del mirall es toquen de debò: apuntar-ne una, marcar-la o
       treure-la ha de canviar el que hi ha a la pantalla, si no no es pot
       provar res. Van a la llista principal, com al servidor. */
    if (modul === 'tasques') {
      var caixa = function (id) {
        var b = TASQUES.blocs.filter(function (x) { return x.id === id; })[0];
        if (!b) { b = { id: id, nom: id, tasques: [] }; TASQUES.blocs.push(b); }
        return b;
      };
      var refresca = function () {
        TASQUES.tasques = TASQUES.blocs.reduce(function (l, b) { return l.concat(b.tasques); }, []);
        TASQUES.vencudes = TASQUES.tasques.filter(function (t) { return t.vencuda; }).length;
        return copia(TASQUES);
      };
      var laTasca = function (id) {
        for (var i = 0; i < TASQUES.blocs.length; i++) {
          var t = TASQUES.blocs[i].tasques.filter(function (x) { return x.id === id; })[0];
          if (t) return { t: t, bloc: TASQUES.blocs[i] };
        }
        return null;
      };

      if (accio === 'fetes') return copia(TASQUES_FETES);

      if (accio === 'captura') {
        var pral = TASQUES.llistes.filter(function (l) { return l.principal; })[0] || TASQUES.llistes[0];
        caixa(pral.id).tasques.push({
          id: 'tm_' + (++seguit), llista: pral.id, llistaNom: pral.nom,
          text: String(p.text || ''), nota: '', vencEl: '', vencuda: false,
          venAvui: false, prioritat: '', fent: false, feta: false, fetEl: ''
        });
        return refresca();
      }

      if (accio === 'completa') {
        var q = laTasca(p.id);
        if (q) q.bloc.tasques = q.bloc.tasques.filter(function (x) { return x.id !== p.id; });
        return refresca();
      }

      if (accio === 'treu') {
        var r2 = laTasca(p.id);
        if (r2) r2.bloc.tasques = r2.bloc.tasques.filter(function (x) { return x.id !== p.id; });
        return refresca();
      }

      if (accio === 'edita') {
        var r3 = laTasca(p.id);
        if (r3) {
          var t3 = r3.t;
          if (p.text !== undefined) t3.text = p.text;
          if (p.nota !== undefined) t3.nota = p.nota;
          if (p.venc_el !== undefined) {
            t3.vencEl = p.venc_el || '';
            t3.vencuda = !!t3.vencEl && t3.vencEl < TASQUES.avui;
            t3.venAvui = t3.vencEl === TASQUES.avui;
          }
          if (p.prioritat !== undefined) t3.prioritat = p.prioritat ? 'alta' : '';
          if (p.fent !== undefined) t3.fent = !!p.fent;
          if (p.primer_pas !== undefined) t3.primerPas = String(p.primer_pas || '').trim();
          if (p.pas_quan !== undefined) t3.passQuan = String(p.pas_quan || '').trim();
          if (p.llistaNova) {
            var nova = TASQUES.llistes.filter(function (l) { return l.id === p.llistaNova; })[0];
            if (nova) {
              r3.bloc.tasques = r3.bloc.tasques.filter(function (x) { return x.id !== p.id; });
              t3.llista = nova.id; t3.llistaNom = nova.nom;
              caixa(nova.id).nom = nova.nom;
              caixa(nova.id).tasques.push(t3);
            }
          }
        }
        return refresca();
      }

      if (accio === 'mostra') {
        TASQUES.llistes.forEach(function (l) { if (l.id === p.id) l.mostra = !!p.mostra; });
        TASQUES.blocs = TASQUES.llistes.filter(function (l) { return l.mostra; }).map(function (l) {
          return caixa(l.id).nom === l.id ? { id: l.id, nom: l.nom, tasques: [] } : caixa(l.id);
        });
        return refresca();
      }

      if (accio === 'sincronitza') return refresca();
      return copia(TASQUES);
    }

    if (modul === 'calendari') {
      if (accio === 'calendaris') return copia(CAL.calendaris);
      if (accio === 'sincronitza') return { nous: 0, actualitzats: CAL.calendaris.length,
                                            total: CAL.calendaris.length };
      if (accio === 'elsMeus') {
        var encesos = [];
        CAL.calendaris.forEach(function (c) {
          if (c.principal || /escola/i.test(c.nom)) {   // «els meus», al mirall
            if (!c.mostra) encesos.push(c.nom);
            c.mostra = true;
          }
        });
        return { encesos: encesos };
      }
      if (accio === 'mostra') {
        CAL.calendaris.forEach(function (c) { if (c.id === p.id) c.mostra = !!p.mostra; });
        return { id: p.id, mostra: !!p.mostra };
      }
      /* Apuntar, canviar i treure sí que toquen les dades del mirall. Si no,
         desar una cita ensenyava «Apuntat» i la pantalla quedava igual, i
         llavors no es pot saber si el camí d'anada i tornada funciona. */
      if (accio === 'crea') {
        var nou = {
          id: 'ev_mirall_' + (CAL.fets.length + 1),
          calendari: p.calendari || CAL.calendaris[0].id,
          calendariNom: (CAL.calendaris.filter(function (c) { return c.id === p.calendari; })[0] ||
                         CAL.calendaris[0]).nom,
          color: '', titol: p.titol || '(sense títol)', lloc: p.lloc || '', nota: p.nota || '',
          data: p.data, dataFi: p.data, totElDia: !!p.totdia,
          hora: p.totdia ? '' : (p.hora || '09:00'),
          horaFi: p.totdia ? '' : (p.hora || '09:00'),
          passat: false, minuts: p.totdia ? 0 : Number(p.durada || 60)
        };
        CAL.fets.push(nou);
        return { id: nou.id };
      }
      if (accio === 'edita') {
        CAL.fets.forEach(function (e) {
          if (e.id !== p.id) return;
          if (p.titol !== undefined) e.titol = p.titol;
          if (p.data !== undefined) { e.data = p.data; e.dataFi = p.data; }
          if (p.lloc !== undefined) e.lloc = p.lloc;
        });
        return { id: p.id };
      }
      if (accio === 'treu') {
        CAL.fets = CAL.fets.filter(function (e) { return e.id !== p.id; });
        CAL.trets.push(p.id);
        return { id: p.id };
      }

      if (accio === 'pantalla') {
        var quin = p.mes || AVUI.slice(0, 7);

        var amagats = {};
        CAL.calendaris.forEach(function (c) { if (!c.mostra) amagats[c.id] = true; });

        function munta(m) {
          var base = CAL_MESOS[m];
          var d;
          if (base) {
            d = copia(base).dades;
          } else {
            // Fora del que el mirall té preparat: mes buit, per veure com queda.
            d = copia(CAL_MESOS[AVUI.slice(0, 7)]).dades;
            d.mes = m; d.tots = []; d.diaTriat = m + '-01';
          }
          d.tots = d.tots
            .filter(function (e) { return !amagats[e.calendari] && CAL.trets.indexOf(e.id) === -1; })
            .concat(CAL.fets.filter(function (e) {
              return !amagats[e.calendari] && e.data.slice(0, 7) === m;
            }));
          if (m === quin && p.data) d.diaTriat = p.data;

          var perDia = {};
          d.tots.forEach(function (e) { (perDia[e.data] = perDia[e.data] || []).push(e); });
          d.esdeveniments = perDia[d.diaTriat] || [];
          d.quants = d.tots.filter(function (e) { return e.data.slice(0, 7) === m; }).length;
          d.caselles.forEach(function (c) {
            var seus = perDia[c.data] || [];
            c.quants = seus.length;
            c.mostra = seus.slice(0, 3).map(function (e) {
              return { color: e.color, totElDia: e.totElDia, titol: e.titol, hora: e.hora };
            });
          });
          return d;
        }

        var mesos = {};
        [-2, -1, 0, 1, 2].forEach(function (n) {
          var x = new Date(Number(quin.slice(0, 4)), Number(quin.slice(5, 7)) - 1 + n, 1);
          var k = x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2);
          mesos[k] = munta(k);
        });

        return { dades: mesos[quin], mesos: mesos, calendaris: copia(CAL.calendaris) };
      }
      return { ok: true };
    }

    if (modul === 'diari') {
      if (accio === 'pantalla') {
        var dd = copia(DIARI);
        if (p.data && p.data !== AVUI) { dd.data = p.data; dd.entrada = null; }
        return dd;
      }
      return copia(DIARI);
    }

    throw new Error('El mirall no sap respondre ' + modul + '.' + accio);
  }

  /* Mig segon de retard, que és el que costa de debò. Sense això la pantalla
     es veuria instantània i no es notaria cap dels problemes que hi ha
     justament mentre s'espera. */
  window.crida = function (modul, accio, params) {
    return new Promise(function (ok, mal) {
      setTimeout(function () {
        try { ok(respon(modul, accio, params)); } catch (e) { mal(e); }
      }, 500);
    });
  };
  /* I TAMBÉ PEL FORAT DE LA XARXA.
     Canviar la «crida» global no n'hi ha prou: l'app viu dins d'una funció
     tancada i les crides que fa el NUCLI des de dins resolen la seva còpia
     local, no la global. Només les vistes, que són a fora, veuen la de
     mentida. El resultat era que «nucli.paquet» i «nucli.moduls» sortien a
     la xarxa de debò, contestaven 405 i omplien la consola d'errors que
     tapaven els de veritat: un banc de proves amb un forat a sota.
     Enganxant-se al «fetch» es tanca per sota i no se n'escapa cap. */
  var fetchDeDebo = window.fetch;
  window.fetch = function (url, opcions) {
    if (String(url) !== 'mirall') return fetchDeDebo.apply(this, arguments);
    var p = {};
    try { p = JSON.parse((opcions || {}).body || '{}'); } catch (e) {}
    return new Promise(function (ok) {
      setTimeout(function () {
        var cos;
        try { cos = { ok: true, dades: respon(p.modul, p.accio, p.params || {}) }; }
        catch (e) { cos = { ok: false, error: e.message }; }
        ok({ ok: true, status: 200, json: function () { return Promise.resolve(cos); } });
      }, 500);
    });
  };

  window.escriu = function (modul, accio, params, pantalla) {
    return window.crida(modul, accio, params).then(function () {
      return respon(modul, 'pantalla', pantalla || {});
    });
  };

  try {
    localStorage.setItem('jefe.servidor', JSON.stringify({ url: 'mirall', clau: 'mirall' }));
    localStorage.removeItem('jefe.cua');
  } catch (e) {}
  window.__MIRALL_VISTA = ${j(VISTA)};
})();
</script>
<div style="position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#c8332b;color:#fff;
            font:600 11px/1.6 system-ui;letter-spacing:.08em;text-align:center;padding:3px">
  MIRALL · DADES INVENTADES · NO SÓN LES TEVES
</div>
`;

/* Va DESPRÉS de l'arrencada: el hash no serveix perquè l'arrencada se'l menja. */
const DESPRES = `
<script>
  setTimeout(function () {
    var v = new URLSearchParams(location.search).get('vista') || window.__MIRALL_VISTA;
    if (v && App.vistes[v]) App.ves(v);
  }, 60);
</script>`;

const marca = '<script>\n  (function () {';
if (font.indexOf(marca) === -1) {
  console.error('No trobo el bloc d\'arrencada a index.html. Executa `npm run construeix`.');
  process.exit(1);
}

if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA, { recursive: true });
fs.writeFileSync(path.join(CARPETA, 'index.html'),
  font.replace(marca, MOCK + marca).replace('</body>', DESPRES + '</body>'));

/* Les dues amplades alhora. Els desbordaments no es veuen mai a la finestra
   tal com la tens: es veuen quan poses la pantalla a 375 de debò. */
const VISTES = ['inici', 'habits', 'tasques', 'nutricio', 'finances',
                'seguiment', 'entrenaments', 'diari', 'focus', 'dia', 'setmana',
                'relacions', 'memoria'];
fs.writeFileSync(path.join(CARPETA, 'amplades.html'), `<!doctype html>
<meta charset="utf-8"><title>JEFE · amplades</title>
<style>
  html,body{margin:0;background:#2b2f31;font:13px system-ui;color:#cfd6d8}
  .barra{padding:8px 10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .barra a{color:#8fd0ea;text-decoration:none;padding:3px 8px;border:1px solid #56666d}
  .barra a.ara{background:#4e9bc0;color:#08131a;border-color:#4e9bc0}
  .fila{display:flex;gap:14px;padding:0 10px 14px;align-items:flex-start}
  figure{margin:0} figcaption{padding:4px 0;color:#93a2a8}
  iframe{border:1px solid #56666d;background:#0e1214;display:block}
</style>
<div class="barra"><b>MIRALL</b> · dades inventades ·
  ${VISTES.map(v => `<a href="amplades.html?v=${v}"${v === VISTA ? ' class="ara"' : ''}>${v}</a>`).join('')}
</div>
<div class="fila">
  <figure><figcaption>375 — mòbil</figcaption>
    <iframe id="m" width="375" height="720"></iframe></figure>
  <figure><figcaption>1180 — escriptori</figcaption>
    <iframe id="d" width="1180" height="720"></iframe></figure>
</div>
<script>
  var v = new URLSearchParams(location.search).get('v') || ${j(VISTA)};
  document.getElementById('m').src = 'index.html?vista=' + v;
  document.getElementById('d').src = 'index.html?vista=' + v;
</script>`);

console.log('\nMirall a `' + CARPETA + '`  ·  vista d\'arrencada: ' + VISTA);
console.log('  index.html      una sola pantalla');
console.log('  amplades.html   mòbil i escriptori alhora, amb totes les vistes a dalt\n');
