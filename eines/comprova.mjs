/**
 * JEFE — comprovació abans de pujar
 *
 *   npm run comprova
 *
 * Detecta errors que a Apps Script només es veuen quan ja has desplegat i
 * has obert l'app al mòbil. Cadascuna d'aquestes comprovacions hi és perquè
 * un error real hi va passar pel mig.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const DIR = 'apps-script';
const PLANTILLES = ['ui_index.html'];   // els únics fitxers que doGet passa per createTemplateFromFile

let errors = [];
let avisos = [];

function error(f, m) { errors.push(f + ': ' + m); }
function avis(f, m) { avisos.push(f + ': ' + m); }

const fitxers = fs.readdirSync(DIR);

for (const f of fitxers) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');

  /* ---- 0. Etiquetes <script> desaparellades -------------------------------
     Va PRIMER perquè és el que fa cegues totes les altres comprovacions:
     l'expressió que treu els blocs busca del `<script>` al `</script>`, i si
     el tancament no hi és, senzillament no troba cap bloc. Zero blocs vol dir
     zero errors de sintaxi, i el fitxer passa net.
     Va passar de debò: vista_tasques.html va sortir publicada sense tancar
     l'etiqueta. El bloc es va menjar el codi d'arrencada que venia després,
     la pàgina va petar sencera, i aquesta eina va dir «tot correcte». */
  if (f.endsWith('.html')) {
    const oberts = (src.match(/<script\b/gi) || []).length;
    const tancats = (src.match(/<\/script\s*>/gi) || []).length;
    if (oberts !== tancats) {
      error(f, 'hi ha ' + oberts + ' `<script>` i ' + tancats + ' `</script>`. ' +
               'Sense tancar, el bloc s\'empassa el que ve després.');
      continue;
    }
  }

  // ---- 1. Sintaxi de JavaScript -------------------------------------------
  let blocs = [];
  if (f.endsWith('.gs')) blocs = [src];
  else if (f.endsWith('.html')) {
    const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m; while ((m = re.exec(src))) blocs.push(m[1]);
    if (!blocs.length && /<script\b/i.test(src)) {
      error(f, 'té `<script>` però no se n\'ha pogut extreure cap bloc.');
    }
  }
  blocs.forEach((bloc, i) => {
    const net = bloc.replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
    try { new vm.Script(net, { filename: f + '#' + i }); }
    catch (e) { error(f, 'sintaxi al bloc ' + (i + 1) + ' — ' + e.message); }
  });

  if (!f.endsWith('.html')) continue;

  // ---- 2. Sintaxi de plantilla en fitxers que no són plantilla -------------
  // Un `<?` en un fitxer inclòs amb include() no s'executa: s'imprimeix tal qual.
  const teScriptlet = /<\?/.test(src);
  if (teScriptlet && PLANTILLES.indexOf(f) === -1) {
    error(f, 'conté sintaxi de plantilla `<?` però no és una plantilla. ' +
             'include() no la processa: sortirà impresa a la pàgina.');
  }

  // ---- 3. Scriptlets sense tancar -----------------------------------------
  if (PLANTILLES.indexOf(f) !== -1) {
    const oberts = (src.match(/<\?/g) || []).length;
    const tancats = (src.match(/\?>/g) || []).length;
    if (oberts !== tancats) {
      error(f, 'hi ha ' + oberts + ' `<?` i ' + tancats + ' `?>`. Cada scriptlet s\'ha de tancar.');
    }

    // ---- 4. Scriptlet dins d'un comentari ---------------------------------
    // Apps Script NO respecta els comentaris: veu el `<?` i intenta executar-lo.
    // Això va provocar un «Unexpected token '?'» en producció.
    src.split('\n').forEach((linia, n) => {
      const comentari = linia.match(/(^\s*(\/\/|\*|<!--)|\/\/).*/);
      if (comentari && /<\?/.test(comentari[0])) {
        error(f, 'línia ' + (n + 1) + ': hi ha sintaxi de plantilla dins d\'un comentari. ' +
                 'Apps Script la intentarà executar igualment.');
      }
    });
  }

  // ---- 5. Els include() apunten a fitxers que existeixen -------------------
  const reInc = /include\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m2;
  while ((m2 = reInc.exec(src))) {
    if (fitxers.indexOf(m2[1] + '.html') === -1) {
      error(f, 'include(\'' + m2[1] + '\') però no existeix ' + m2[1] + '.html');
    }
  }
}

