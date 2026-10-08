/**
 * JEFE — NUCLI · Memòria de pantalles
 *
 * QUÈ FA
 *   Desa el que ha costat de muntar perquè la segona vegada no torni a costar.
 *   Obrir finances vol dir llegir el full de moviments sencer; obrir hàbits,
 *   el de registres. Són quatre o cinc segons cada cop, i creixen amb els anys
 *   de dades que hi tens a sobre.
 *
 * LA REGLA QUE NO ES NEGOCIA
 *   Una pantalla desada NO POT ENSENYAR MAI una dada vella. Per això la
 *   invalidació no depèn de recordar-se'n a cada lloc: penja de `Dades`, que
 *   és per on passen TOTES les escriptures sense excepció. Si es desa una fila
 *   d'un full, tot el que hagi muntat el mòdul propietari d'aquell full deixa
 *   de valer al moment.
 *
 * COM S'ESBORRA SENSE PODER ESBORRAR
 *   La memòria cau d'Apps Script no deixa esborrar per prefix: només clau a
 *   clau, i aquí no sabem quines claus hi ha. Es fa amb una GENERACIÓ: cada
 *   mòdul en té un número que forma part de totes les seves claus, i
 *   invalidar és canviar-lo. El que hi havia queda inabastable i caduca sol.
 *   Una escriptura són dues operacions de memòria, no una passejada.
 *
 * QUÈ NO HI VA
 *   El que no surt d'un full. El calendari es llegeix de Google i té la seva
 *   pròpia finestra; la conversa no es repeteix mai. I res que digui «fa tres
 *   minuts»: això es calcula sempre de nou i s'enganxa a sobre del que ve
 *   desat, perquè un rellotge congelat és una mentida petita però és mentida.
 */

var Memoria = (function () {

  var VIDA = 1800;          // mitja hora; el dia també forma part de la clau
  var VIDA_GEN = 21600;     // la generació ha de durar més que el que guarda
  var MIDA_MAX = 95000;     // Apps Script no admet més de 100 kB per clau

  function cau_() {
    try { return CacheService.getScriptCache(); } catch (e) { return null; }
  }

  function generacio_(modul) {
    var c = cau_();
    if (!c) return null;
    var k = 'gen_' + modul;
    var v = null;
    try { v = c.get(k); } catch (e) { return null; }
    if (v === null) {
      v = marca_();
      try { c.put(k, v, VIDA_GEN); } catch (e) {}
    }
    return v;
  }

  /* Ha de canviar SEMPRE, encara que dues escriptures caiguin al mateix
     mil·lisegon: si es repetís, la segona no invalidaria res. */
  function marca_() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function clau_(modul, nom, gen) {
    var k = 'p_' + modul + '_' + gen + '_' + Utils.avui() + '_' + nom;
    // El límit d'Apps Script són 250 caràcters. Val més escurçar que petar.
    return k.length > 240 ? k.slice(0, 240) : k;
  }

  /**
   * El resultat de `fer()`, desat. Si ja el teníem, `fer()` no s'executa.
   *
   * `nom` ha d'incloure TOT el que canvia el resultat: el període, el mes, el
   * dia que es mira. Si se n'oblida un, dues pantalles diferents comparteixen
   * clau i una ensenya el que és de l'altra.
   */
  function recorda(modul, nom, fer, segons) {
    var c = cau_();
    if (!c) return fer();

    var gen = generacio_(modul);
    if (gen === null) return fer();

    var k = clau_(modul, nom, gen);
    try {
      var desat = c.get(k);
      if (desat !== null) return JSON.parse(desat);
    } catch (e) { /* si no es pot llegir o desxifrar, es munta i prou */ }

    var r = fer();
    try {
      var s = JSON.stringify(r);
      if (s.length < MIDA_MAX) c.put(k, s, segons || VIDA);
    } catch (e) { /* massa gran o no serialitzable: es viurà sense */ }
    return r;
  }

  /** Tot el que hagi desat aquest mòdul deixa de valer. */
  function oblida(modul) {
    var c = cau_();
    if (!c || !modul) return;
    try { c.put('gen_' + modul, marca_(), VIDA_GEN); } catch (e) {}
  }

  /** Tot el de tothom. Per quan no se sap què ha canviat. */
  function oblidaTot(ids) {
    var c = cau_();
    if (!c || !ids || !ids.length) return;
    var nou = {};
    for (var i = 0; i < ids.length; i++) nou['gen_' + ids[i]] = marca_();
    try { c.putAll(nou, VIDA_GEN); } catch (e) {}
  }

  /* El calaix del que suma TOTS els mòduls: la pantalla d'inici i la del dia.
     Qualsevol escriptura, sigui d'on sigui, el tomba: no se sap quin dels
     mòduls hi aportava el que ha canviat i no val la pena endevinar-ho.

     I dura poc a posta. Allà hi va el calendari, que no surt de cap full: pot
     canviar sense que ningú escrigui res i sense que nosaltres ens n'assabentem.
     Dos minuts fan que passejar per l'app no costi res i que el que veus mai
     tingui més de dos minuts. */
  var COMU = 'nucli';
  var VIDA_COMU = 120;

  function recordaComu(nom, fer) { return recorda(COMU, nom, fer, VIDA_COMU); }
  function oblidaComu() { oblida(COMU); }

  return {
    recorda: recorda,
    recordaComu: recordaComu,
    oblida: oblida,
    oblidaComu: oblidaComu,
    oblidaTot: oblidaTot
  };
})();
