/**
 * JEFE — NUCLI · Accés a dades
 *
 * Única porta d'entrada al full de càlcul. Cap mòdul obre fulls pel seu compte.
 *
 * Principis:
 *   - Cada fila és un objecte {columna: valor}. Ningú treballa amb índexs de fila.
 *   - Tot té `id` propi. Ordenar o inserir files no trenca cap referència.
 *   - Cap operació esborra files. `desa` fa upsert; els mòduls arxiven, no eliminen.
 *   - Memòria d'execució: cada full es llegeix un sol cop per execució.
 */

var Dades = (function () {

  var memo = {};   // nom del full -> {fulla, capcalera, files}

  // ---------- intern ----------

  function fulla_(nom) {
    var f = Config.full().getSheetByName(nom);
    if (!f) {
      throw new Error('No existeix el full «' + nom + '». Executa configuraJefe() per crear-lo.');
    }
    return f;
  }

  /**
   * UNA SOLA ANADA A GOOGLE SHEETS, NO TRES.
   *
   * Abans això feia `getLastRow()`, `getLastColumn()` i `getRange().getValues()`:
   * tres crides, i cadascuna és un viatge a la infraestructura de Sheets amb el
   * seu propi temps d'espera. Mesurat, llegir una pestanya BUIDA costava 480 ms
   * —cap dada, tot espera— i les 26 categories, 348. El cost no era de les
   * dades: era d'anar-hi tres vegades.
   *
   * `getDataRange()` ja sap fins on arriben les dades i les torna d'un sol
   * viatge.
   */
  function carrega_(nom) {
    if (memo[nom]) return memo[nom];
    var f = fulla_(nom);
    var valors = f.getDataRange().getValues();
    if (!valors.length) valors = [[]];
    var capcalera = (valors[0] || []).map(function (c) { return String(c).trim(); });
    memo[nom] = { fulla: f, capcalera: capcalera, files: valors.slice(1) };
    return memo[nom];
  }

  function invalida(nom) {
    if (nom) delete memo[nom]; else memo = {};

    /* Si canvia una dada, la fitxa que llegeix la IA deixa de valer. S'esborra
       aquí perquè aquest és l'únic lloc pel qual passen TOTES les escriptures:
       posar-ho a cada mòdul seria confiar que ningú se n'oblidi mai.

       PERÒ NOMÉS SI AQUELL FULL HI SURT. Parlar amb en JEFE escriu al full de
       converses, i això esborrava la fitxa: cada pregunta la tornava a muntar
       de zero i s'hi anaven tres segons. El full de converses no aporta res a
       la fitxa —el mòdul de conversa no té `contextIA`— o sigui que llençar-la
       era pagar per no guanyar res. Qui hi surt i qui no ho diuen els mòduls;
       aquí no se sap ni cal saber-ho. */
    if (typeof Moduls === 'undefined') return;

    /* I TOT EL QUE HAGI MUNTAT AQUELL MÒDUL.
       Aquest és l'únic lloc pel qual passen totes les escriptures, i per això
       és l'únic on la invalidació no es pot oblidar. Del full se'n dedueix el
       mòdul; si el full no és de ningú —la configuració, per exemple— no se
       sap qui en depèn i cauen tots. */
    if (typeof Memoria !== 'undefined' && Moduls.deQui) {
      var seu = nom ? Moduls.deQui(nom) : null;
      if (seu) Memoria.oblida(seu.id);
      else Memoria.oblidaTot(Moduls.actius().map(function (m) { return m.id; }));
      // I el que suma tots els mòduls, sempre: no se sap qui hi aportava això.
      Memoria.oblidaComu();
    }

    if (!Moduls.invalidaContext) return;
    if (nom && Moduls.alimentaContext && !Moduls.alimentaContext(nom)) return;
    // Amb el nom del full, només cau el tros de qui el té. Sense, tot.
    Moduls.invalidaContext(nom || null);
  }

  function esBuida_(fila) {
    for (var i = 0; i < fila.length; i++) {
      if (fila[i] !== '' && fila[i] !== null) return false;
    }
    return true;
  }

  function aObjecte_(capcalera, fila) {
    var o = {};
    for (var i = 0; i < capcalera.length; i++) {
      if (capcalera[i]) o[capcalera[i]] = fila[i] === undefined ? '' : fila[i];
    }
    return o;
  }

  function aFila_(capcalera, obj) {
    var fila = [];
    for (var i = 0; i < capcalera.length; i++) {
      var v = obj[capcalera[i]];
      fila.push(v === undefined || v === null ? '' : v);
    }
    return fila;
  }

  /**
   * Filtre: pot ser
   *   - undefined            → tot
   *   - funció(objecte)      → predicat lliure
   *   - objecte {col: valor} → igualtat; si el valor és array, "és un d'aquests"
   */
  function compleix_(obj, filtre) {
    if (!filtre) return true;
    if (typeof filtre === 'function') return !!filtre(obj);
    for (var clau in filtre) {
      var esperat = filtre[clau];
      var real = obj[clau];
      if (Array.isArray(esperat)) {
        var trobat = false;
        for (var i = 0; i < esperat.length; i++) {
          if (String(real) === String(esperat[i])) { trobat = true; break; }
        }
        if (!trobat) return false;
      } else if (String(real) !== String(esperat)) {
        return false;
      }
    }
    return true;
  }

  // ---------- API pública ----------

  /** Llegeix files com a objectes. Cada objecte porta `_fila` (número de fila real). */
  function llegeix(nom, filtre) {
    var d = carrega_(nom);
    var out = [];
    for (var i = 0; i < d.files.length; i++) {
      if (esBuida_(d.files[i])) continue;
      var o = aObjecte_(d.capcalera, d.files[i]);
      o._fila = i + 2;
      if (compleix_(o, filtre)) out.push(o);
    }
    return out;
  }

  /** Primera coincidència, o null. */
  function un(nom, filtre) {
    var r = llegeix(nom, filtre);
    return r.length ? r[0] : null;
  }

  function perId(nom, id) {
    if (!id) return null;
    return un(nom, { id: id });
  }

  function compta(nom, filtre) {
    return llegeix(nom, filtre).length;
  }

  /**
   * Insereix una fila nova. Si l'objecte no porta `id` i el full té columna `id`,
   * se'n genera un amb el prefix indicat.
   */
  function insereix(nom, obj, prefixId) {
    /* MIRAR ON ACABA EL FULL I ESCRIURE-HI NO SÓN EL MATEIX MOMENT.
       Entremig hi caben una altra pestanya i un automatisme, i les dues
       escriurien a la mateixa fila: la segona es menja la primera i ningú
       se n'assabenta, perquè totes dues han dit que sí. El bloqueig només
       ha d'abraçar això, que és on hi ha la cursa. */
    return ambBloqueig_(function () {
      var d = carrega_(nom);
      var nou = {};
      for (var k in obj) nou[k] = obj[k];

      if (d.capcalera.indexOf('id') !== -1 && !nou.id) {
        nou.id = Utils.nouId(prefixId || nom.toLowerCase().slice(0, 3));
      }
      if (d.capcalera.indexOf('creat_el') !== -1 && !nou.creat_el) {
        nou.creat_el = Utils.ara();
      }

      // NO fer servir appendRow. Escriu com si haguessis teclejat a la cel·la:
      // es salta el format de text de la columna i converteix '2026-08-01' en
      // un objecte Data amb zona horària. Llavors la fila es desa d'una manera
      // i es busca d'una altra, i no es troba mai. setValues sí que respecta el
      // format, que és el que fa insereixMoltes des del primer dia.
      escriuFila_(d, d.fulla.getLastRow() + 1, aFila_(d.capcalera, nou));
      invalida(nom);
      return nou;
    });
  }

  /** Escriu una fila respectant el format de les columnes, creixent si cal. */
  function escriuFila_(d, fila, valors) {
    if (fila > d.fulla.getMaxRows()) {
      d.fulla.insertRowsAfter(d.fulla.getMaxRows(), 100);
    }
    d.fulla.getRange(fila, 1, 1, d.capcalera.length).setValues([valors]);
  }

  /** Actualitza per id. Retorna l'objecte resultant, o null si no existeix. */
  function actualitza(nom, id, canvis) {
    /* Llegir la fila, fusionar-hi els canvis i tornar-la a escriure tampoc
       és un sol moment: qui escrigui entremig es perd, perquè aquí es desa
       la fila SENCERA i la versió que teníem és la d'abans. */
    return ambBloqueig_(function () {
      var d = carrega_(nom);
      var actual = perId(nom, id);
      if (!actual) return null;

      var fusionat = {};
      for (var k in actual) if (k !== '_fila') fusionat[k] = actual[k];
      for (var c in canvis) fusionat[c] = canvis[c];
      if (d.capcalera.indexOf('actualitzat_el') !== -1) fusionat.actualitzat_el = Utils.ara();

      d.fulla.getRange(actual._fila, 1, 1, d.capcalera.length)
             .setValues([aFila_(d.capcalera, fusionat)]);
      invalida(nom);
      return fusionat;
    });
  }

  /**
   * Upsert per columnes clau. Si troba una fila que coincideix en TOTES
   * les columnes clau, l'actualitza; si no, insereix.
   * Exemple: Dades.desa('HabitsRegistre', reg, ['id_habit', 'data'])
   */
  function desa(nom, obj, claus, prefixId) {
    /* «Si hi és l'actualitzo i si no l'insereixo» és la cursa de manual:
       dues crides alhora poden trobar totes dues que no hi és i inserir-la
       dues vegades. El bloqueig ha d'anar per fora de la pregunta, no per
       dins de la resposta. */
    return ambBloqueig_(function () {
      var d = carrega_(nom);
      if (!claus || !claus.length) return insereix(nom, obj, prefixId);

      var filtre = {};
      for (var i = 0; i < claus.length; i++) filtre[claus[i]] = obj[claus[i]];
      var existent = un(nom, filtre);

      if (!existent) return insereix(nom, obj, prefixId);

      var fusionat = {};
      for (var k in existent) if (k !== '_fila') fusionat[k] = existent[k];
      for (var c in obj) fusionat[c] = obj[c];
      if (d.capcalera.indexOf('actualitzat_el') !== -1) fusionat.actualitzat_el = Utils.ara();

      d.fulla.getRange(existent._fila, 1, 1, d.capcalera.length)
             .setValues([aFila_(d.capcalera, fusionat)]);
      invalida(nom);
      return fusionat;
    });
  }

  /** Insereix moltes files de cop. Molt més ràpid que insereix() en bucle. */
  function insereixMoltes(nom, objectes, prefixId) {
    if (!objectes || !objectes.length) return [];
    return ambBloqueig_(function () {      // la mateixa cursa que `insereix`, per vint
      var d = carrega_(nom);
      var files = [];
      var creats = [];

      for (var i = 0; i < objectes.length; i++) {
        var nou = {};
        for (var k in objectes[i]) nou[k] = objectes[i][k];
        if (d.capcalera.indexOf('id') !== -1 && !nou.id) {
          nou.id = Utils.nouId(prefixId || nom.toLowerCase().slice(0, 3));
        }
        if (d.capcalera.indexOf('creat_el') !== -1 && !nou.creat_el) nou.creat_el = Utils.ara();
        creats.push(nou);
        files.push(aFila_(d.capcalera, nou));
      }

      var primera = d.fulla.getLastRow() + 1;
      if (primera + files.length - 1 > d.fulla.getMaxRows()) {
        d.fulla.insertRowsAfter(d.fulla.getMaxRows(), files.length + 100);
      }
      d.fulla.getRange(primera, 1, files.length, d.capcalera.length).setValues(files);
      invalida(nom);
      return creats;
    });
  }

  /**
   * El mateix canvi a moltes files alhora.
   *
   * En bucle, `actualitza` faria una crida a Sheets per fila: netejar vint
   * tasques fetes serien vint escriptures. Aquí s'escriu per TRAMS SEGUITS —
   * les files consecutives van en una sola crida— i no es toca cap fila que
   * no sigui a la llista.
   *
   * `canvis` pot ser el mateix objecte per a totes, o una FUNCIÓ
   * `(objecteActual, posicio) => canvis` quan cada fila n'ha de rebre uns de
   * diferents. Reordenar una llista és exactament aquest cas: el mateix camp
   * amb un valor diferent a cada fila.
   */
  function actualitzaMoltes(nom, ids, canvis) {
    if (!ids || !ids.length) return 0;
    return ambBloqueig_(function () {
      return actualitzaMoltes_(nom, ids, canvis);
    });
  }

  function actualitzaMoltes_(nom, ids, canvis) {
    var d = carrega_(nom);
    var perFila = (typeof canvis === 'function');

    var index = {};
    llegeix(nom).forEach(function (o) { index[o.id] = o; });

    var pendents = [];
    for (var i = 0; i < ids.length; i++) {
      var actual = index[ids[i]];
      if (!actual) continue;
      var seus = perFila ? canvis(actual, i) : canvis;
      var fusionat = {};
      for (var k in actual) if (k !== '_fila') fusionat[k] = actual[k];
      for (var c in seus) fusionat[c] = seus[c];
      if (d.capcalera.indexOf('actualitzat_el') !== -1) fusionat.actualitzat_el = Utils.ara();
      pendents.push({ fila: actual._fila, valors: aFila_(d.capcalera, fusionat) });
    }
    if (!pendents.length) return 0;

    pendents.sort(function (a, b) { return a.fila - b.fila; });
    var p = 0;
    while (p < pendents.length) {
      var q = p;
      while (q + 1 < pendents.length && pendents[q + 1].fila === pendents[q].fila + 1) q++;
      d.fulla.getRange(pendents[p].fila, 1, q - p + 1, d.capcalera.length)
             .setValues(pendents.slice(p, q + 1).map(function (x) { return x.valors; }));
      p = q + 1;
    }
    invalida(nom);
    return pendents.length;
  }

  function existeixFull(nom) {
    try { return !!Config.full().getSheetByName(nom); } catch (e) { return false; }
  }

  function capcalera(nom) {
    return carrega_(nom).capcalera.slice();
  }

  return {
    llegeix: llegeix,
    un: un,
    perId: perId,
    compta: compta,
    insereix: insereix,
    insereixMoltes: insereixMoltes,
    actualitza: actualitza,
    actualitzaMoltes: actualitzaMoltes,
    desa: desa,
    existeixFull: existeixFull,
    capcalera: capcalera,
    invalida: invalida
  };
})();

/**
 * Executa una funció amb bloqueig exclusiu. Evita que dues pestanyes obertes
 * o un trigger i tu alhora escriviu la mateixa fila.
 *
 * NO ES DEMANA DOS COPS DINS DE LA MATEIXA EXECUCIÓ.
 * Ara que cada escriptura de `Dades` el demana pel seu compte, un resum
 * nocturn —que ja s'executa dins d'un bloqueig— faria vint escriptures i
 * cadascuna en tornaria a demanar un. Que Apps Script ho permeti o no és una
 * cosa que no vull haver de saber: si aquesta execució ja el té, s'entra i
 * prou. El que no pot passar és que el fil s'esperi a si mateix.
 */
var _teElBloqueig = false;

function ambBloqueig_(fn, segons) {
  if (_teElBloqueig) return fn();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock((segons || 30) * 1000)) {
    throw new Error('El sistema està ocupat processant una altra operació. Torna-ho a provar.');
  }
  _teElBloqueig = true;
  try {
    return fn();
  } finally {
    _teElBloqueig = false;
    lock.releaseLock();
  }
}