// ---- 6. Cada mòdul segueix el contracte -----------------------------------
for (const f of fitxers.filter(x => /^40_Mod_.*\.gs$/.test(x))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  if (!/function\s+MODUL_[A-Z0-9_]+\s*\(/.test(src)) {
    error(f, 'cap funció `MODUL_MAJUSCULES()`. El nucli no el trobarà. Vegeu MODULS.md.');
  }
}

// ---- 7. Cada icona que es demana existeix al full de símbols ---------------
/* Un `ic('setmana')` sense el seu `<symbol id="ic-setmana">` no peta enlloc:
   el navegador dibuixa un buit i el botó es queda sense res. Ja va passar
   —la icona de Seguiment es va perdre en una neteja i ningú se'n va adonar
   fins que es va mirar la pantalla. Aquí es veu abans de pujar. */
{
  const sprite = fs.existsSync(path.join(DIR, 'ui_icones.html'))
    ? fs.readFileSync(path.join(DIR, 'ui_icones.html'), 'utf8') : '';
  const teQui = new Set();
  (sprite.match(/id="ic-([a-z0-9-]+)"/g) || []).forEach((x) => {
    teQui.add(x.match(/id="ic-([a-z0-9-]+)"/)[1]);
  });

  for (const f of fitxers.filter((x) => x.endsWith('.html') && x !== 'ui_icones.html')) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    /* El nom s'agafa sencer i no per un joc de caràcters: amb `[a-z0-9-]+`,
       un `ic('setmanaXX')` no encaixava del tot i la comprovació el saltava
       sense dir res. Ho he sabut trencant-ho a posta per veure si saltava. */
    const re = /\bic\(\s*'([^']*)'/g;
    let m3;
    while ((m3 = re.exec(src))) {
      if (!teQui.has(m3[1])) {
        error(f, 'demana la icona `' + m3[1] + '` i no hi ha cap <symbol id="ic-' +
                 m3[1] + '"> a ui_icones.html.');
      }
    }
  }
}

// ---- 8. Cada `mostra:` d'una eina té el seu visor registrat ----------------
/* Una eina que digui `mostra: 'habits.comptador'` sense que cap pantalla
   l'hagi registrat no peta: obre un plafó amb un missatge d'error, i això
   només es veu demanant-l'hi. Aquí es veu abans de pujar. */
{
  const registrats = new Set();
  for (const f of fitxers.filter((x) => x.startsWith('vista_'))) {
    const t = fs.readFileSync(path.join(DIR, f), 'utf8');
    (t.match(/registraVisor\(\s*'([^']+)'/g) || []).forEach((x) => {
      registrats.add(x.match(/'([^']+)'/)[1]);
    });
  }
  for (const f of fitxers.filter((x) => x.endsWith('.gs'))) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const re = /\bmostra:\s*'([^']+)'/g;
    let m4;
    while ((m4 = re.exec(src))) {
      /* `mostra` també és el nom d'una acció de calendari i de tasques
         («mostra: function...»), i allò no és cap visor. */
      if (!/\./.test(m4[1])) continue;
      if (!registrats.has(m4[1])) {
        error(f, 'una eina diu `mostra: \'' + m4[1] + '\'` i cap pantalla ' +
                 'l\'ha registrat amb App.registraVisor().');
      }
    }
  }
}

