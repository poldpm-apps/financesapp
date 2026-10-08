/**
 * JEFE — NUCLI · Senyals
 *
 * QUÈ ÉS
 *   Fins ara JEFE avisava per rellotge: l'agenda a les sis, el resum a les
 *   onze, el repàs a les 23:30. Això avisa pel que PASSA: que fa tres dies que
 *   no apuntes res de menjar, que una tasca fa dotze dies que és allà, que els
 *   rebuts d'aquest mes no caben amb el que tens.
 *
 * PER QUÈ ÉS UN FITXER DEL NUCLI I NO D'UN MÒDUL
 *   Perquè la part difícil no és trobar coses a dir: és NO dir-les. Qui sap
 *   què passa és cada mòdul; qui ha de decidir què val la pena interrompre'l
 *   és un de sol, i amb un pressupost. Si cada mòdul avisés pel seu compte,
 *   en tres setmanes silencies l'app —i llavors ja no t'assabentes de res.
 *
 * LES REGLES, i són les que fan que això serveixi:
 *
 *   1. DOS AL DIA COM A MÀXIM. No és una xifra tècnica: és el que separa un
 *      avís d'un soroll. Si un dia passen sis coses, se'n diuen les dues que
 *      manen i les altres esperen.
 *   2. El mateix senyal no es repeteix abans de TRES DIES. Un recordatori
 *      diari de la mateixa cosa deixa de llegir-se el segon dia.
 *   3. De nit no es diu res. Entre les 22 i les 8 no hi ha cap avís que no
 *      pugui esperar al matí.
 *   4. TOT QUEDA APUNTAT al full, s'enviï o no. El que no s'ha dit també és
 *      informació: si un senyal salta cada dia i mai arriba a sortir, és que
 *      el pressupost o la prioritat estan mal posats.
 *   5. CAP SENYAL RENYA. Un senyal diu què passa i ofereix el següent pas.
 *      «Fa 12 dies que arrossegues això» no ajuda ningú; «això fa 12 dies:
 *      quin seria el primer pas de deu minuts?» sí.
 *
 * COM S'HI AFEGEIX UN
 *   Un mòdul declara `senyals: function () { return [...] }` al seu
 *   descriptor. Cada senyal és:
 *
 *     { id, titol, text, urgencia, accio, apartat }
 *
 *   `id` ha de ser ESTABLE per a la mateixa cosa —«tasca_encallada:tsk_123»—
 *   perquè la regla dels tres dies el pugui reconèixer. `urgencia` va d'1 a 3
 *   i és per ordenar, no per cridar.
 *
 * QUÈ ES VEU AL TELÈFON, I QUI HO DECIDEIX
 *   El títol de la notificació NO és el del senyal: és el de l'apartat d'on
 *   ve. A la barra hi caben tres o quatre paraules, i el que has de saber
 *   abans de decidir si l'obres és d'on et parlen —«Tasques», «Hàbits»—, no
 *   una frase que després el cos et tornarà a dir. El que el senyal escriu al
 *   `titol` no es perd: encapçala el cos.
 *
 *   Ho posa AQUÍ el nucli i no cada mòdul, per la mateixa raó que als avisos
 *   programats: una regla que s'ha de recordar a vuit llocs és una regla que
 *   es trencarà al novè. Un senyal només ha de dir `apartat` si obre una
 *   pantalla que no es diu com el seu mòdul —la conversa n'és l'únic cas:
 *   el mòdul es diu «JEFE» i el senyal obre «La setmana».
 */

var PROP_SENYALS_MAX = 2;          // quants n'hi ha cada dia, com a molt
var SENYAL_ESPERA_DIES = 3;        // abans de repetir-ne un d'igual
var SENYAL_HORA_MIN = 8;
var SENYAL_HORA_MAX = 22;

