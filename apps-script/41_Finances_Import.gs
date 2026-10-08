/**
 * JEFE — MÒDUL · Finances · migració des de l'app antiga
 *
 * Desmunta el bloc JSON que l'app «finances» desava en una pestanya amagada i
 * el reparteix en files: moviments, categories, recurrents, pressupostos i
 * patrimoni.
 *
 * TRES GARANTIES, i són el motiu pel qual està escrita així:
 *   1. No esborra ni sobreescriu res. Només afegeix el que falta.
 *   2. Es pot repetir. Els identificadors es deriven dels de l'app antiga, o
 *      sigui que una fila ja importada es reconeix i s'ignora. Importar dos
 *      cops dona el mateix resultat que importar-ne un.
 *   3. Amb `simulacio` a cert no escriu res i et diu què faria.
 *
 * IMPORTA-HO TOT, encara que la pantalla d'ara no ho ensenyi. Els recurrents,
 * els pressupostos i el patrimoni entren igualment: val més tenir-ho desat i
 * no mostrat que no pas haver-hi de tornar quan la pantalla arribi.
 */
var FinancesImport = (function () {

  function num_(v) {
    var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.'));
    return isFinite(n) ? Math.abs(n) : 0;
  }

  function data_(v) {
    var t = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
  }

  function importa(dades, simulacio) {
    if (typeof dades === 'string') dades = Utils.desJson(dades, null);
    if (!dades) throw new Error('El fitxer no és JSON vàlid.');

    // L'exportació de l'app pot venir plana o dins d'un embolcall.
    var s = dades.state || dades.data || dades;
    if (!s.tx && !s.cats) {
      throw new Error('Això no sembla una còpia de finances: no hi trobo ni «tx» ni «cats».');
    }

    var informe = {
      simulacio: !!simulacio,
      categories: 0, moviments: 0, recurrents: 0, pressupostos: 0,
      actius: 0, valorsPatrimoni: 0, comercos: 0, ajustos: false,
      jaHiEren: 0, senseCategoria: 0, avisos: []
    };

    // Els identificadors que ja hi ha, llegits UN cop per full. Comprovar-ho
    // fila a fila amb tres-cents moviments multiplicaria les lectures i
    // esgotaria el temps d'execució.
    var jaHi = {};
    ['Categories', 'Moviments', 'Recurrents', 'Pressupostos',
     'Patrimoni', 'PatrimoniHistoric'].forEach(function (full) {
      jaHi[full] = {};
      try {
        Dades.llegeix(full).forEach(function (f) { jaHi[full][String(f.id)] = true; });
      } catch (err) {
        informe.avisos.push('Falta el full «' + full + '». Executa configuraJefe().');
      }
    });
    if (informe.avisos.length) return informe;

    // ---- categories. Van primer: els moviments hi apunten.
    var novesCat = [];
    (s.cats || []).forEach(function (c, i) {
      var id = String(c.id || '').trim();
      if (!id) { informe.avisos.push('Una categoria sense identificador, saltada.'); return; }
      if (jaHi.Categories[id]) { informe.jaHiEren++; return; }
      jaHi.Categories[id] = true;
      novesCat.push({
        id: id,
        nom: String(c.n || c.nom || id),
        emoji: String(c.e || ''),
        mena: c.k === 'i' ? 'i' : 'd',
        color: String(c.col || ''),
        exclou: c.excl ? 'SI' : 'NO',
        ordre: i + 1
      });
    });

    // ---- moviments
    var nousMov = [];
    (s.tx || []).forEach(function (t) {
      var id = String(t.id || '').trim();
      if (!id) { informe.avisos.push('Un moviment sense identificador, saltat.'); return; }
      if (jaHi.Moviments[id]) { informe.jaHiEren++; return; }

      var d = data_(t.date);
      if (!d) { informe.avisos.push('Moviment amb data estranya, saltat: ' + t.date); return; }

      jaHi.Moviments[id] = true;
      var cat = String(t.cat || '');
      if (cat === 'c_altd' || cat === 'i_alti' || !cat) informe.senseCategoria++;

      nousMov.push({
        id: id,
        data: d,
        tipus: t.type === 'i' ? 'i' : 'd',
        'import': num_(t.amount),
        categoria: cat || (t.type === 'i' ? 'i_alti' : 'c_altd'),
        descripcio: String(t.desc || ''),
        metode: String(t.method || 'targeta'),
        origen: t.src === 'banc' ? 'banc' : 'manual',
        id_banc: String(t.bankId || ''),
        pendent: t.pend ? 'SI' : 'NO',
        nota: String(t.note || ''),
        // `ok` de l'app antiga vol dir «ja ho he mirat». Es respecta: si allà
        // ho havies revisat, aquí no torna a la safata.
        revisat: t.ok === false ? 'NO' : 'SI'
      });
    });

    // ---- recurrents
    var nousRec = [];
    (s.recur || []).forEach(function (r) {
      var id = String(r.id || '').trim();
      if (!id || jaHi.Recurrents[id]) { if (id) informe.jaHiEren++; return; }
      jaHi.Recurrents[id] = true;
      nousRec.push({
        id: id,
        tipus: r.type === 'i' ? 'i' : 'd',
        'import': num_(r.amount),
        categoria: String(r.cat || ''),
        descripcio: String(r.desc || ''),
        metode: String(r.method || 'domic'),
        dia: Math.min(28, Math.max(1, Number(r.day) || 1)),
        actiu: r.actiu === false ? 'NO' : 'SI',
        ultim_mes: String(r.lastYm || '')
      });
    });

    // ---- pressupostos
    var nousPres = [];
    var budgets = s.budgets || {};
    Object.keys(budgets).forEach(function (idCat) {
      var id = 'pres_' + idCat;
      if (jaHi.Pressupostos[id]) { informe.jaHiEren++; return; }
      jaHi.Pressupostos[id] = true;
      nousPres.push({ id: id, id_categoria: idCat, limit_mensual: num_(budgets[idCat]) });
    });

    // ---- patrimoni: la fitxa de l'actiu i el seu històric, per separat
    var nousAct = [], nousVal = [];
    (s.actius || []).forEach(function (a) {
      var id = String(a.id || '').trim();
      if (!id) { informe.avisos.push('Un actiu sense identificador, saltat.'); return; }

      if (!jaHi.Patrimoni[id]) {
        jaHi.Patrimoni[id] = true;
        nousAct.push({
          id: id,
          nom: String(a.nom || id),
          tipus: String(a.tipus || ''),
          automatic: a.auto ? 'SI' : 'NO'
        });
      } else {
        informe.jaHiEren++;
      }

      (a.hist || []).forEach(function (h) {
        var d = data_(h.d);
        if (!d) return;
        // L'identificador surt de l'actiu i el dia: dos valors del mateix dia
        // són el mateix valor, i tornar a importar no en duplica cap.
        var idv = 'val_' + id + '_' + d;
        if (jaHi.PatrimoniHistoric[idv]) { informe.jaHiEren++; return; }
        jaHi.PatrimoniHistoric[idv] = true;
        nousVal.push({ id: idv, id_actiu: id, data: d, valor: Number(h.v) || 0 });
      });
    });

    /* ---- la memòria de comerços, a partir del que ja tenies classificat.
       Aquest és el pas que fa que la migració valgui la pena: quatre mesos
       de decisions teves passen a ser coneixement. Sense això, el primer
       extracte del banc et tornaria a preguntar per comerços que ja havies
       classificat cent vegades. Es mira l'històric SENCER, no només el que
       s'importa ara, perquè el que ja hi hagués aquí també compta. */
    var jaMemoria = {};
    try {
      Dades.llegeix('FinancesMemoria').forEach(function (f) { jaMemoria[String(f.clau)] = true; });
    } catch (err) {
      informe.avisos.push('Falta el full «FinancesMemoria». Executa configuraJefe().');
      return informe;
    }

    var apres = {};
    (s.tx || []).forEach(function (t) {
      var cat = String(t.cat || '');
      if (!cat || cat === 'c_altd' || cat === 'i_alti') return;
      var clau = Finances.clauMemoria(t.desc, t.type);
      if (!clau) return;
      var d = data_(t.date) || '';
      // Mana la decisió MÉS RECENT: si vas canviar d'opinió sobre un comerç,
      // el que val és l'última vegada, no la primera. Però el comptador es
      // manté: abans es reiniciava a zero cada cop que apareixia una data més
      // nova, i un comerç amb vint compres acabava dient «vist 1 cops».
      if (!apres[clau]) {
        apres[clau] = { clau: clau, mostra: '', categoria: '', metode: '', data: '', cops: 0 };
      }
      apres[clau].cops++;
      if (d >= apres[clau].data) {
        apres[clau].mostra = String(t.desc || '').trim();
        apres[clau].categoria = cat;
        apres[clau].metode = String(t.method || '');
        apres[clau].data = d;
      }
    });

    var novaMem = Object.keys(apres).filter(function (k) { return !jaMemoria[k]; })
      .map(function (k) {
        var a = apres[k];
        return { id: 'mem_' + k.slice(0, 40).replace(/ /g, '_'),
                 clau: a.clau, mostra: a.mostra, categoria: a.categoria,
                 metode: a.metode, cops: a.cops };
      });
    informe.comercos = novaMem.length;

    informe.categories = novesCat.length;
    informe.moviments = nousMov.length;
    informe.recurrents = nousRec.length;
    informe.pressupostos = nousPres.length;
    informe.actius = nousAct.length;
    informe.valorsPatrimoni = nousVal.length;

    // ---- ajustos
    var canvis = {};
    if (s.settings) {
      if (s.settings.goal !== undefined) canvis.fin_objectiu_estalvi = num_(s.settings.goal);
      if (s.settings.cur) canvis.fin_moneda = String(s.settings.cur);
    }
    informe.ajustos = Object.keys(canvis).length > 0;

    if (simulacio) return informe;

    // L'ordre importa: les categories abans que els moviments, i els actius
    // abans que els seus valors.
    if (novesCat.length)  Dades.insereixMoltes('Categories', novesCat, 'cat');
    if (nousMov.length)   Dades.insereixMoltes('Moviments', nousMov, 'mov');
    if (nousRec.length)   Dades.insereixMoltes('Recurrents', nousRec, 'rec');
    if (nousPres.length)  Dades.insereixMoltes('Pressupostos', nousPres, 'pres');
    if (nousAct.length)   Dades.insereixMoltes('Patrimoni', nousAct, 'act');
    if (nousVal.length)   Dades.insereixMoltes('PatrimoniHistoric', nousVal, 'val');
    if (novaMem.length)   Dades.insereixMoltes('FinancesMemoria', novaMem, 'mem');
    for (var k in canvis) Config.set(k, canvis[k]);

    Log.info('finances.importa', 'Importació des de l\'app antiga', informe);
    return informe;
  }

  return { importa: importa };
})();
