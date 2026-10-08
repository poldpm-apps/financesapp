/**
 * JEFE — NUCLI · Esquema i migracions
 *
 * L'esquema és la suma de:
 *   - els fulls del nucli (declarats aquí),
 *   - més els fulls que declara cada mòdul al seu descriptor (`fulls: [...]`).
 *
 * Sincronitzar és NO DESTRUCTIU, sempre:
 *   - falta un full        → el crea
 *   - falta una columna    → l'afegeix AL FINAL, buida
 *   - sobra una columna    → no la toca; escriu un AVIS a `_Registre`
 *   - columna reanomenada  → es veu com "en falta una i en sobra una". No endevina res.
 *
 * Mai reordena ni esborra columnes amb dades.
 *
 * Tipus de columna (només afecten el format de la cel·la):
 *   'text' | 'data' (AAAA-MM-DD) | 'iso' (marca de temps) | 'num' | 'json'
 */

var FULLS_NUCLI = [
  {
    nom: '_Config',
    columnes: [
      { nom: 'clau', tipus: 'text' },
      { nom: 'valor', tipus: 'text' },
      { nom: 'actualitzat_el', tipus: 'iso' }
    ]
  },
  {
    nom: '_Registre',
    columnes: [
      { nom: 'id', tipus: 'text' },
      { nom: 'marca_temps', tipus: 'iso' },
      { nom: 'nivell', tipus: 'text', valors: ['INFO', 'AVIS', 'ERROR'] },
      { nom: 'origen', tipus: 'text' },
      { nom: 'missatge', tipus: 'text' },
      { nom: 'dades', tipus: 'json' }
    ]
  },
  {
    nom: '_Dispositius',
    columnes: [
      { nom: 'id', tipus: 'text' },
      { nom: 'fitxa', tipus: 'text' },              // la fitxa d'FCM del navegador
      { nom: 'nom', tipus: 'text' },
      { nom: 'actiu', tipus: 'text', valors: ['SI', 'NO'] },
      { nom: 'ultim_error', tipus: 'text' },
      { nom: 'creat_el', tipus: 'iso' },
      { nom: 'vist_el', tipus: 'iso' },
      { nom: 'actualitzat_el', tipus: 'iso' }
    ]
  },
  {
    /* El que ha passat i què se n'ha dit. Hi va TOT: també el que s'ha callat
       per no passar-se del pressupost del dia. Vegeu `65_Senyals.gs`. */
    nom: '_Senyals',
    columnes: [
      { nom: 'id',        tipus: 'text' },
      { nom: 'clau',      tipus: 'text' },   // senyal + dia: un per dia i prou
      { nom: 'senyal',    tipus: 'text' },
      { nom: 'modul',     tipus: 'text' },
      { nom: 'data',      tipus: 'data' },
      { nom: 'titol',     tipus: 'text' },
      { nom: 'text',      tipus: 'text' },
      { nom: 'urgencia',  tipus: 'num'  },
      { nom: 'enviat_el', tipus: 'iso'  },
      { nom: 'creat_el',  tipus: 'iso'  },
      { nom: 'actualitzat_el', tipus: 'iso' }
    ]
  },
  {
    /* L'últim creuament de totes les sèries. UNA SOLA FILA, la de sempre:
       això no és un històric, és el resultat d'ara, i el de la setmana
       passada no serveix per a res un cop hi ha el d'aquesta. Vegeu
       `70_Creuaments.gs`. Va al nucli i no a cap mòdul perquè el que hi ha
       dins surt de tots alhora i no és de ningú. */
    nom: '_Relacions',
    columnes: [
      { nom: 'id',          tipus: 'text' },
      { nom: 'calculat_el', tipus: 'iso'  },
      { nom: 'desde',       tipus: 'data' },
      { nom: 'fins',        tipus: 'data' },
      { nom: 'series',      tipus: 'num'  },
      { nom: 'parelles',    tipus: 'num'  },
      { nom: 'provades',    tipus: 'num'  },
      { nom: 'resultat',    tipus: 'json' },
      { nom: 'creat_el',    tipus: 'iso'  },
      { nom: 'actualitzat_el', tipus: 'iso' }
    ]
  },
  {
    nom: '_Moduls',
    columnes: [
      { nom: 'id_modul', tipus: 'text' },
      { nom: 'nom', tipus: 'text' },
      { nom: 'icona', tipus: 'text' },
      { nom: 'actiu', tipus: 'text', valors: ['SI', 'NO'] },
      { nom: 'ordre', tipus: 'num' },
      { nom: 'versio_esquema', tipus: 'num' },
      { nom: 'actualitzat_el', tipus: 'iso' }
    ]
  }
];

