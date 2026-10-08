/**
 * Finances — MIRALL: l'app de debò al navegador, amb un servidor fingit
 *
 *   npm run mirall [vista]        inici · finances
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

const VISTA = process.argv[2] || 'inici';
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
  var INICI       = ${j(D.nucliInici())};
  var FIN         = { mes: ${j(D.finPantalla({ periode: 'mes' }))},
                      mesos: ${j(D.finPantalla({ periode: 'mesos' }))},
                      estad: ${j(D.finPantalla({ periode: 'estad' }))},
                      revisar: ${j(D.finPantalla({ periode: 'revisar' }))},
                      recurrents: ${j(D.finPantalla({ periode: 'recurrents' }))},
                      patrimoni: ${j(D.finPantalla({ periode: 'patrimoni' }))} };
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
          finances: dins('finances', 'pantalla')
        } };
      }
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
    localStorage.setItem('finances.servidor', JSON.stringify({ url: 'mirall', clau: 'mirall' }));
    localStorage.removeItem('finances.cua');
  } catch (e) {}
  /* SENSE TREBALLADOR DE SERVEI AL MIRALL. Algun navegador de proves —el
     panell integrat, per exemple— no en deixa registrar cap: el fitxer arriba
     bé i el registre falla igualment, i la consola s'omple d'un error que a
     l'app de debò no hi és. El mirall és per mirar la pantalla; el treballador
     es comprova a la pàgina publicada. */
  if (navigator.serviceWorker) {
    try {
      navigator.serviceWorker.register = function () {
        return new Promise(function () {});   // ni resol ni falla: com si no hi fos
      };
    } catch (e) {}
  }
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

/* Les peces d'instal·lació, al costat. Sense elles el navegador no troba el
   treballador de servei i la consola s'omple d'errors que a l'app de debò no
   hi són —i un mirall que avisa de coses falses ensenya a no mirar-lo. */
['sw.js', 'firebase-messaging-sw.js', 'manifest.webmanifest', 'icona.svg', 'icona-192.png', 'icona-512.png', 'icona-maskable-512.png', 'apple-touch-icon.png',
 'icona-maskable.svg', 'favicon.svg'].forEach((f) => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(CARPETA, f));
});

/* I les fonts, que la pantalla les demana amb camí relatiu. */
if (fs.existsSync('fonts')) {
  fs.mkdirSync(path.join(CARPETA, 'fonts'), { recursive: true });
  fs.readdirSync('fonts').forEach((f) => fs.copyFileSync(path.join('fonts', f), path.join(CARPETA, 'fonts', f)));
}

/* Les dues amplades alhora. Els desbordaments no es veuen mai a la finestra
   tal com la tens: es veuen quan poses la pantalla a 375 de debò. */
const VISTES = ['inici', 'finances'];
fs.writeFileSync(path.join(CARPETA, 'amplades.html'), `<!doctype html>
<meta charset="utf-8"><title>Finances · amplades</title>
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
