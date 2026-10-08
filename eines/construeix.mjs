/**
 * JEFE — construeix la interfície estàtica per a GitHub Pages
 *
 *   npm run construeix
 *
 * Munta `pages/index.html` a partir dels MATEIXOS fitxers que Apps Script
 * serveix. No hi ha dues còpies del codi: hi ha una font i dues destinacions.
 *
 *   apps-script/  →  Apps Script el serveix dins d'un iframe (sense micròfon)
 *   pages/        →  GitHub Pages el serveix directe (amb micròfon)
 *
 * La diferència la resol `crida()` en temps d'execució: si troba
 * google.script.run parla amb Apps Script directament; si no, per fetch amb
 * la clau d'accés.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ORIGEN = 'apps-script';

/**
 * Va a l'ARREL del repositori, no a una subcarpeta.
 * GitHub Pages, quan publica des d'una branca, només deixa triar entre
 * l'arrel i `/docs`. Qualsevol altra carpeta no surt ni a la llista.
 * A l'arrel, `index.html` té preferència sobre `README.md`.
 */
const DESTI = '.';

function llegeix(nom) {
  const f = path.join(ORIGEN, nom + '.html');
  if (!fs.existsSync(f)) {
    console.error('  ✗ falta ' + f + ', referenciat per un include()');
    process.exit(1);
  }
  return fs.readFileSync(f, 'utf8');
}

/* LA MARCA DE LA CONSTRUCCIÓ. Va la primera perquè el fitxer que genera
   és un dels que després es resolen amb include().
   Apps Script no deixa preguntar amb quina versió s'està servint una pàgina,
   i sense això no hi ha manera de saber si el que tens obert al mòbil és el
   que s'acaba de desplegar o el d'abans-d'ahir amb la memòria del navegador
   pel mig. Es marca aquí: el dia i l'hora exactes de la construcció, i el
   commit d'on surt. Es veu a la telemetria, apartat SISTEMA. */
const ara = new Date();
const dosDig = (n) => ('0' + n).slice(-2);
const MARCA = ara.getFullYear() + '-' + dosDig(ara.getMonth() + 1) + '-' + dosDig(ara.getDate()) +
              ' ' + dosDig(ara.getHours()) + ':' + dosDig(ara.getMinutes());
/* EL COMMIT NOMÉS S'HI POSA SI DIU LA VERITAT.
   La construcció va abans del commit, sempre: el que es marcava era el
   commit ANTERIOR, o sigui que després de desplegar un canvi la telemetria
   seguia ensenyant el mateix codi de sis lletres que abans. Miraves si tenies
   la versió nova, veies el mateix, i concloïes que no havia arribat.
   Si hi ha canvis sense desar, el que es construeix no és cap commit i no
   se n'inventa cap: es diu que és un build de treball. */
let commit = '';
try {
  const brut = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  commit = brut ? 'en curs' : execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (e) { /* fora d'un repositori, la data ja diu prou */ }

/* La mateixa marca va al fitxer que serveix Apps Script. Es genera aqui i
   no a ma perque la font de la veritat ha de ser una: la construccio. */
const SEGELL = MARCA + (commit ? ' · ' + commit : '');
fs.writeFileSync(path.join(ORIGEN, 'ui_marca.html'), [
  '<script>',
  '/* GENERAT PER eines/construeix.mjs — NO EDITIS AQUEST FITXER. */',
  'window.MARCA_JEFE = ' + JSON.stringify(SEGELL) + ';',
  '</' + 'script>',
  ''
].join('\n'));

let html = fs.readFileSync(path.join(ORIGEN, 'ui_index.html'), 'utf8');

// 1. Resol els include() de la plantilla d'Apps Script
const inclosos = [];
html = html.replace(/<\?!=\s*include\(\s*'([^']+)'\s*\);?\s*\?>/g, (_, nom) => {
  inclosos.push(nom);
  return llegeix(nom);
});