var Senyals = (function () {

  var FULL = '_Senyals';

  /** Tot el que han trobat els mòduls, sense filtrar. Un que peta no tomba la resta. */
  function recull() {
    var out = [];
    var m = Moduls.actius();
    for (var i = 0; i < m.length; i++) {
      if (typeof m[i].senyals !== 'function') continue;
      try {
        var seus = m[i].senyals() || [];
        seus.forEach(function (s) {
          if (!s || !s.id || !s.text) return;
          out.push({
            id: String(s.id),
            modul: m[i].id,
            /* L'apartat és el títol que arriba al telèfon; el títol del senyal
               encapçala el cos. Quan diuen el mateix —l'escola en diu «Escola»
               i el mòdul també— es deixa un de sol: repetir-ho seria dir dues
               vegades la mateixa paraula en dues línies seguides. */
            apartat: String(s.apartat || m[i].nom || m[i].id),
            titol: String(s.titol || ''),
            text: String(s.text),
            urgencia: Math.max(1, Math.min(3, Number(s.urgencia) || 1)),
            accio: s.accio || m[i].id
          });
        });
      } catch (err) {
        Log.avis('senyals', 'El mòdul ' + m[i].id + ' no ha pogut mirar: ' + err.message);
      }
    }
    return out;
  }

  /** Quan es va dir cadascun per última vegada. */
  function dits_() {
    var per = {};
    try {
      Dades.llegeix(FULL).forEach(function (f) {
        if (!f.senyal || !f.enviat_el) return;
        if (!per[f.senyal] || f.enviat_el > per[f.senyal]) per[f.senyal] = f.enviat_el;
      });
    } catch (e) { /* encara no hi ha full: no s'ha dit res mai */ }
    return per;
  }

  function quantsAvui_() {
    var avui = Utils.avui();
    var n = 0;
    try {
      Dades.llegeix(FULL).forEach(function (f) {
        if (f.enviat_el && String(f.enviat_el).slice(0, 10) === avui) n++;
      });
    } catch (e) {}
    return n;
  }

  /**
   * Mirar què passa i dir-ne com a molt el que toqui.
   *
   * Torna sempre el mateix: què s'ha trobat, què s'ha dit i per què no s'ha
   * dit la resta. Serveix per executar-ho a mà i entendre-ho sense endevinar.
   */
  function passa(p) {
    p = p || {};
    var ara = new Date();
    var hora = Number(Utilities.formatDate(ara, Config.zonaHoraria(), 'H'));

    var trobats = recull();
    if (!trobats.length) return { trobats: 0, enviats: 0, motiu: 'res a dir' };

    var jaDits = dits_();
    var limit = Utils.sumaDies(Utils.avui(), -SENYAL_ESPERA_DIES);

    /* Els que toca callar: dits fa poc. Es guarden igual al full —saber que
       una cosa segueix passant i que hem callat també és informació. */
    var candidats = [], callats = [];
    trobats.forEach(function (s) {
      var ultim = jaDits[s.id];
      if (ultim && String(ultim).slice(0, 10) > limit) callats.push(s);
      else candidats.push(s);
    });

    candidats.sort(function (a, b) { return b.urgencia - a.urgencia; });

    var potsDir = p.forcaEnviar ? candidats.length
                 : Math.max(0, PROP_SENYALS_MAX - quantsAvui_());
    var deNit = !p.forcaEnviar && (hora < SENYAL_HORA_MIN || hora >= SENYAL_HORA_MAX);
    if (deNit) potsDir = 0;

    var enviats = [];
    candidats.forEach(function (s, i) {
      var toca = i < potsDir;
      apunta_(s, toca ? Utils.ara() : '');
      if (!toca) return;
      try {
        /* L'ETIQUETA VA PER SENYAL. Sense posar-ne cap, totes arribaven amb la
           mateixa —«jefe»— i al telèfon una etiqueta repetida no vol dir dues
           notificacions: vol dir que la segona TAPA la primera. Amb dos
           senyals al dia, això és la meitat dels avisos perduts. */
        Notifica.envia(
          s.apartat,
          Notifica.junta(s.titol === s.apartat ? '' : s.titol, s.text),
          { url: s.accio, etiqueta: 'senyal-' + s.id });
        enviats.push(s.id);
      } catch (err) {
        Log.avis('senyals', 'No he pogut avisar de ' + s.id + ': ' + err.message);
      }
    });
    callats.forEach(function (s) { apunta_(s, ''); });

    return {
      trobats: trobats.length,
      enviats: enviats.length,
      quins: enviats,
      motiu: deNit ? 'de nit no s\'avisa'
           : (!potsDir ? 'ja s\'han dit ' + PROP_SENYALS_MAX + ' avui' : '')
    };
  }

  /* Al full hi va TOT: el que s'ha dit i el que no. Una fila per senyal i dia:
     si el mateix segueix passant tot el mes, no vull trenta files iguals. */
  function apunta_(s, enviatEl) {
    var avui = Utils.avui();
    var clau = s.id + '|' + avui;
    try {
      var ja = Dades.un(FULL, { clau: clau });
      if (ja) {
        if (enviatEl && !ja.enviat_el) Dades.actualitza(FULL, ja.id, { enviat_el: enviatEl });
        return;
      }
      Dades.insereix(FULL, {
        clau: clau, senyal: s.id, modul: s.modul, data: avui,
        // Al full i a la pantalla d'inici hi ha d'haver sempre un títol: si el
        // senyal no en porta, el de l'apartat fa la feina.
        titol: s.titol || s.apartat, text: s.text, urgencia: s.urgencia,
        enviat_el: enviatEl || ''
      }, 'sen');
    } catch (err) {
      Log.avis('senyals', 'No he pogut apuntar ' + s.id + ': ' + err.message);
    }
  }

  /** Els d'avui, per ensenyar-los a la pantalla d'inici. */
  function dAvui() {
    var avui = Utils.avui();
    try {
      return Dades.llegeix(FULL, function (f) { return f.data === avui; })
        .map(function (f) {
          return { senyal: f.senyal, modul: f.modul, titol: f.titol, text: f.text,
                   urgencia: Number(f.urgencia) || 1, enviat: !!f.enviat_el };
        })
        .sort(function (a, b) { return b.urgencia - a.urgencia; });
    } catch (e) { return []; }
  }

  return { recull: recull, passa: passa, dAvui: dAvui, FULL: FULL };
})();