/* ---- 8b. `currentTarget` dins d'una resposta que arriba més tard ----------
   Quan la promesa es resol, l'esdeveniment fa estona que s'ha acabat de
   repartir i `ev.currentTarget` val null: la línia peta, el `.catch` es mor
   per dins i el botó es queda carregant per sempre sense dir res. Va passar
   al diàleg de connectar: amb la clau dolenta, rodeta eterna i cap missatge.
   El botó s'ha d'agafar ABANS, en una variable. */
{
  for (const f of fitxers.filter((x) => x.endsWith('.html'))) {
    const linies = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
    linies.forEach((linia, n) => {
      if (!/\.(then|catch)\s*\(\s*function/.test(linia)) return;
      const sagnat = linia.search(/\S/);
      for (let i = n + 1; i < Math.min(n + 14, linies.length); i++) {
        const seg = linies[i];
        const tancament = seg.search(/\S/);
        if (/^\s*\}\)/.test(seg) && tancament <= sagnat) break;
        if (/currentTarget/.test(seg)) {
          error(f, 'línia ' + (i + 1) + ': `currentTarget` dins d\'un `.then`/`.catch`. ' +
                   'Quan arribi la resposta ja valdrà null: agafa l\'element abans, ' +
                   'en una variable.');
          break;
        }
      }
    });
  }
}

/* ---- 9. Res que sigui secret dins d'un fitxer que git segueix -------------
   El repositori és PÚBLIC i la documentació ho promet: «ni la clau, ni l'URL
   del desplegament». L'URL hi va anar igualment —la genera `npm run desplega`
   dins d'un .gs, i els .gs es comenten tots—, i va estar publicada a GitHub
   fins que una auditoria la va trobar. Això mira el que git seguirà de debò,
   no el que hi ha al disc: un fitxer ignorat pot tenir el que vulgui. */
{
  const { execSync } = await import('child_process');
  let seguits = [];
  try {
    seguits = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) { /* fora d'un repositori no hi ha res a vigilar */ }

  /* LA CONFIGURACIÓ WEB DE FIREBASE ÉS PÚBLICA A POSTA i no és cap secret:
     va dins de la pàgina, el navegador de qualsevol la veu, i qui guarda de
     debò és el compte de servei, que viu a Script Properties i no surt mai
     d'allà. Vegeu `docs/03-notificacions.md`. */
  const publicsAposta = ['firebase.config.json', 'firebase-messaging-sw.js', 'index.html'];

  const secrets = [
    { nom: 'l\'URL del desplegament', re: /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/(exec|dev)/ },
    { nom: 'un testimoni de bot de Telegram', re: /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/ },
    { nom: 'una clau de Google API', re: /\bAIza[0-9A-Za-z_-]{30,}\b/, excepte: publicsAposta },
    /* El text de la capçalera sol no és res: el codi que la munta i el que la
       valida també la porten escrita. Una clau de debò porta el material a
       sota, que és el que es busca. */
    { nom: 'una clau privada', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\\n]*[A-Za-z0-9+/=]{100,}/ }
  ];

  for (const f of seguits) {
    if (!/\.(gs|html|js|mjs|json|md|webmanifest)$/.test(f)) continue;
    if (f === 'eines/comprova.mjs') continue;      // aquí hi són els patrons, no els secrets
    let src = '';
    try { src = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    for (const s of secrets) {
      if (s.excepte && s.excepte.indexOf(f) !== -1) continue;
      if (s.re.test(src)) {
        error(f, 'hi ha ' + s.nom + ' i git segueix aquest fitxer. ' +
                 'El repositori és públic: treu-ho i posa el fitxer al .gitignore.');
      }
    }
  }
}

// ---- Informe ---------------------------------------------------------------
if (avisos.length) {
  console.log('\nAvisos:');
  avisos.forEach(a => console.log('  · ' + a));
}
if (errors.length) {
  console.log('\n' + errors.length + ' error(s):');
  errors.forEach(e => console.log('  ✗ ' + e));
  console.log('\nNo pugis això.\n');
  process.exit(1);
}
console.log('\nTot correcte. Es pot pujar.\n');