var Esquema = (function () {

  function formatDe_(tipus) {
    // Text pla per a tot el que no és número: evita que Sheets converteixi
    // '2026-07-30' en una data amb zona horària pròpia, o '007' en 7.
    return tipus === 'num' ? null : '@';
  }

  /** Tots els fulls declarats: nucli + mòduls. */
  function declarat() {
    var fulls = FULLS_NUCLI.slice();
    var moduls = modulsRegistrats_();
    for (var i = 0; i < moduls.length; i++) {
      var f = moduls[i].fulls || [];
      for (var j = 0; j < f.length; j++) {
        var copia = {};
        for (var k in f[j]) copia[k] = f[j][k];
        copia._modul = moduls[i].id;
        fulls.push(copia);
      }
    }
    return fulls;
  }

  function creaFull_(ss, def) {
    var full = ss.insertSheet(def.nom);
    var noms = def.columnes.map(function (c) { return c.nom; });

    full.getRange(1, 1, 1, noms.length).setValues([noms]).setFontWeight('bold');
    full.setFrozenRows(1);

    for (var i = 0; i < def.columnes.length; i++) {
      var fmt = formatDe_(def.columnes[i].tipus);
      if (fmt) full.getRange(2, i + 1, full.getMaxRows() - 1, 1).setNumberFormat(fmt);
    }

    // Deixa el full amb només les columnes declarades, per no arrossegar
    // 26 columnes buides que confonen quan l'obres a mà.
    var sobrants = full.getMaxColumns() - noms.length;
    if (sobrants > 0) full.deleteColumns(noms.length + 1, sobrants);

    return full;
  }

  /**
   * Sincronitza l'esquema. Retorna un informe del que ha fet i del que ha vist
   * i no ha tocat. No llança mai per una discrepància: informa.
   */
  function sincronitza() {
    var ss = Config.full();
    var informe = { fullsCreats: [], columnesAfegides: [], avisos: [] };
    var fulls = declarat();

    for (var i = 0; i < fulls.length; i++) {
      var def = fulls[i];
      var full = ss.getSheetByName(def.nom);

      if (!full) {
        creaFull_(ss, def);
        informe.fullsCreats.push(def.nom);
        continue;
      }

      var actuals = full.getLastColumn() > 0
        ? full.getRange(1, 1, 1, full.getLastColumn()).getValues()[0]
            .map(function (c) { return String(c).trim(); })
        : [];

      // Columnes declarades que no hi són → s'afegeixen al final
      for (var j = 0; j < def.columnes.length; j++) {
        var nom = def.columnes[j].nom;
        if (actuals.indexOf(nom) === -1) {
          var col = actuals.length + 1;
          if (full.getMaxColumns() < col) full.insertColumnsAfter(full.getMaxColumns(), 1);
          full.getRange(1, col).setValue(nom).setFontWeight('bold');
          var fmt = formatDe_(def.columnes[j].tipus);
          if (fmt) full.getRange(2, col, full.getMaxRows() - 1, 1).setNumberFormat(fmt);
          actuals.push(nom);
          informe.columnesAfegides.push(def.nom + '.' + nom);
        }
      }

      // Columnes que hi són i no estan declarades → no es toquen, s'avisa
      var declarades = def.columnes.map(function (c) { return c.nom; });
      for (var k = 0; k < actuals.length; k++) {
        if (actuals[k] && declarades.indexOf(actuals[k]) === -1) {
          informe.avisos.push(
            'El full «' + def.nom + '» té la columna «' + actuals[k] +
            '» que cap mòdul declara. No s\'ha tocat.'
          );
        }
      }
    }

    Dades.invalida();

    if (informe.fullsCreats.length || informe.columnesAfegides.length) {
      Log.info('esquema.sincronitza', 'Esquema actualitzat', informe);
    }
    for (var a = 0; a < informe.avisos.length; a++) {
      Log.avis('esquema.sincronitza', informe.avisos[a]);
    }

    return informe;
  }

  /**
   * Comprova sense tocar res. El fa servir el trigger de manteniment i
   * la pantalla de diagnòstic.
   */
  function comprova() {
    var ss = Config.full();
    var problemes = [];
    var fulls = declarat();

    for (var i = 0; i < fulls.length; i++) {
      var def = fulls[i];
      var full = ss.getSheetByName(def.nom);
      if (!full) { problemes.push('Falta el full «' + def.nom + '»'); continue; }

      var actuals = full.getLastColumn() > 0
        ? full.getRange(1, 1, 1, full.getLastColumn()).getValues()[0]
            .map(function (c) { return String(c).trim(); })
        : [];

      for (var j = 0; j < def.columnes.length; j++) {
        if (actuals.indexOf(def.columnes[j].nom) === -1) {
          problemes.push('Falta la columna «' + def.columnes[j].nom + '» a «' + def.nom + '»');
        }
      }
    }
    return problemes;
  }

  return {
    declarat: declarat,
    sincronitza: sincronitza,
    comprova: comprova
  };
})();
