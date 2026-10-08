/**
 * JEFE — les dades inventades del mirall
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

  // ------------------------------------------------------------------ hàbits

  const HABITS = [
    { id: 'h1', nom: 'Estirar-se', tipus: 'si_no', objectiu: 1, valor: 1, ratxa: 12, pct30: 82 },
    { id: 'h2', nom: 'Rentar-se les dents', tipus: 'quantitat', objectiu: 2, valor: 1, ratxa: 3, pct30: 61 },
    { id: 'h3', nom: 'Sortir a caminar una estona llarga', tipus: 'si_no', objectiu: 1, valor: 0, ratxa: 0, pct30: 24 },
    { id: 'h4', nom: 'Llegir', tipus: 'si_no', objectiu: 1, valor: 1, ratxa: 41, pct30: 95 },
    { id: 'h5', nom: 'Aigua', tipus: 'quantitat', objectiu: 8, valor: 5, ratxa: 2, pct30: 47, unitat: 'gots' },
    { id: 'h6', nom: 'Cigarros', tipus: 'comptador', objectiu: 0, valor: 7, unitat: 'cigarros',
      esComptador: true, mitjana7: 5.3, canvi7: -1.2, total30: 148 },
    { id: 'h7', nom: 'Idiomes', tipus: 'si_no', objectiu: 1, valor: 0, ratxa: 0, pct30: 8 },
    { id: 'h8', nom: 'Diari de camp', tipus: 'si_no', objectiu: 1, valor: 1, ratxa: 7, pct30: 71 },
    { id: 'h10', nom: '10.000 passes', tipus: 'si_no', objectiu: 1, valor: 0, ratxa: 0, pct30: 55 },
    { id: 'h9', nom: 'No mirar el mòbil al llit', tipus: 'si_no', objectiu: 1, valor: 0, ratxa: 0, pct30: 33 }
  ];

  const habitsDia = (data) => ({
    data, esAvui: data === AVUI, esFutur: false, diaSetmana: 3,
    habits: HABITS.map(h => ({
      id: h.id, nom: h.nom, tipus: h.tipus, objectiu: h.objectiu || 1,
      unitat: h.unitat || '', frequencia: 'diaria',
      valor: h.valor, registrat: h.valor !== null && h.valor !== undefined,
      complert: h.esComptador ? false : (h.valor || 0) >= (h.objectiu || 1),
      exigit: !h.esComptador, existiaEncara: true,
      ratxa: h.ratxa || 0, ratxaMax: (h.ratxa || 0) + 4, unitatRatxa: 'dies',
      pct30: h.esComptador ? null : h.pct30, pct7: h.esComptador ? null : h.pct30,
      esComptador: h.esComptador, mitjana7: h.mitjana7, canvi7: h.canvi7, total30: h.total30
    }))
  });

  const habitsMes = () => {
    const calendari = [];
    for (let i = 29; i >= 0; i--) calendari.push(menys(i));
    /* Els comptadors, per dibuixar-ne la corba. Inventats i irregulars a
       posta: amb una sèrie plana, un gràfic sempre queda bé. */
    const comptadors = HABITS.filter((h) => h.esComptador).map((h) => {
      const dies = [];
      for (let i = 89; i >= 0; i--) {
        const base = 9 - Math.floor((89 - i) / 30) * 1.5;
        const v = Math.max(0, Math.round(base + 3 * Math.sin(i / 2.3) + ((i * 7) % 5) - 2));
        dies.push({ data: menys(i), valor: i === 0 ? h.valor : v });
      }
      const perMes = {};
      dies.forEach((d) => { const m = d.data.slice(0, 7); perMes[m] = (perMes[m] || 0) + d.valor; });
      return { id: h.id, nom: h.nom, unitat: h.unitat || '', dies,
               mesos: Object.keys(perMes).sort().map((m) => ({ mes: m, total: perMes[m] })) };
    });

    return {
      desde: calendari[0], fins: calendari[29], avui: AVUI, calendari, comptadors,
      habits: HABITS.filter(h => !h.esComptador).map((h, n) => ({
        id: h.id, nom: h.nom, pct30: h.pct30, ratxa: h.ratxa || 0, unitatRatxa: 'dies',
        celles: calendari.map((d, i) => {
          const fet = ((i * 7 + n * 3) % 10) < (h.pct30 / 10);
          return { data: d, estat: fet ? 'fet' : 'nofet', altitud: fet ? 1 : 0 };
        })
      }))
    };
  };

  const habitsHistoric = (id) => {
    const h = HABITS.filter(x => x.id === id)[0] || HABITS[0];
    const calendari = [];
    for (let i = 34; i >= 0; i--) {
      const v = h.esComptador ? Math.max(0, Math.round(5 + 4 * Math.sin(i / 3)))
                              : (((i * 5) % 7) < 4 ? (h.objectiu || 1) : 0);
      calendari.push({ data: menys(i), valor: v, registrat: true,
                       complert: h.esComptador ? false : v >= (h.objectiu || 1),
                       exigit: !h.esComptador, existia: true });
    }
    return {
      habit: { id: h.id, nom: h.nom, tipus: h.tipus, objectiu: h.objectiu || 1,
               unitat: h.unitat || '', frequencia: 'diaria', dies_setmana: '',
               objectiu_setmanal: '', creat_el: menys(120) },
      estadistiques: h.esComptador
        ? { esComptador: true, unitatRatxa: 'dies', ratxa: 0, ratxaMax: 0, pct30: null, pct7: null,
            avui: h.valor, mitjana7: h.mitjana7, mitjana7Previa: 6.5, canvi7: h.canvi7,
            total7: 37, total30: h.total30, maxim30: 11, diesRegistrats: 30 }
        : { unitatRatxa: 'dies', pct30: h.pct30, pct7: h.pct30,
            ratxa: h.ratxa || 0, ratxaMax: (h.ratxa || 0) + 4 },
      calendari
    };
  };

  // --------------------------------------------------------------- nutrició

  const ALIMENTS = [
    { id: 'a1', nom: 'Tonyina al natural', kcal100: 116, prot100: 25.5 },
    { id: 'a2', nom: 'Arròs bullit', kcal100: 130, prot100: 2.7 },
    { id: 'a3', nom: 'Iogurt natural sense sucre', kcal100: 61, prot100: 3.5 },
    { id: 'a4', nom: 'Pit de pollastre a la planxa', kcal100: 165, prot100: 31 },
    { id: 'a5', nom: 'Pa integral', kcal100: 247, prot100: 8.5 },
    { id: 'a6', nom: 'Oli d\'oliva', kcal100: 884, prot100: 0 }
  ];

  const item = (id, nom, grams, kcal100, prot100) => ({
    id, nom, grams, kcal100, prot100,
    kcal: grams * kcal100 / 100, prot: grams * prot100 / 100
  });

  const nutriDia = (data) => {
    const apats = [
      { clau: 'dinar', nom: 'Dinar', items: [
        item('i1', 'Arròs bullit', 180, 130, 2.7),
        item('i2', 'Pit de pollastre a la planxa', 150, 165, 31),
        item('i3', 'Oli d\'oliva', 10, 884, 0)
      ] },
      { clau: 'berenar', nom: 'Berenar', items: [
        item('i4', 'Iogurt natural sense sucre', 250, 61, 3.5)
      ] },
      { clau: 'sopar', nom: 'Sopar', items: [
        item('i5', 'Tonyina al natural', 120, 116, 25.5),
        item('i6', 'Pa integral', 60, 247, 8.5)
      ] }
    ].map(a => ({
      ...a,
      kcal: a.items.reduce((s, i) => s + i.kcal, 0),
      proteina: a.items.reduce((s, i) => s + i.prot, 0)
    }));

    const totals = {
      ingerides: apats.reduce((s, a) => s + a.kcal, 0),
      proteina: apats.reduce((s, a) => s + a.proteina, 0)
    };
    const cremades = 2680;
    const net = cremades - totals.ingerides;
    return {
      data, apats, totals,
      activitat: cremades, teActivitat: true, cremades, teCremades: true, net,
      objectius: { deficit: 500, proteina: 140 },
      verdicte: { estat: net >= 500 ? 'deficit_assolit' : 'deficit',
                  text: 'Dèficit de ' + Math.round(net) + ' kcal' +
                        (net >= 500 ? ' — objectiu assolit' : '') }
    };
  };

  const nutriPeriode = (tipus) => {
    const n = tipus === 'setmana' ? 7 : 30;
    const dies = [];
    for (let i = n - 1; i >= 0; i--) {
      const apuntat = i % 5 !== 0;
      const ingerides = apuntat ? 1900 + ((i * 137) % 500) : 0;
      const teCremades = apuntat && i % 7 !== 3;
      const cremades = teCremades ? 2500 + ((i * 91) % 400) : null;
      dies.push({ data: menys(i), ingerides, proteina: apuntat ? 110 + ((i * 13) % 60) : 0,
                  cremades, net: teCremades ? cremades - ingerides : null, apuntat });
    }
    const amb = dies.filter(d => d.net !== null);
    const ap = dies.filter(d => d.apuntat);
    const suma = (a, c) => a.reduce((s, f) => s + (f[c] || 0), 0);
    return {
      tipus, data: AVUI, desde: dies[0].data, fins: dies[dies.length - 1].data, dies,
      diesApuntats: ap.length, diesAmbBalanc: amb.length,
      mitjanaIngerides: ap.length ? suma(ap, 'ingerides') / ap.length : 0,
      mitjanaProteina: ap.length ? suma(ap, 'proteina') / ap.length : 0,
      mitjanaNet: amb.length ? suma(amb, 'net') / amb.length : 0,
      netAcumulat: suma(amb, 'net'),
      objectius: { deficit: 500, proteina: 140 }
    };
  };

  const nutriPantalla = (p) => ({
    periode: p.periode || 'dia',
    dades: (p.periode || 'dia') === 'dia' ? nutriDia(p.data || AVUI) : nutriPeriode(p.periode),
    aliments: (p.periode || 'dia') === 'dia' ? ALIMENTS : [],
    ajustos: { objectiuDeficit: 500, objectiuProteina: 140 }
  });

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
        { clau: 'i|NOMINA ESCOLA VEDRUNA', tipus: 'i', descripcio: 'NOMINA ESCOLA VEDRUNA',
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
        { clau: 'i|NOMINA ESCOLA VEDRUNA', tipus: 'i', descripcio: 'NOMINA ESCOLA VEDRUNA',
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
            data: menys(0), automatic: true, historic: [] },
          { id: 'p2', nom: 'Fons indexat', tipus: 'inversio', valor: 15000,
            data: menys(4), automatic: false, historic: [] }
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

  // ---------------------------------------------------------------- tasques

  /* Les tasques ara són de Google Tasks: el mirall les inventa amb la mateixa
     forma que torna el mòdul —llistes i una caixa per llista—, i els noms de
     les llistes són els tres compartiments que tenia abans com a contextos.
     Inventat, com tot el mirall: cap tasca de debò. */
  const LLISTES_T = [
    { id: 'lst_1', nom: 'Meves tasques', mostra: true,  principal: true,  ordre: 1 },
    { id: 'lst_2', nom: 'Docència',      mostra: true,  principal: false, ordre: 2 },
    { id: 'lst_3', nom: 'Agent rural',   mostra: true,  principal: false, ordre: 3 },
    { id: 'lst_4', nom: 'Casa',          mostra: false, principal: false, ordre: 4 }
  ];

  const T = (id, llista, llistaNom, text, extra) => Object.assign({
    id, llista, llistaNom, text, nota: '', vencEl: '', vencuda: false,
    venAvui: false, prioritat: '', fent: false, feta: false, fetEl: '',
    primerPas: '', passQuan: ''
  }, extra || {});

  const tasquesPantalla = () => {
    const blocs = [
      { id: 'lst_1', nom: 'Meves tasques', tasques: [
        T('t1', 'lst_1', 'Meves tasques', 'Mirar el pressupost de la sortida de tercer'),
        T('t2', 'lst_1', 'Meves tasques', 'Trucar al taller')
      ] },
      { id: 'lst_2', nom: 'Docència', tasques: [
        T('t4', 'lst_2', 'Docència', 'Corregir els controls',
          { vencEl: AVUI, venAvui: true }),
        T('t8', 'lst_2', 'Docència', 'Preparar la reunió de pares', { fent: true })
      ] },
      { id: 'lst_3', nom: 'Agent rural', tasques: [
        T('t3', 'lst_3', 'Agent rural', 'Informe de la batuda de senglar del vessant nord',
          { vencEl: menys(4), vencuda: true, prioritat: 'alta', nota: 'Amb les fotos del GPS.' }),
        T('t5', 'lst_3', 'Agent rural', 'Canviar les rodes del tot terreny',
          { primerPas: 'Trucar al taller i preguntar preu', passQuan: 'demà a l\'hora del pati' })
      ] }
    ];
    const totes = blocs.reduce((l, b) => l.concat(b.tasques), []);
    return {
      avui: AVUI,
      hiHaServei: true,
      hiHaLlistes: true,
      llistes: LLISTES_T.map((l) => Object.assign({}, l)),
      blocs,
      tasques: totes,
      vencudes: totes.filter((t) => t.vencuda).length
    };
  };

  const tasquesFetes = () => ({ fetes: [
    T('t6', 'lst_2', 'Docència', 'Enviar les notes', { feta: true, fetEl: menys(1) }),
    T('t7', 'lst_1', 'Meves tasques', 'Comprar pinso', { feta: true, fetEl: menys(2) })
  ] });

  // ------------------------------------------------------------------ diari

  const diariPantalla = (p) => {
    const data = (p && p.data) || AVUI;
    const linia = [
      { id: 'd1', data: AVUI, tipus: 'entrada', text: 'Matí a la zona del refugi. Molta gent per ser dimarts.\n\nA la tarda, claustre llarg.', anim: 4, origen: 'app' },
      { id: 'd2', data: menys(1), tipus: 'resum', text: '· Hàbits pendents: 2\n· Tasques per fer: 3\n\nEt queden dos hàbits i tres tasques. La de l\'informe ja fa quatre dies que venç.', anim: null, origen: 'auto' },
      { id: 'd3', data: menys(1), tipus: 'entrada', text: 'Dia fluix. No he tingut temps de res.', anim: 2, origen: 'app' },
      { id: 'd4', data: menys(3), tipus: 'revisio', text: 'Setmana del ' + menys(9) + ' al ' + menys(3) + '\n\nHÀBITS\n· Estirar-se: 5 de 7 dies\n· Llegir: 7 de 7 dies\n\nTASQUES\n· 4 fetes i 6 de noves', anim: null, origen: 'auto' }
    ];
    return {
      avui: AVUI, data,
      entrada: data === AVUI ? linia[0] : null,
      linia, quantes: 2, ratxa: 2, iaActiva: false
    };
  };

  // --------------------------------------------------------------- conversa

  const conversaEstat = () => ({
    disponible: false,
    motiu: 'El mirall no té capa d\'IA: aquí no es parla amb ningú.',
    model: 'mirall',
    suggeriments: ['Com he anat aquest mes?', 'Quant porto gastat?', 'Què em queda per fer avui?'],
    consum: { avui: 47, tocat: true, faSegons: 35, esperaSegons: 60, quota: 'GenerateRequestsPerMinutePerProjectPerModel' },
    dreceres: [{ vista: 'dia', frases: ['pagina del dia', 'pagina d avui', 'full del dia', 'dashboard del dia', 'la pagina de avui', 'el dia d avui'] }]
  });

  const conversaHistorial = () => ({
    id_conversa: 'cnv_mirall',
    missatges: [
      { rol: 'user', text: 'Què em queda per fer avui?', creat_el: menys(0) },
      { rol: 'assistant', text: 'Et queden dos hàbits i tres tasques. La de l\'informe de la batuda ja fa quatre dies que venç.', creat_el: menys(0) }
    ]
  });

  // -------------------------------------------------------------- calendari

  const CALENDARIS = [
    { id: 'principal@exemple', nom: 'El meu calendari', color: '#2c6e8f',
      mostra: true, principal: true, meu: true },
    { id: 'escola@exemple', nom: 'Feina · escola', color: '#a8703f',
      mostra: true, principal: false, meu: true },
    // Un d'un altre compte, compartit: es veu, i escriure-hi depèn del permís.
    { id: 'claustre@altrecompte', nom: "Claustre (compte de l'escola)", color: '#8a5124',
      mostra: true, principal: false, meu: false },
    { id: 'festius@exemple', nom: 'Festius de Catalunya', color: '#7fa15c',
      mostra: false, principal: false, meu: false }
  ];

  /* Cites repartides pel mes en curs, amb noms i durades de tot tipus: una de
     tot el dia, una que se solapa, una de molt llarga i uns quants dies buits.
     Els dies plens i els buits alhora són el que fa veure si la graella es
     llegeix. */
  const cites = (mesDemanat) => {
    const m = mesDemanat || AVUI.slice(0, 7);
    const d = (n) => m + '-' + ('0' + n).slice(-2);
    const cru = [
      [d(3), '09:00', '10:30', 'Claustre de mestres', 'Escola', 'escola@exemple'],
      [d(3), '17:00', '18:00', 'Visita al veterinari', 'Sant Joan', 'principal@exemple'],
      [d(7), null, null, 'Sortida de tercer a la Vall de Boí', '', 'escola@exemple'],
      [d(11), '08:00', '14:00', 'Batuda de senglar al vessant nord', 'Coll de Fumanya', 'principal@exemple'],
      [d(11), '19:30', '21:00', 'Sopar amb els de sempre', '', 'principal@exemple'],
      [d(12), '10:00', '10:45', 'Reunió amb la direcció', 'Escola', 'escola@exemple'],
      [d(18), '16:00', '17:00', 'Revisió del cotxe', 'Taller Puig', 'principal@exemple'],
      [d(21), null, null, 'Aniversari de la mare', '', 'principal@exemple'],
      [d(21), '20:00', '23:00', 'Dinar de família', 'Cal Manel', 'principal@exemple'],
      [d(25), '11:00', '12:00', 'Formació d\'agents rurals', 'Solsona', 'principal@exemple'],
      [Number(AVUI.slice(8)) > 1 ? AVUI : d(15), '12:30', '13:15', 'Cita d\'avui, per veure com es marca', '', 'principal@exemple']
    ];
    return cru.map((c, i) => {
      const cal = CALENDARIS.filter(x => x.id === c[5])[0] || CALENDARIS[0];
      const totElDia = !c[1];
      const minuts = totElDia ? 0
        : (Number(c[2].slice(0, 2)) * 60 + Number(c[2].slice(3))) -
          (Number(c[1].slice(0, 2)) * 60 + Number(c[1].slice(3)));
      return { id: 'ev' + i, calendari: cal.id, calendariNom: cal.nom, color: cal.color,
               titol: c[3], lloc: c[4], nota: '', data: c[0], dataFi: c[0],
               totElDia, hora: c[1] || '', horaFi: c[2] || '',
               passat: c[0] < AVUI, minuts };
    });
  };

  /* Data LOCAL. Amb toISOString, a la nit surt el dia d'abans i el mirall
     et fa perseguir un error que no hi és. */
  const localIso = (d) => [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-');
  const dillunsDe = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    const n = (d.getDay() + 6) % 7;          // 0 = dilluns
    d.setDate(d.getDate() - n);
    return localIso(d);
  };
  const suma = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return localIso(d);
  };

  const calendariPantalla = (p) => {
    const m = (p && p.mes) || AVUI.slice(0, 7);
    const events = cites(m);
    const perDia = {};
    events.forEach(e => { (perDia[e.data] = perDia[e.data] || []).push(e); });

    const ultim = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0);
    const inici = dillunsDe(m + '-01');
    const fi = suma(dillunsDe(m + '-' + ('0' + ultim.getDate()).slice(-2)), 6);

    const caselles = [];
    for (let x = inici; x <= fi; x = suma(x, 1)) {
      const seus = perDia[x] || [];
      caselles.push({ data: x, dia: Number(x.slice(8, 10)), delMes: x.slice(0, 7) === m,
                      esAvui: x === AVUI, quants: seus.length,
                      mostra: seus.slice(0, 3).map(e => ({ color: e.color, totElDia: e.totElDia,
                                                          titol: e.titol, hora: e.hora })) });
    }
    const triat = (p && p.data) || (m === AVUI.slice(0, 7) ? AVUI : m + '-01');
    return {
      dades: { mes: m, avui: AVUI, desde: inici, fins: fi, caselles,
               quants: events.length, diaTriat: triat,
               esdeveniments: perDia[triat] || [], tots: events },
      calendaris: CALENDARIS
    };
  };

  // ------------------------------------------------------------ pàgina del dia

  const elDia = (p) => {
    const data = (p && p.data) || AVUI;
    const cites = calendariPantalla({}).dades.tots.filter(e => e.data === data);

    const blocs = [];
    if (cites.length) {
      blocs.push({ modul: 'calendari', titol: 'Al calendari', urgent: false, accio: 'calendari',
        coses: cites.map(e => ({
          text: e.titol,
          menut: (e.totElDia ? 'tot el dia' : e.hora + (e.horaFi ? '–' + e.horaFi : '')) +
                 (e.lloc ? ' · ' + e.lloc : ''),
          fet: e.passat })) });
    }
    blocs.push({ modul: 'tasques', titol: 'Tasques', urgent: true, accio: 'tasques', coses: [
      { text: 'Informe de la batuda de senglar del vessant nord',
        menut: 'fa 4 dies que vencia', urgent: true },
      { text: 'Corregir els controls', menut: 'per avui · Docència' }
    ] });
    blocs.push({ modul: 'habits', titol: 'Hàbits que et falten', urgent: false, accio: 'habits',
      coses: [ { text: 'Rentar-se les dents', menut: '1 de 2' },
               { text: 'Sortir a caminar una estona llarga', menut: '' },
               { text: 'Idiomes', menut: '' } ] });
    blocs.push({ modul: 'nutricio', titol: 'Nutrició', urgent: true, accio: 'nutricio', coses: [
      { text: '1.010 kcal · 95,8 g de proteïna', menut: 'objectiu 140 g' },
      { text: 'Falten les calories cremades', menut: 'sense elles no hi ha balanç', urgent: true }
    ] });
    blocs.push({ modul: 'finances', titol: 'Finances', urgent: false, accio: 'finances', coses: [
      { text: 'Gastat 71,45 € · guanyat 1842,00 €', menut: '4 moviments' },
      { text: 'Nòmina', menut: '+1842,00 € · Feina' },
      { text: 'Supermercat del carrer gran', menut: '−48,20 € · Menjar' },
      { text: 'Benzinera de la carretera', menut: '−18,90 € · Cotxe · per classificar' },
      { text: 'Cafè', menut: '−4,35 € · Sortides' }
    ] });
    blocs.push({ modul: 'diari', titol: 'Diari', urgent: false, accio: 'diari',
      coses: [ { text: 'Escrit', menut: 'Matí a la zona del refugi. Molta gent per ser dimarts.',
                 fet: true } ] });

    return { data, esAvui: data === AVUI, blocs,
             quantes: blocs.reduce((s, b) => s + b.coses.length, 0) };
  };

  // -------------------------------------------------------------- la setmana

  /* Els set dies amb les hores ocupades i la pila del que espera. Es munta
     amb les mateixes cites i les mateixes tasques que la resta del mirall:
     si el calendari inventat diu que dijous hi ha claustre, aquí també.

     LA PILA HI ÉS AMB GRUIX A POSTA. És la meitat de la pantalla i la que té
     la interacció —posar-hi dia—, i una pila de dues coses no ensenya si
     vint files seguides amb el seu botó encara es llegeixen. */
  const laSetmana = (p) => {
    const dl = (() => {
      let d = new Date(AVUI + 'T12:00:00');
      if (p && p.desde) d = new Date(p.desde + 'T12:00:00');
      else if (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 7);
      const cap = (d.getDay() === 0 ? 7 : d.getDay()) - 1;
      d.setDate(d.getDate() - cap);
      return d.toISOString().slice(0, 10);
    })();
    const suma = (t, n) => {
      const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const fins = suma(dl, 6);

    const cites = calendariPantalla({}).dades.tots
      .filter((e) => e.data >= dl && e.data <= fins);
    const tt = tasquesPantalla().tasques;

    const dies = [];
    for (let i = 0; i < 7; i++) {
      const data = suma(dl, i);
      const coses = [];
      cites.filter((e) => e.data === data).forEach((e) => {
        coses.push({ modul: 'calendari', titol: 'Al calendari', accio: 'calendari',
          text: e.titol, hora: e.totElDia ? '' : e.hora,
          menut: e.totElDia ? 'tot el dia'
                            : e.hora + (e.horaFi ? '–' + e.horaFi : '') + (e.lloc ? ' · ' + e.lloc : ''),
          urgent: false, fet: !!e.passat, mou: null });
      });
      tt.filter((t) => t.vencEl === data && !t.vencuda).forEach((t) => {
        coses.push({ modul: 'tasques', titol: 'Tasques', accio: 'tasques',
          text: t.text, hora: '', menut: t.llistaNom,
          urgent: t.prioritat === 'alta', fet: false,
          mou: { accio: 'edita', camp: 'venc_el', params: { id: t.id, llista: t.llista } } });
      });
      const minuts = cites.filter((e) => e.data === data && !e.totElDia)
        .reduce((s, e) => s + (e.minuts || 0), 0);
      dies.push({ data, diaSetmana: i + 1, esAvui: data === AVUI, esPassat: data < AVUI,
                  minuts, coses });
    }

    const pila = [];
    tt.filter((t) => t.vencuda).forEach((t) => {
      pila.push({ modul: 'tasques', titol: 'Tasques', accio: 'tasques',
        text: t.text, hora: '', menut: 'fa 4 dies que vencia', urgent: true, fet: false,
        mou: { accio: 'edita', camp: 'venc_el', params: { id: t.id, llista: t.llista } } });
    });
    [['Mirar el pressupost de la sortida de tercer', 't1', 'lst_1', 'Meves tasques', 22],
     ['Canviar les rodes del tot terreny', 't5', 'lst_3', 'Agent rural', 18],
     ['Trucar al taller', 't2', 'lst_1', 'Meves tasques', 14],
     ['Preparar la reunió de pares', 't8', 'lst_2', 'Docència', 11]
    ].forEach(([text, id, llista, nom, dies_]) => {
      pila.push({ modul: 'tasques', titol: 'Tasques', accio: 'tasques',
        text, hora: '', menut: dies_ + ' dies sense moure\'s · ' + nom,
        urgent: false, fet: false,
        mou: { accio: 'edita', camp: 'venc_el', params: { id, llista } } });
    });

    return {
      desde: dl, fins, avui: AVUI,
      esAquesta: dl <= AVUI && AVUI <= fins,
      dies, pila,
      minutsPle: dies.reduce((m, x) => Math.max(m, x.minuts), 0),
      quantes: dies.reduce((s, x) => s + x.coses.length, 0) + pila.length
    };
  };



  // ------------------------------------------------------------- seguiment
  /* Inventat, com tot el mirall. Les xifres de debò no surten mai d aqui:
     aquest fitxer si que va al repositori public. */
  const segPantalla = () => ({
    avui: AVUI,
    historic: [
      { id: 'seg_1', data: '2026-06-05', pes: 71.4, cintura: 88, cinturaValida: false,
        forca: 1, trail: 2, trailGros: 0, energia: 'normal', son: 'normal', gana: 'normal',
        dieta: 'a mitges', fotos: { frontal: '', perfil: '', esquena: '' }, notes: 'Punt de partida.' },
      { id: 'seg_2', data: '2026-06-12', pes: 70.8, cintura: 84.5, cinturaValida: true,
        forca: 2, trail: 3, trailGros: 1, energia: 'normal', son: 'bé', gana: 'normal',
        dieta: 'bé', fotos: { frontal: 'fals_1f', perfil: 'fals_1p', esquena: '' }, notes: '' },
      { id: 'seg_3', data: '2026-06-19', pes: 69.3, cintura: 83, cinturaValida: true,
        forca: 0, trail: 4, trailGros: 2, energia: 'baixa', son: 'normal', gana: 'molta',
        dieta: 'a mitges', fotos: { frontal: '', perfil: '', esquena: '' }, notes: 'Setmana de molt desnivell.' },
      { id: 'seg_4', data: '2026-06-26', pes: 69.5, cintura: 82.5, cinturaValida: true,
        forca: 2, trail: 3, trailGros: 0, energia: 'normal', son: 'bé', gana: 'normal',
        dieta: 'bé', fotos: { frontal: 'fals_4f', perfil: '', esquena: 'fals_4e' }, notes: '' }
    ],
    pla: {
      'control.dia': '7',
      'pla.resum': 'Dèficit moderat, proteïna alta, trail com a prioritat.',
      'fase.1.desde': '2026-06-01', 'fase.1.nom': 'Base',
      'fase.1.objectiu': 'més magre i en forma aeròbica'
    },
    fase: { desde: '2026-06-01', nom: 'Base', objectiu: 'més magre i en forma aeròbica',
            kcal: 2000, proteina: 150, forca: 2, trail: 3 },
    estat: { avui: AVUI, dia: 7, toca: true, pendent: true, fetAquestaSetmana: false,
             fa: 38, ultim: '2026-06-26' },
    llindars: { perdSana: [0.4, 0.7], perdRapida: 0.8, saltImpossible: 3.0,
                cinturaIncoherent: 2.5, pesEstable: 0.3, forcaMinima: 2, diesTolerats: [5, 10] },
    comEsMesura: {
      pes: 'Matí, en dejú, després del lavabo. Si pots, mitjana de 2-3 dies.',
      cintura: 'Matí, en dejú, dret i relaxat. Expiració normal. Cinta al melic, sense estrènyer.',
      fotos: 'Mateix lloc, mateixa llum, mateixa hora, mateixa roba.'
    },
    /* La carrega de les setmanes que tenen control. La del 19 de juny hi es a
       posta amb desnivell de debo i la del 26 no: aixi es veu que la linia
       apareix quan hi ha dades i desapareix quan no n hi ha. */
    carregues: {
      '2026-06-15': { sessions: 4, trail: 3, forca: 1, km: 18.2, desnivell: 240,
                      kmEsforc: 20.6, llargues: 0 },
      '2026-06-22': null
    }
  });
  // -------------------------------------------------------- entrenaments
  /* Inventat, com tot el mirall. Les setmanes estan fetes a posta perquè es
     vegi la diferencia que en Pol demanava: la del 20 de juliol son quatre
     sortides curtes i planes, la del 27 son tres sortides amb desnivell de
     debo. Amb «sortides: 4» i «sortides: 3» la primera semblava la mes dura;
     amb quilometres d esforc no s hi assemblen. */
  const entSessions = () => ([
    { id: 'ent_1', data: '2026-07-20', mena: 'trail', titol: 'Volta pel canal',
      km: 5.2, desnivell: 40, minuts: 31, kcal: 340, pulsacions: 148, font: 'captura', notes: '' },
    { id: 'ent_2', data: '2026-07-22', mena: 'forca', titol: 'Tren superior',
      km: null, desnivell: null, minuts: 42, kcal: 210, pulsacions: null, font: 'captura', notes: '' },
    { id: 'ent_3', data: '2026-07-23', mena: 'trail', titol: 'Suau de tarda',
      km: 6.1, desnivell: 90, minuts: 38, kcal: 400, pulsacions: 151, font: 'captura', notes: '' },
    { id: 'ent_4', data: '2026-07-25', mena: 'trail', titol: 'Sortida del dissabte',
      km: 8.4, desnivell: 210, minuts: 54, kcal: 560, pulsacions: 155, font: 'captura', notes: '' },
    { id: 'ent_5', data: '2026-07-28', mena: 'trail', titol: 'Sèries a la pujada',
      km: 7.8, desnivell: 480, minuts: 62, kcal: 640, pulsacions: 163, font: 'captura', notes: '' },
    { id: 'ent_6', data: '2026-07-29', mena: 'forca', titol: 'Esquena i espatlles',
      km: null, desnivell: null, minuts: 38, kcal: 190, pulsacions: null, font: 'ma', notes: '' },
    { id: 'ent_7', data: '2026-08-01', mena: 'trail', titol: 'Matinal al Montseny',
      km: 14.6, desnivell: 1120, minuts: 158, kcal: 1420, pulsacions: 149, font: 'captura', notes: '' }
  ]);

  const entSetmana = (dl) => {
    const fins = suma(dl, 6);
    const dins = entSessions().filter((s) => s.data >= dl && s.data <= fins)
      .map((s) => {
        const e = (s.km || s.desnivell)
          ? Math.round(((s.km || 0) + (s.desnivell || 0) / 100) * 10) / 10 : null;
        return Object.assign({}, s, { kmEsforc: e, llarga: e !== null && e >= 12 });
      });
    const sumaCamp = (c) => dins.reduce((t, s) => t + (s[c] || 0), 0);
    const kmE = Math.round(sumaCamp('kmEsforc') * 10) / 10;
    let mesLlarga = null;
    dins.forEach((s) => {
      if (s.kmEsforc !== null && (!mesLlarga || s.kmEsforc > mesLlarga.kmEsforc)) mesLlarga = s;
    });
    return {
      dilluns: dl, fins,
      sessions: dins.length,
      trail: dins.filter((s) => s.mena === 'trail').length,
      forca: dins.filter((s) => s.mena === 'forca').length,
      altres: dins.filter((s) => s.mena === 'altre').length,
      km: Math.round(sumaCamp('km') * 10) / 10,
      desnivell: sumaCamp('desnivell'),
      minuts: sumaCamp('minuts'),
      kmEsforc: kmE,
      llargues: dins.filter((s) => s.llarga).length,
      mesLlarga, llista: dins, dura: kmE >= 60
    };
  };

  const ENT_PASSOS = { '2026-07-20': { dilluns: '2026-07-20', total: 68420, mitjana: 9774, font: 'captura', id: 'pas_1' },
                       '2026-07-27': { dilluns: '2026-07-27', total: 81250, mitjana: 11607, font: 'captura', id: 'pas_2' } };

  const entPantalla = (desde) => {
    const dl = dillunsDe(desde || AVUI);
    const corba = [];
    let cur = dl;
    for (let i = 0; i < 12; i++) {
      const s = entSetmana(cur);
      corba.unshift({ dilluns: cur, kmEsforc: s.kmEsforc, sessions: s.sessions,
                      desnivell: s.desnivell, passos: ENT_PASSOS[cur] ? ENT_PASSOS[cur].total : null });
      cur = suma(cur, -7);
    }
    const ara = entSetmana(dl);
    ara.passos = ENT_PASSOS[dl] || null;
    return { avui: AVUI, dilluns: dl, setmana: ara, corba,
             total: entSessions().length,
             llindars: { llarga: 12, setmanaDura: 60 } };
  };

  // ------------------------------------------------------------------ inici

  /* Les relacions entre dades. Inventades, com tot el mirall, pero amb la
     forma que tindran: unes quantes trobades, unes quantes esperant setmanes,
     i els numeros de quantes s han mirat. */
  const relacions = () => ({
    calculat: true,
    calculatEl: AVUI + 'T04:12:00+02:00',
    desde: menys(182), fins: menys(2),
    series: 17, provades: 96, parelles: 136, minim: 8,
    trobades: [
      { a: 'son', b: 'Cigarros', idA: 'seguiment.son', idB: 'habits.h6',
        modulA: 'seguiment', modulB: 'habits', n: 19, rho: -0.74, p: 0.0003,
        frase: 'Les setmanes de mes son, menys cigarros.' },
      { a: 'hores ocupades', b: 'Cigarros', idA: 'calendari.hores', idB: 'habits.h6',
        modulA: 'calendari', modulB: 'habits', n: 22, rho: 0.68, p: 0.0006,
        frase: 'Les setmanes de mes hores ocupades, tambe de mes cigarros.' },
      { a: 'Llegir', b: 'anim', idA: 'habits.h4', idB: 'diari.anim',
        modulA: 'habits', modulB: 'diari', n: 16, rho: 0.61, p: 0.0121,
        frase: 'Les setmanes de mes llegir, tambe de mes anim.' }
    ],
    curtes: [
      { a: 'proteina', b: 'forca', setmanes: 7 },
      { a: 'deficit', b: 'pes', setmanes: 6 },
      { a: '10.000 passes', b: 'energia', setmanes: 4 },
      { a: 'Idiomes', b: 'anim', setmanes: 3 }
    ]
  });

  /* Focus: dos blocs fets avui i les tasques per triar-ne una. */
  const focusPantalla = () => ({
    avui: AVUI, durades: [10, 25, 50], minutsAvui: 35,
    blocs: [
      { hora: '09:20', minuts: 25, complet: true, tasca: 'Corregir els controls' },
      { hora: '11:05', minuts: 10, complet: false, tasca: '' }
    ],
    tasques: tasquesPantalla().tasques.map((t) => ({
      id: t.id, llista: t.llista, text: t.text, pas: t.primerPas || '', vencuda: t.vencuda
    }))
  });

  const nucliInici = () => ({
    avui: AVUI,
    moduls: [
      { id: 'habits', nom: 'Hàbits', icona: 'habits', ordre: 10, teVista: true },
      { id: 'tasques', nom: 'Tasques', icona: 'tasques', ordre: 15, teVista: true },
      { id: 'nutricio', nom: 'Nutrició', icona: 'nutricio', ordre: 20, teVista: true },
      { id: 'finances', nom: 'Finances', icona: 'finances', ordre: 30, teVista: true },
      { id: 'calendari', nom: 'Calendari', icona: 'calendari', ordre: 5, teVista: true },
      { id: 'seguiment', nom: 'Seguiment FitFat', icona: 'seguiment', ordre: 25, teVista: true },
      { id: 'entrenaments', nom: 'Entrenaments', icona: 'entrenaments', ordre: 26, teVista: true },
      /* Escola hi faltava. No ho havia trencat res: senzillament no s'havia
         afegit mai a la llista, i per això el tauler d'apartats del mirall
         ensenyava vuit botons on l'app en té nou. Justament el tauler és on
         es veuen totes les icones alhora. */
      { id: 'diari', nom: 'Diari', icona: 'diari', ordre: 40, teVista: true },
      { id: 'focus', nom: 'Focus', icona: 'focus', ordre: 18, teVista: true },
      { id: 'relacions', nom: 'Relacions', icona: 'relacions', ordre: 45, teVista: true, secundari: true },
      /* I la memòria hi faltava, com abans hi faltava l'escola. La llista es
         torna a desincronitzar cada cop que neix un mòdul, i des del mirall
         no es nota: senzillament hi ha una porta menys. Ara hi ha una prova
         que compara aquesta llista amb la dels mòduls de debò. */
      { id: 'memoria', nom: 'Memòria', icona: 'llegenda', ordre: 50, teVista: true, secundari: true }
    ],
    targetes: [
      { modul: 'habits', icona: 'habits', etiqueta: 'Hàbits pendents', valor: 4, urgent: true, accio: 'habits' },
      { modul: 'tasques', icona: 'tasques', etiqueta: 'Tasques vençudes', valor: 1, urgent: true, accio: 'tasques' },
      { modul: 'nutricio', icona: 'nutricio', etiqueta: 'Proteïna pendent', valor: '32 g', urgent: true, accio: 'nutricio' },
      { modul: 'finances', icona: 'finances', etiqueta: 'Balanç del mes', valor: '+486,20 €', urgent: false, accio: 'finances' },
      { modul: 'seguiment', icona: 'seguiment', etiqueta: 'Control setmanal', valor: 'fa 3 d', urgent: false, accio: 'seguiment' },
      { modul: 'diari', icona: 'diari', etiqueta: 'Diari escrit', valor: '✓', urgent: false, accio: 'diari' }
    ],
    ia: { disponible: false }
  });

  return { HABITS, habitsDia, habitsMes, habitsHistoric, ALIMENTS, nutriPantalla,
           CALENDARIS, calendariPantalla, elDia, laSetmana,
           CATEGORIES, finPantalla, tasquesPantalla, relacions, focusPantalla, tasquesFetes, diariPantalla,
           conversaEstat, conversaHistorial, nucliInici, segPantalla,
           entPantalla, entSetmana };
}
