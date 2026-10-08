/**
 * Finances — les dades inventades del mirall
 *
 * Viuen a part perquè `mirall.mjs` no acabi sent un fitxer de mil línies on
 * el que importa —com s'enganxa el servidor fals— quedi enterrat.
 *
 * NO S'ASSEMBLEN A LES D'EN POL A POSTA. Noms, xifres i comerços són
 * inventats, i la pàgina ho diu amb una barra vermella a sota. El que sí que
 * s'assembla és la FORMA: quantitats realistes, noms llargs i curts, i prou
 * files per fer aparèixer els problemes que només surten quan n'hi ha moltes.
 */

export function dades(AVUI, menys) {

  // --------------------------------------------------------------- finances

  const CATEGORIES = [
    { id: 'c_alim', nom: 'Alimentació', emoji: '', mena: 'd', color: '', exclou: false },
    { id: 'c_casa', nom: 'Casa', emoji: '', mena: 'd', color: '', exclou: false },
    { id: 'c_cotx', nom: 'Cotxe i benzina', emoji: '', mena: 'd', color: '', exclou: false },
    { id: 'c_oci',  nom: 'Oci', emoji: '', mena: 'd', color: '', exclou: false },
    { id: 'c_altd', nom: 'Altres despeses', emoji: '', mena: 'd', color: '', exclou: false },
    { id: 'c_tras', nom: 'Traspassos', emoji: '', mena: 'd', color: '', exclou: true },
    { id: 'i_nom',  nom: 'Nòmina', emoji: '', mena: 'i', color: '', exclou: false },
    { id: 'i_alti', nom: 'Altres ingressos', emoji: '', mena: 'i', color: '', exclou: false }
  ];

  const MOVS = [
    { id: 'm1', data: menys(0), tipus: 'd', import: 43.28, categoria: 'c_alim', descripcio: 'SUPERMERCAT DEL POBLE', metode: 'targeta', revisat: true },
    { id: 'm2', data: menys(0), tipus: 'd', import: 12.5, categoria: 'c_oci', descripcio: 'BAR LA PLAÇA', metode: 'targeta', revisat: true },
    { id: 'm3', data: menys(1), tipus: 'd', import: 71.9, categoria: 'c_cotx', descripcio: 'BENZINERA CARRETERA N-260 QUILÒMETRE 42', metode: 'targeta', revisat: true },
    { id: 'm4', data: menys(2), tipus: 'd', import: 8.4, categoria: 'c_altd', descripcio: 'COMPRA AMB TARGETA', metode: 'targeta', revisat: false },
    { id: 'm5', data: menys(3), tipus: 'i', import: 2140.55, categoria: 'i_nom', descripcio: 'TRANSFERÈNCIA NÒMINA', metode: 'compte', revisat: true },
    { id: 'm6', data: menys(4), tipus: 'd', import: 620, categoria: 'c_casa', descripcio: 'REBUT LLOGUER', metode: 'rebut', revisat: true },
    { id: 'm7', data: menys(5), tipus: 'd', import: 300, categoria: 'c_tras', descripcio: 'TRASPÀS A ESTALVIS', metode: 'compte', revisat: true },
    { id: 'm8', data: menys(6), tipus: 'd', import: 26.15, categoria: 'c_alim', descripcio: 'FRUITERIA', metode: 'efectiu', revisat: true },
    { id: 'm9', data: menys(8), tipus: 'd', import: 4.9, categoria: 'c_altd', descripcio: 'BIZUM REBUT', metode: 'compte', revisat: false },
    { id: 'm10', data: menys(9), tipus: 'd', import: 149.99, categoria: 'c_casa', descripcio: 'BOTIGA D\'ELECTRODOMÈSTICS', metode: 'targeta', revisat: true }
  ].map(m => {
    const c = CATEGORIES.filter(x => x.id === m.categoria)[0] || {};
    return { ...m, categoriaNom: c.nom || m.categoria, emoji: '', origen: 'banc', pendent: false, nota: '' };
  });

  const finMes = (quin) => {
    const mes = quin || AVUI.slice(0, 7);
    const dins = MOVS.filter(m => m.data.slice(0, 7) === mes);
    const fora = { c_tras: true };
    let ingressos = 0, despeses = 0, traspassos = 0;
    const perCat = {};
    dins.forEach(m => {
      if (fora[m.categoria]) { traspassos += m.import; return; }
      if (m.tipus === 'i') { ingressos += m.import; return; }
      despeses += m.import;
      perCat[m.categoria] = (perCat[m.categoria] || 0) + m.import;
    });
    const llistaCat = Object.keys(perCat).map(id => {
      const c = CATEGORIES.filter(x => x.id === id)[0] || {};
      return { id, nom: c.nom || id, emoji: '', total: perCat[id],
               pct: despeses ? perCat[id] / despeses * 100 : 0 };
    }).sort((a, b) => b.total - a.total);

    return {
      mes, ingressos, despeses, traspassos, balanc: ingressos - despeses,
      perRevisar: 2, perClassificar: 2,
      pressupostos: [
        { categoria: 'c_alim', nom: 'Alimentació', emoji: '', limit: 400, gastat: perCat.c_alim || 0,
          pct: (perCat.c_alim || 0) / 400 * 100 },
        { categoria: 'c_oci', nom: 'Oci', emoji: '', limit: 100, gastat: 120, pct: 120 }
      ],
      perCategoria: llistaCat,
      ritme: { perDia: despeses / 10, projeccio: despeses * 3 },
      moviments: dins
    };
  };

  /* El patrimoni porta històric, que és el que dibuixa la línia de cada actiu:
     sense, la pantalla no ensenyaria mai aquella part. */
  const finPantalla = (p) => {
    const quin = p.periode || 'mes';
    let dades;
    if (quin === 'mesos') {
      const llista = [5, 4, 3, 2, 1, 0].map(i => ({
        mes: AVUI.slice(0, 4) + '-' + ('0' + (Number(AVUI.slice(5, 7)) - i)).slice(-2),
        ingressos: 2140.55, despeses: 1200 + i * 80, balanc: 940.55 - i * 80 }));
      dades = { mesos: llista, acumulat: llista.reduce((s, m) => s + m.balanc, 0) };
    } else if (quin === 'estad') {
      const ara = finMes(p.mes);
      dades = {
        mes: ara.mes, anterior: AVUI.slice(0, 4) + '-07',
        despeses: ara.despeses, despesesAnterior: 1480.3,
        diferencia: ara.despeses - 1480.3,
        perCategoria: ara.perCategoria.map(c => ({ ...c, anterior: c.total * 0.8,
                                                   diferencia: c.total * 0.2 })),
        perMetode: [{ metode: 'targeta', total: 340.2 }, { metode: 'rebut', total: 620 },
                    { metode: 'efectiu', total: 26.15 }],
        majors: MOVS.filter(m => m.tipus === 'd').sort((a, b) => b.import - a.import).slice(0, 5)
      };
    } else if (quin === 'revisar') {
      dades = {
        comercos: [
          { clau: 'd|estanc', mostra: 'ESTANC NÚMERO 3', tipus: 'd',
            moviments: 12, total: 74.4, primera: menys(40), ultima: menys(2) },
          { clau: 'd|fruiteria', mostra: 'FRUITERIA CAN JOAN', tipus: 'd',
            moviments: 4, total: 61.15, primera: menys(25), ultima: menys(6) },
          { clau: 'i|bizum', mostra: 'BIZUM DE LA MARE', tipus: 'i',
            moviments: 3, total: 120, primera: menys(30), ultima: menys(9) }
        ],
        solts: [
          { id: 'm4', data: menys(2), tipus: 'd', import: 8.4,
            descripcio: 'COMPRA AMB TARGETA', categoria: 'c_altd', categoriaNom: 'Altres despeses' },
          { id: 'm9', data: menys(8), tipus: 'd', import: 4.9,
            descripcio: 'BIZUM REBUT', categoria: 'c_altd', categoriaNom: 'Altres despeses' }
        ],
        totalMoviments: 21,
        categories: CATEGORIES
      };
    } else if (quin === 'recurrents') {
      dades = { llista: [
        { id: 'r1', descripcio: 'Lloguer', import: 620, tipus: 'd', categoria: 'c_casa',
          categoriaNom: 'Casa', metode: 'rebut', dia: 1, actiu: true, ultim_mes: '' },
        { id: 'r2', descripcio: 'Assegurança del cotxe', import: 38.9, tipus: 'd',
          categoria: 'c_cotx', categoriaNom: 'Cotxe i benzina', metode: 'rebut', dia: 15,
          actiu: true, clau: 'd|SEGUROS CATALANA OCC', ultim_mes: '' },
        { id: 'r3', descripcio: 'Spotify', import: 10.99, tipus: 'd',
          categoria: 'c_oci', categoriaNom: 'Oci', metode: 'targeta', dia: 4,
          actiu: true, clau: 'd|SPOTIFY AB', ultim_mes: '' }
      ],
      /* El vigilant amb els dos casos alhora: un que no ha arribat i un que ha
         pujat de preu. Es el motiu pel qual aquesta pantalla existeix, o sigui
         que al mirall hi han de ser tots dos per poder-los mirar. */
      vigilancia: {
        mes: AVUI.slice(0, 7),
        compromes: 669.89, esperat: 0, arribat: 666.2,
        perRecurrent: [
          { id: 'r1', estat: 'arribat', import: 620, data: AVUI.slice(0, 8) + '01' },
          { id: 'r2', estat: 'canviat', import: 46.2, data: AVUI.slice(0, 8) + '15',
            diferencia: 7.3, percentatge: 19 },
          { id: 'r3', estat: 'falta' }
        ],
        falten: [{ id: 'r3', descripcio: 'Spotify', tipus: 'd', import: 10.99,
                   dia: 4, dies: 4 }],
        canviats: [{ id: 'r2', descripcio: 'Assegurança del cotxe', tipus: 'd',
                     abans: 38.9, ara: 46.2, diferencia: 7.3, percentatge: 19,
                     clau: 'd|SEGUROS CATALANA OCC' }],
        llindars: { marge: 3, canvi: 0.05, minim: 1 }
      },
      /* El que JEFE hauria vist als moviments. Inventat, com tot el mirall,
         pero amb els casos que importen: dos que passen el filtre i, a la
         llista de triar, el super que NO el passa. */
      propostes: [
        { clau: 'i|NOMINA EMPRESA INVENTADA', tipus: 'i', descripcio: 'NOMINA EMPRESA INVENTADA',
          import: 1840, minim: 1840, maxim: 1840, variacio: 0, mesos: 6, mesosMirats: 6,
          moviments: 6, perMes: 1, dia: 28, categoria: 'i_nomi', categoriaNom: 'Nomina',
          emoji: '', metode: 'transf' },
        { clau: 'd|SEGUROS CATALANA OCC', tipus: 'd', descripcio: 'SEGUROS CATALANA OCC',
          import: 42.9, minim: 42.9, maxim: 42.9, variacio: 0, mesos: 6, mesosMirats: 6,
          moviments: 6, perMes: 1, dia: 5, categoria: 'c_cotx',
          categoriaNom: 'Cotxe i benzina', emoji: '', metode: 'domic' },
        { clau: 'd|SPOTIFY AB', tipus: 'd', descripcio: 'SPOTIFY AB',
          import: 10.99, minim: 10.99, maxim: 11, variacio: 0, mesos: 5, mesosMirats: 6,
          moviments: 5, perMes: 1, dia: 18, categoria: 'c_oci', categoriaNom: 'Oci',
          emoji: '', metode: 'targeta' }
      ],
      triables: [
        { clau: 'i|NOMINA EMPRESA INVENTADA', tipus: 'i', descripcio: 'NOMINA EMPRESA INVENTADA',
          import: 1840, minim: 1840, maxim: 1840, mesos: 6, mesosMirats: 6, dia: 28,
          categoria: 'i_nomi', metode: 'transf' },
        { clau: 'd|SEGUROS CATALANA OCC', tipus: 'd', descripcio: 'SEGUROS CATALANA OCC',
          import: 42.9, minim: 42.9, maxim: 42.9, mesos: 6, mesosMirats: 6, dia: 5,
          categoria: 'c_cotx', metode: 'domic' },
        { clau: 'd|BONPREU ESCLAT', tipus: 'd', descripcio: 'BONPREU ESCLAT',
          import: 62.15, minim: 18.4, maxim: 96.3, mesos: 6, mesosMirats: 6, dia: 12,
          categoria: 'c_alim', metode: 'targeta' },
        { clau: 'd|SPOTIFY AB', tipus: 'd', descripcio: 'SPOTIFY AB',
          import: 10.99, minim: 10.99, maxim: 11, mesos: 5, mesosMirats: 6, dia: 18,
          categoria: 'c_oci', metode: 'targeta' }
      ] };
    } else if (quin === 'patrimoni') {
      dades = {
        total: 18450.2,
        actius: [
          { id: 'p1', nom: 'Compte corrent', tipus: 'compte', valor: 3450.2,
            data: menys(0), dies: 0, automatic: true,
            historic: [2980, 3120, 2870, 3310, 3205, 3450.2].map((valor, i) => ({ data: menys(150 - i * 30), valor })) },
          { id: 'p2', nom: 'Fons indexat', tipus: 'inversio', valor: 15000,
            data: menys(4), dies: 4, automatic: false,
            historic: [12800, 13400, 13150, 14100, 14620, 15000].map((valor, i) => ({ data: menys(154 - i * 30), valor })) }
        ]
      };
    } else {
      dades = finMes(p.mes);
    }
    return { periode: quin, dades, categories: CATEGORIES,
             banc: { connectat: true, quan: AVUI, fa: 'fa 2 hores', error: '' },
             suggeriments: quin === 'mes'
               ? [{ descripcio: 'SUPERMERCAT DEL POBLE', categoria: 'c_alim', metode: 'targeta', tipus: 'd' }]
               : [] };
  };

  // ------------------------------------------------------------------ inici

  const nucliInici = () => ({
    avui: AVUI,
    moduls: [
      { id: 'finances', nom: 'Finances', icona: 'finances', ordre: 30, teVista: true }
    ],
    targetes: [
      { modul: 'finances', icona: 'finances', etiqueta: 'Balanç del mes', valor: '+486,20 €', urgent: false, accio: 'finances' }
    ],
    ia: { disponible: false }
  });

  return { CATEGORIES, finPantalla, nucliInici };
}
