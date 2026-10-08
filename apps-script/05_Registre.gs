/**
 * JEFE — NUCLI · Registre d'esdeveniments
 *
 * Tot el que passa deixa constància al full `_Registre`.
 * Regla dura: el registre MAI pot fer caure una operació. Si no pot escriure
 * al full, escriu a la consola d'Apps Script i calla.
 */

var Log = (function () {

  function escriu_(nivell, origen, missatge, dades) {
    var linia = [
      Utils.nouId('log'),
      Utils.ara(),
      nivell,
      String(origen || ''),
      String(missatge || ''),
      dades === undefined ? '' : Utils.talla(Utils.json(dades), 900)
    ];
    try {
      var full = Config.full().getSheetByName('_Registre');
      if (!full) throw new Error('sense full');
      full.appendRow(linia);
    } catch (err) {
      console.log('[POPU ' + nivell + '] ' + origen + ': ' + missatge +
                  (dades !== undefined ? ' ' + Utils.json(dades) : '') +
                  ' (no s\'ha pogut desar al full: ' + err.message + ')');
    }
  }

  return {
    info: function (origen, missatge, dades) { escriu_('INFO', origen, missatge, dades); },
    avis: function (origen, missatge, dades) { escriu_('AVIS', origen, missatge, dades); },

    /** Accepta un Error o un text. */
    error: function (origen, missatge, dades) {
      var m = (missatge && missatge.message) ? missatge.message : missatge;
      var d = dades;
      if (missatge && missatge.stack) {
        d = { stack: Utils.talla(String(missatge.stack), 600), dades: dades };
      }
      escriu_('ERROR', origen, m, d);
    },

    /** Últimes n entrades, de la més recent a la més antiga. */
    ultimes: function (n, nivell) {
      var files;
      try { files = Dades.llegeix('_Registre'); } catch (e) { return []; }
      if (nivell) files = files.filter(function (f) { return f.nivell === nivell; });
      return files.slice(-(n || 50)).reverse();
    },

    /**
     * Rotació: si `_Registre` supera el màxim configurat, mou les files
     * antigues a `_RegistreArxiu`. No esborra res: ho trasllada.
     */
    rota: function () {
      var max = Config.getNum('max_files_registre', 5000);
      var ss = Config.full();
      var full = ss.getSheetByName('_Registre');
      if (!full) return 0;

      var files = full.getLastRow() - 1;
      if (files <= max) return 0;

      var aMoure = files - Math.floor(max * 0.7);
      var arxiu = ss.getSheetByName('_RegistreArxiu');
      if (!arxiu) {
        arxiu = ss.insertSheet('_RegistreArxiu');
        arxiu.appendRow(full.getRange(1, 1, 1, full.getLastColumn()).getValues()[0]);
        arxiu.setFrozenRows(1);
      }

      var dades = full.getRange(2, 1, aMoure, full.getLastColumn()).getValues();
      arxiu.getRange(arxiu.getLastRow() + 1, 1, dades.length, dades[0].length).setValues(dades);
      full.deleteRows(2, aMoure);

      escriu_('INFO', 'registre.rota', 'Files traslladades a l\'arxiu', { files: aMoure });
      return aMoure;
    }
  };
})();