/**
 * El trigger. Cada tres hores: prou per assabentar-se el mateix dia, poc
 * perquè no sigui un degoteig. El pressupost de dos al dia mana igualment.
 */
function triggerSenyals() {
  var r = Senyals.passa({});
  var resum = 'trobats ' + r.trobats + ' · enviats ' + r.enviats +
              (r.motiu ? ' · ' + r.motiu : '');
  Logger.log(resum);
  Log.info('senyals', resum, r);
  return resum;
}


/**
 * QUÈ VEURIA AVUI, sense enviar res.
 *
 * Per executar-ho a mà: diu què han trobat els mòduls i què en sortiria, però
 * no toca el telèfon ni apunta res.
 */
function provaSenyals() {
  var l = ['=== ELS SENYALS D\'ARA MATEIX ==='];
  function a(t) { l.push(t); Logger.log(t); }

  var trobats = Senyals.recull();
  if (!trobats.length) {
    a('Cap. Vol dir que ara mateix no hi ha res que valgui la pena interrompre.');
    return l.join('\n');
  }

  trobats.sort(function (x, y) { return y.urgencia - x.urgencia; });
  a('Trobats: ' + trobats.length + '  (se n\'envien ' + PROP_SENYALS_MAX + ' al dia com a molt)');
  a('');
  trobats.forEach(function (s, i) {
    a('  ' + (i < PROP_SENYALS_MAX ? '→' : ' ') + ' [' + s.urgencia + '] ' + s.titol);
    a('       ' + s.text);
    a('       (' + s.id + ')');
  });
  a('');
  a('Els de la fletxa són els que sortirien ara. La resta esperen: dos al dia,');
  a('i el mateix senyal no es repeteix abans de ' + SENYAL_ESPERA_DIES + ' dies.');
  return l.join('\n');
}