// 2. L'estat inicial que Apps Script injecta al servidor aquí no existeix:
//    la pàgina el demanarà per xarxa un cop connectada.
html = html.replace(/<\?!=\s*JSON\.stringify\(estat\)\s*\?>/g, 'null');

// 3. Peces d'instal·lació. Només tenen sentit servint des de GitHub Pages:
//    dins d'Apps Script el manifest no es pot registrar i el treballador de
//    servei tampoc, perquè la pàgina va dins d'un iframe d'un altre domini.
const INSTALLACIO = `
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="icona.svg">
  <meta name="apple-mobile-web-app-title" content="JEFE">
  <script>
    /* Sense treballador de servei registrat, Chrome ofereix «afegir drecera».
       Amb ell, ofereix INSTAL·LAR l'aplicació de debò. */
    if ('serviceWorker' in navigator) {
      addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (e) {
          console.warn('JEFE: no s\\'ha pogut registrar el treballador de servei', e);
        });
      });
    }
  <\/script>`;

html = html.replace('<!--INSTALLACIO-->', INSTALLACIO);

// 4. Cap scriptlet pot sobreviure: seria text imprès a la pàgina
const restants = html.match(/<\?[\s\S]{0,60}/g);
if (restants) {
  console.error('  ✗ han quedat scriptlets sense resoldre:');
  restants.forEach(r => console.error('      ' + r.replace(/\n/g, ' ').slice(0, 60)));
  process.exit(1);
}

html = html.replace('<body>',
  '<body>\n<!-- GENERAT PER eines/construeix.mjs — NO EDITIS AQUEST FITXER.\n' +
  '     La font són els fitxers de apps-script/. Torna a executar npm run construeix. -->\n' +
  '<script>window.MARCA_JEFE = ' + JSON.stringify(SEGELL) + ';</' + 'script>');

fs.mkdirSync(DESTI, { recursive: true });
fs.writeFileSync(path.join(DESTI, 'index.html'), html);

// GitHub Pages passa els fitxers per Jekyll si no li dius que no.
fs.writeFileSync(path.join(DESTI, '.nojekyll'), '');

// 5. El treballador de les notificacions, amb la configuració a dins.
//    No la pot demanar quan arrenca: el navegador l'engega i dispara
//    l'esdeveniment tot seguit, i el que es registri més tard no el sent.
const swPlantilla = fs.readFileSync(path.join('eines', 'sw-notificacions.plantilla.js'), 'utf8');
const fbBrut = JSON.parse(fs.readFileSync('firebase.config.json', 'utf8'));

const posat = fbBrut.apiKey && !String(fbBrut.apiKey).startsWith('POSA-HI');
const fbClient = posat ? {
  apiKey: fbBrut.apiKey,
  projectId: fbBrut.projectId,
  messagingSenderId: fbBrut.messagingSenderId,
  appId: fbBrut.appId
} : null;

const sw = swPlantilla
  .replace('/**', '/** GENERAT PER eines/construeix.mjs — NO EDITIS AQUEST FITXER.\n *  La font és eines/sw-notificacions.plantilla.js.\n *')
  .replace(/\/\*__CONFIG__\*\/[\s\S]*?\/\*__FI__\*\//,
           JSON.stringify(fbClient, null, 2).replace(/\n/g, '\n'));

if (sw.includes('__CONFIG__')) {
  console.error('  ✗ no he trobat la marca de configuració a la plantilla del treballador');
  process.exit(1);
}
fs.writeFileSync(path.join(DESTI, 'firebase-messaging-sw.js'), sw);

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('\nindex.html (arrel)  ·  ' + kb + ' kB  ·  ' + inclosos.length + ' fitxers inclosos');
inclosos.forEach(n => console.log('   · ' + n));
console.log('\nfirebase-messaging-sw.js  ·  configuració ' +
            (posat ? 'de ' + fbBrut.projectId + ', posada a dins'
                   : 'SENSE POSAR (valors d\'exemple a firebase.config.json)'));
console.log('\nUna sola petició per obrir l\'app. L\'únic recurs extern és el SDK de');
console.log('Firebase, i només es baixa si actives les notificacions.\n');
