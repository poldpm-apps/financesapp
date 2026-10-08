/**
 * JEFE — treballador de servei
 *
 * Existeix per dos motius, i cap dels dos és «anar sense connexió»:
 *   1. Sense un treballador de servei registrat, Chrome no ofereix INSTAL·LAR
 *      l'aplicació. Amb ell, surt el botó de debò en comptes d'una drecera.
 *   2. Si obres JEFE sense cobertura, veus la interfície en comptes d'un error
 *      del navegador. Les dades no hi seran, però l'app t'ho dirà ella.
 *
 * ESTRATÈGIA: XARXA PRIMER, memòria cau com a xarxa de seguretat.
 * A l'inrevés seria pitjor de mantenir: t'hauria de quedar servint una versió
 * antiga de l'app fins que algú buidés la memòria cau a mà. Amb xarxa primer,
 * cada obertura amb cobertura ja porta la darrera versió publicada.
 *
 * MAI toca les crides a Apps Script: aquelles han d'anar sempre a la xarxa i
 * no s'han de desar enlloc. Són les teves dades.
 */

var CAU = 'jefe-v1';
var ESSENCIALS = [
  './',
  './index.html',
  './icona.svg',
  './favicon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(CAU)
      .then(function (c) { return c.addAll(ESSENCIALS); })
      .catch(function () { /* si algun no hi és, no bloquegem la instal·lació */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (noms) {
        return Promise.all(noms.filter(function (n) { return n !== CAU; })
                               .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  var url = new URL(ev.request.url);

  // Res que no sigui d'aquest lloc passa de llarg: sobretot Apps Script.
  if (url.origin !== self.location.origin) return;
  if (ev.request.method !== 'GET') return;

  ev.respondWith(
    fetch(ev.request)
      .then(function (resposta) {
        // Còpia a la memòria cau per si la propera vegada no hi ha xarxa
        if (resposta && resposta.status === 200 && resposta.type === 'basic') {
          var copia = resposta.clone();
          caches.open(CAU).then(function (c) { c.put(ev.request, copia); });
        }
        return resposta;
      })
      .catch(function () {
        return caches.match(ev.request).then(function (desada) {
          if (desada) return desada;
          // Navegació sense res desat: almenys la closca de l'app
          if (ev.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Sense connexió' });
        });
      })
  );
});
