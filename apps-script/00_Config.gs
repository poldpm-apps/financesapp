/**
 * JEFE — NUCLI · Configuració
 *
 * Aquest fitxer no s'ha de tocar mai per afegir un mòdul.
 *
 * Res secret viu aquí. La clau de l'API i l'identificador del full de càlcul
 * viuen a Script Properties (Configuració del projecte → Propietats de l'script),
 * que no es comparteix ni es versiona.
 */

var VERSIO_JEFE = '1.0.0';
var NOM_FULL_CALCUL = 'JEFE — Assistent';

/** Claus de Script Properties. Mai al codi, mai a cap fitxer versionat. */
var PROP_ID_FULL = 'ID_FULL';
var PROP_CLAU_IA = 'CLAU_IA';
var PROP_CLAU_ACCES = 'CLAU_ACCES';
var PROP_FIREBASE   = 'FIREBASE_COMPTE';  // compte de servei: conte clau privada   // porta d'entrada des de fora d'Apps Script

/**
 * Valors per defecte del full `_Config`.
 * Es creen si no hi són; mai sobreescriuen el que ja hi hagi escrit.
 */
var CONFIG_DEFECTE = {
  versio_esquema: '1',
  zona_horaria: 'Europe/Madrid',

  // Capa d'IA — apagada fins que hi hagi clau a Script Properties
  ia_activa: 'NO',
  proveidor_ia: 'gemini',
  model_barat: 'gemini-2.5-flash',
  model_bo: 'gemini-2.5-flash',

  /* El model que NOMES transcriu la veu. A part a posta: els limits gratuits
     de Gemini es compten per model, o sigui que transcriure amb un de
     diferent no menja de la quota de les respostes. I com que la feina es
     sentir i prou, no cal el bo. */
  model_veu: 'gemini-2.5-flash-lite',

  /* Quant se li deixa «pensar» abans de contestar, en tokens. A zero, gens:
     la feina d'aquí és mirar una fitxa que ja ve resolta i triar una eina, i
     rumiar-hi només afegeix segons. Puja-ho si algun dia hi ha una pregunta
     que ho necessiti de debò. */
  pensa_tokens: 0,


  // Si es posa a NO, la capa d'IA deixa d'enviar text del diari.
  // Els resums perden profunditat però tot continua funcionant.
  ia_inclou_diari: 'SI',

  // Triggers
  /* Franja horària del resum nocturn (0-23). Les onze i no les deu: el resum
     tanca el dia, i tancar-lo a les deu vol dir que l'última hora i mitja
     desperta no hi surt mai. Un trigger horari d'Apps Script salta en algun
     moment dins de l'hora, no en punt: això vol dir entre les 23:00 i les
     24:00, sempre el mateix dia. */
  hora_resum: '23',
  dia_revisio: '7',    // 1 = dilluns ... 7 = diumenge
  /* La revisió de la setmana anava clavada a les 20:00 dins del codi, i era
     l'únic horari que no es podia tocar sense tocar el codi. Ara és una clau
     més, i per defecte va allà mateix que el resum del dia: tancar la
     setmana també és una cosa de final de dia. */
  hora_revisio: '23',

  // La configuració web de Firebase NO és aquí: viu a firebase.config.json.
  // Ha de ser un fitxer perquè el treballador de servei l'ha de poder llegir
  // amb l'app tancada, i des d'allà no es pot cridar aquesta API. Una sola
  // font per als dos, doncs. L'únic secret, el compte de servei, va a
  // Script Properties (FIREBASE_COMPTE).

  // Manteniment
  max_files_registre: '5000'
};

var Config = (function () {
  var memo = null;

  function props_() {
    return PropertiesService.getScriptProperties();
  }

  /** Identificador del full de càlcul. Null si encara no s'ha configurat. */
  function idFull() {
    return props_().getProperty(PROP_ID_FULL) || null;
  }

  function desaIdFull(id) {
    props_().setProperty(PROP_ID_FULL, id);
  }

  /** El full de càlcul. Llança error clar si encara no existeix. */
  function full() {
    var id = idFull();
    if (!id) {
      throw new Error(
        'JEFE no està configurat. Executa la funció configuraJefe() des de l\'editor d\'Apps Script.'
      );
    }
    return SpreadsheetApp.openById(id);
  }

  /** Llegeix tot el full `_Config` com a objecte clau→valor. Memoritzat per execució. */
  function tot() {
    if (memo) return memo;
    memo = {};
    try {
      var files = Dades.llegeix('_Config');
      for (var i = 0; i < files.length; i++) {
        if (files[i].clau) memo[String(files[i].clau)] = String(files[i].valor);
      }
    } catch (err) {
      // Durant la instal·lació el full encara pot no existir.
      memo = {};
    }
    return memo;
  }

  function get(clau, perDefecte) {
    var v = tot()[clau];
    if (v === undefined || v === '') {
      if (perDefecte !== undefined) return perDefecte;
      return CONFIG_DEFECTE[clau] !== undefined ? CONFIG_DEFECTE[clau] : null;
    }
    return v;
  }

  function getNum(clau, perDefecte) {
    var n = Number(get(clau, perDefecte));
    return isNaN(n) ? perDefecte : n;
  }

  function esSi(clau) {
    return String(get(clau)).toUpperCase() === 'SI';
  }

  function set(clau, valor) {
    Dades.desa('_Config', {
      clau: clau,
      valor: String(valor),
      actualitzat_el: Utils.ara()
    }, ['clau']);
    memo = null;
  }

  /** Escriu els valors per defecte que faltin. No toca mai els que ja hi són. */
  function inicialitza() {
    var actual = {};
    var files = Dades.llegeix('_Config');
    for (var i = 0; i < files.length; i++) actual[String(files[i].clau)] = true;

    var afegides = 0;
    for (var clau in CONFIG_DEFECTE) {
      if (!actual[clau]) {
        Dades.insereix('_Config', {
          clau: clau,
          valor: CONFIG_DEFECTE[clau],
          actualitzat_el: Utils.ara()
        });
        afegides++;
      }
    }
    memo = null;
    return afegides;
  }

  function zonaHoraria() {
    return get('zona_horaria', 'Europe/Madrid');
  }

  return {
    idFull: idFull,
    desaIdFull: desaIdFull,
    full: full,
    tot: tot,
    get: get,
    getNum: getNum,
    esSi: esSi,
    set: set,
    inicialitza: inicialitza,
    zonaHoraria: zonaHoraria
  };
})();
