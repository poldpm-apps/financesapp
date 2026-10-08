/**
 * JEFE — treballador de servei de les notificacions
 *
 * AIXÒ ÉS UNA PLANTILLA. El fitxer que es fa servir és
 * `firebase-messaging-sw.js`, a l'arrel, i el genera `npm run construeix`
 * amb la configuració de `firebase.config.json` posada a dins. No l'editis
 * allà: es reescriu a cada construcció.
 *
 * PER QUÈ VA A DINS I NO ES DEMANA
 * Quan arriba una notificació amb l'app tancada, el navegador arrenca aquest
 * fitxer de zero i dispara l'esdeveniment tot seguit. Tot el que es registri
 * després —dins d'un `then`, esperant una petició— arriba tard i no el sent
 * ningú: el missatge es perd en silenci, sense error enlloc. Per tant la
 * configuració ha d'estar aquí dins, i tot ha de passar de dalt a baix.
 *
 * És un treballador separat del `sw.js` de l'app, amb abast propi (`./fcm/`),
 * perquè un abast només pot tenir un treballador.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

var CONFIG = /*__CONFIG__*/ null /*__FI__*/;

if (CONFIG && CONFIG.apiKey) {
  firebase.initializeApp(CONFIG);

  firebase.messaging().onBackgroundMessage(function (missatge) {
    var d = (missatge && missatge.data) || {};
    return self.registration.showNotification(d.titol || 'JEFE', {
      body: d.cos || '',
      // Sense `icon` a posta: Android no dibuixa icones SVG a les
      // notificacions, i la nostra ho és. Com que l'app està instal·lada,
      // el sistema hi posa la seva. Si la volem pròpia, caldrà un PNG.
      // Mateixa etiqueta = es reemplaça en comptes d'acumular-se. Sense
      // això, set recordatoris deixarien set línies a la barra.
      tag: d.etiqueta || 'jefe',
      renotify: true,
      data: { url: d.url || './' },
      vibrate: [60, 40, 60]
    });
  });
} else {
  console.warn('JEFE: firebase.config.json encara té els valors d\'exemple.');
}

/**
 * EN TOCAR LA NOTIFICACIÓ, ANAR ON DIU LA NOTIFICACIÓ.
 *
 * Aquí hi havia dos errors, i tots dos acabaven igual: toques l'avís i no vas
 * on toca.
 *
 *   1. `openWindow(desti)` amb un destí relatiu el resolia contra la carpeta
 *      del treballador. A GitHub Pages l'app viu a /jefe/, o sigui que «escola»
 *      es convertia en /jefe/escola i sortia un 404. Ara es construeix
 *      l'adreça sencera a partir de l'arrel, i mai es confia en la relativa.
 *
 *   2. Si l'app JA era oberta, se li feia el focus i s'ignorava el destí. O
 *      sigui que en el cas més habitual —tenir JEFE obert— la notificació et
 *      deixava exactament on ja eres. Ara se li canvia l'adreça i, si el
 *      navegador no ho permet, se li diu per missatge.
 *
 * L'app tria pantalla amb el hash: el destí bo és «./#escola».
 */
self.addEventListener('notificationclick', function (ev) {
  ev.notification.close();

  var arrel = self.registration.scope.replace(/fcm\/$/, '');
  var brut = (ev.notification.data && ev.notification.data.url) || './';

  /* La mateixa normalització que fa el servidor, repetida aquí a posta: una
     notificació desada al telèfon pot ser d'una versió antiga i portar encara
     el nom pelat. Val més arreglar-ho dues vegades que obrir un 404. */
  var vista = '';
  var u = String(brut).trim();
  if (u.indexOf('#') !== -1) vista = u.slice(u.indexOf('#') + 1);
  else if (u && u !== './' && u !== '.' && u !== '/') vista = u.replace(/^\.?\/*/, '');

  var desti = arrel + (vista ? '#' + vista : '');

  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (finestres) {
      for (var i = 0; i < finestres.length; i++) {
        var f = finestres[i];
        if (f.url.indexOf(arrel) !== 0) continue;

        /* Amb finestra oberta: primer se li diu per missatge —l'app ho entén i
           hi navega sense recarregar, que és instantani— i a més se li canvia
           l'adreça per si el missatge no arriba. */
        try { f.postMessage({ jefe: 'ves', vista: vista }); } catch (e) {}
        if (vista && f.navigate) {
          return f.navigate(desti).then(function (c) { return (c || f).focus(); })
                  .catch(function () { return f.focus(); });
        }
        return f.focus();
      }
      return self.clients.openWindow(desti);
    })
  );
});

// Que una versió nova entri de seguida. Si no, es queda esperant que l'antiga
// quedi ociosa i pots passar-te el dia provant la d'abans sense saber-ho.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (ev) { ev.waitUntil(self.clients.claim()); });
