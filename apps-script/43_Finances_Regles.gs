/**
 * JEFE — MÒDUL · Finances · classificació dels moviments del banc
 *
 * PORTAT TAL QUAL DE L'APP ANTIGA. Aquestes regles s'han rodat contra quatre
 * mesos de moviments reals: canviar-les «de passada» seria tocar una cosa que
 * funciona sense cap dada que ho justifiqui. Si algun dia s'han de canviar,
 * que sigui mirant els que no ha sabut classificar, no per intuïció.
 *
 * ORDRE DE DECISIÓ, del més fiable al menys:
 *   0. La memòria de comerços (això ho fa `Finances.afegeix`, no aquest fitxer)
 *   1. Traspassos entre comptes propis i Bizum: manen sobre tota la resta
 *   2. El codi de comerç (MCC), que assigna la xarxa de targetes al tipus de
 *      negoci. És el senyal més fiable: no depèn de com s'escrigui el nom.
 *   3. Paraules clau al text. La primera que coincideix guanya.
 *
 * DUES COSES APRESES AMB DADES REALS, i que no s'han de desfer:
 *   · El banc RETALLA els noms a uns 17 caràcters: «ATLANTIDA RESTAUR»,
 *     «MINIMERCAT BON PR». Les regles treballen amb trossos de paraula, mai
 *     amb noms sencers.
 *   · L'ORDRE DE `REGLES` ÉS FUNCIONAL, NO ESTÈTIC. Hi ha un bloc de regles
 *     molt específiques just després de Bizum per als casos on una de genèrica
 *     s'equivocaria. El cas real: «EESS SUPECO VIC D» és una benzinera dins
 *     d'un Supeco; si la regla dels supermercats anés abans, hi cauria pel
 *     «SUPECO». No moguis aquell bloc.
 */
var FinancesRegles = (function () {

  /** Nom de qui cobra (compres) o de qui paga (ingressos). */
  function nom_(b) {
    var n = '';
    if (b.creditor && b.creditor.name) n = b.creditor.name;
    if (!n && b.debtor && b.debtor.name) n = b.debtor.name;
    return String(n || '').replace(/\s+/g, ' ').trim();
  }

  /** El concepte lliure que escriu el banc. */
  function concepte_(b) {
    var ri = b.remittance_information;
    var txt = Array.isArray(ri) ? ri.join(' ') : (ri || '');
    return String(txt).replace(/\s+/g, ' ').trim();
  }

  /**
   * ══════════════════════════════════════════════════════════════════════
   * QUI HI HA A L'ALTRE COSTAT, DE MANERA FIABLE
   * ══════════════════════════════════════════════════════════════════════
   *
   * En Pol ho va veure abans que jo: «en depèn del nom? no es podria mirar
   * d'alguna manera més fiable com el compte bancari procedent? moltes vegades
   * el concepte varia... número de mes o alguna cosa així».
   *
   * Tenia raó i el forat era real. El que es feia servir per saber si dos
   * moviments són el mateix rebut era el text que es MOSTRA, i aquell text
   * canvia: «RECIBO SEGUROS 08 2026» i «RECIBO SEGUROS 09 2026» són el mateix
   * rebut i eren dos comerços diferents. La normalització treia els números
   * llargs —l'any— però no els curts, i el mes es quedava dins de la clau.
   *
   * El banc ja enviava la resposta i no la guardàvem: `creditor_account`, el
   * compte de qui cobra. L'IBAN d'una asseguradora no canvia mai, ni quan
   * canvia el concepte, ni quan canvia l'import, ni quan el banc li retalla el
   * nom d'una altra manera.
   *
   * ES BAIXA PER ESGLAONS perquè no tots els bancs ho envien tot, i el que un
   * banc marca com a opcional un altre no l'envia mai:
   *
   *   1. el compte de l'altre costat (IBAN)  → el bo
   *   2. el nom de qui cobra o qui paga      → estable, però el retallen
   *   3. el text que es mostra               → l'últim recurs, el d'abans
   *
   * Torna també DE QUIN esglaó ve, i això no és decoració: sense saber-ho no
   * es pot dir si aquest banc dona l'IBAN o no, i quedaria com una millora
   * teòrica que potser no s'aplica mai.
   */
  function contrapart(b, esIngres) {
    /* Qui cobra si és una despesa; qui paga si és un ingrés. Al revés
       agafaries el teu propi compte, que és el mateix per a tot. */
    var compte = esIngres ? b.debtor_account : b.creditor_account;
    var part   = esIngres ? b.debtor : b.creditor;

    var id = compte && (compte.identification || compte.iban);
    if (id) {
      var net = String(id).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (net.length >= 8) return { valor: 'ib|' + net, font: 'compte' };
    }

    var n = part && part.name;
    if (n) {
      var nn = clauNom_(String(n));
      if (nn.length >= 3) return { valor: 'nm|' + nn, font: 'nom' };
    }

    return { valor: '', font: 'cap' };
  }

  /* Igual que la del comerç, però treu TAMBÉ els números curts i els mesos.
     Aquí sí que es pot: aquesta clau no és la que fa servir la memòria de
     comerços per recordar categories, o sigui que endurir-la no obliga a
     reaprendre res del que ja sap. */
  function clauNom_(t) {
    return String(t || '')
      .toUpperCase()
      .replace(/[ÀÁÂÄ]/g, 'A').replace(/[ÈÉÊË]/g, 'E').replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÖ]/g, 'O').replace(/[ÙÚÛÜ]/g, 'U').replace(/Ç/g, 'C')
      .replace(/\b(GENER|FEBRER|MARC|ABRIL|MAIG|JUNY|JULIOL|AGOST|SETEMBRE|OCTUBRE|NOVEMBRE|DESEMBRE|ENERO|FEBRERO|MARZO|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/g, ' ')
      .replace(/\d+/g, ' ')                 // tots els números, no només els llargs
      .replace(/[^A-Z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * El que es MOSTRA. El nom del comerç mana, perquè «MERCADONA» s'entén i
   * «COMPRA TARJ 5432 000123» no.
   */
  function descripcio(b) {
    var n = nom_(b), c = concepte_(b);
    var txt = n || c || (b.bank_transaction_code && b.bank_transaction_code.description) || 'Moviment';
    return String(txt).slice(0, 80);
  }

  /**
   * El que es fa servir per CLASSIFICAR: tot el que tinguem, junt.
   * L'error de la primera versió de l'app era classificar només amb el
   * concepte i deixar-se el nom del comerç, que és on els bancs posen
   * «MERCADONA» o «BAR CAL PEP». Mig Mercadona anava a «Altres».
   */
  function textMatch_(b) {
    var bt = b.bank_transaction_code || {};
    return [
      nom_(b), concepte_(b),
      b.additional_information || '',
      bt.description || '', bt.code || '', b.note || ''
    ].join(' ').toUpperCase();
  }

  /* Codis de comerç (ISO 18245). Cobreix la majoria de compres amb targeta. */
  var MCC = {
    5411:'c_alim', 5412:'c_alim', 5422:'c_alim', 5441:'c_alim', 5451:'c_alim',
    5462:'c_alim', 5499:'c_alim', 5311:'c_comp', 5300:'c_alim',
    5811:'c_rest', 5812:'c_rest', 5813:'c_rest', 5814:'c_rest',
    5541:'c_tran', 5542:'c_tran', 5983:'c_tran', 4111:'c_tran', 4112:'c_tran',
    4121:'c_tran', 4131:'c_tran', 4784:'c_tran', 4789:'c_tran', 7523:'c_tran',
    7538:'c_tran', 7542:'c_tran', 5533:'c_tran',
    5912:'c_salut', 8011:'c_salut', 8021:'c_salut', 8031:'c_salut', 8041:'c_salut',
    8042:'c_salut', 8049:'c_salut', 8062:'c_salut', 8071:'c_salut', 8099:'c_salut',
    5975:'c_salut', 5976:'c_salut',
    5611:'c_roba', 5621:'c_roba', 5631:'c_roba', 5641:'c_roba', 5651:'c_roba',
    5661:'c_roba', 5691:'c_roba', 5697:'c_roba', 5698:'c_roba', 5699:'c_roba',
    5931:'c_roba', 5948:'c_roba',
    5732:'c_comp', 5734:'c_comp', 5722:'c_comp', 5719:'c_comp', 5712:'c_comp',
    5200:'c_comp', 5251:'c_comp', 5261:'c_comp', 5211:'c_hab', 5231:'c_hab',
    5999:'c_comp', 5977:'c_comp', 5945:'c_comp', 5947:'c_regal', 5992:'c_regal',
    7832:'c_oci', 7841:'c_oci', 7911:'c_oci', 7922:'c_oci', 7929:'c_oci',
    7932:'c_oci', 7933:'c_oci', 7941:'c_oci', 7991:'c_oci', 7992:'c_oci',
    7993:'c_oci', 7996:'c_oci', 7997:'c_oci', 7998:'c_oci', 7999:'c_oci',
    5940:'c_oci', 5941:'c_oci', 5735:'c_oci', 5942:'c_educ',
    8211:'c_educ', 8220:'c_educ', 8241:'c_educ', 8244:'c_educ', 8249:'c_educ',
    8299:'c_educ', 8351:'c_educ',
    7011:'c_viat', 3000:'c_viat', 4511:'c_viat', 4582:'c_viat', 4722:'c_viat',
    4723:'c_viat', 7012:'c_viat', 7032:'c_viat', 7033:'c_viat',
    4812:'c_subm', 4814:'c_subm', 4816:'c_subm', 4899:'c_subm', 4900:'c_subm',
    5713:'c_hab', 5714:'c_hab', 5718:'c_hab',
    1711:'c_hab', 1731:'c_hab', 1750:'c_hab', 7342:'c_hab', 7349:'c_hab',
    7230:'c_cura', 7297:'c_cura', 7298:'c_cura',
    5815:'c_subs', 5816:'c_subs', 5817:'c_subs', 5818:'c_subs',
    7372:'c_subs',
    6300:'c_asseg', 5960:'c_asseg'
  };

  var REGLES = [
    /* Traspassos entre comptes propis: NO són despesa ni ingrés. */
    { c: 'c_trasp', r: /TRADE ?REPUBLIC|TRADEREPUBLIC|MYINVESTOR|INDEXA|REVOLUT|N26|WISE/i },
    { c: 'i_trasp', r: /TRADE ?REPUBLIC|TRADEREPUBLIC|MYINVESTOR|INDEXA|REVOLUT|N26|WISE/i, ingres: true },

    { c: 'c_bizum', r: /BIZUM/i },
    { c: 'i_bizum', r: /BIZUM/i, ingres: true },

    /* Bloc específic — va ABANS que el genèric a propòsit. No el moguis. */
    { c: 'c_tran',  r: /\bEESS\b|ESTACION ?SERV|ZONA ?DIESEL|00ES\d+RIPOL/i },
    { c: 'c_tran',  r: /\bORA\b ?AYTO|ZONA ?BLAVA|ZONA ?AZUL|\bO\.?R\.?A\.? /i },
    { c: 'c_hab',   r: /PINTUR|SUMINISTRES|SUBMINISTRES|FERRETER/i },
    { c: 'c_asseg', r: /CUOTA ?MENSUAL.*CLIENTE|CUOTA ?MENSUAL.*\d{8}/i },
    { c: 'c_rest',  r: /DINARS ?[a-z]{3}-\d\d|MENJADOR/i },
    { c: 'i_nom',   r: /CENTRE ?DOCENT|VEDRUNA|PAG\. ?DEL\. ?DEL/i, ingres: true },

    { c: 'i_nom',   r: /NOMINA|NÓMINA|NÒMINA|SALARI|SALARIO|SUELDO|HABER|PAYROLL/i, ingres: true },
    { c: 'i_dev',   r: /DEVOLUC|ABONO|REEMBOLS|REINTEGR|HACIENDA|HISENDA|AEAT|SEG(URIDAD| SOCIAL)|PARO|SEPE|BECA/i, ingres: true },

    /* «BON PREU» amb espai: el banc l'escriu «BON PREU, S.A.U.». */
    { c: 'c_alim',  r: /MERCADONA|BON ?PREU|MINIMERCAT|ESCLAT|CONSUM|LIDL|ALDI|CARREFOUR|SUPECO|DIA ?%?|CAPRABO|CONDIS|SORLI|SUPERCOR|ALCAMPO|EROSKI|AHORRAMAS|FROIZ|GADIS|CORP ?ALIM|GUISSON|BON ?AREA|BONÀREA|MAXI ?CASA|SUPER ?ELS ?MASOS|SUPER ?MASOS|HYPER ?RIU|RIU ?RUNER|SUPERMERC|SUPER |SUPERM\b|HIPERMERC|FRUITER|FRUTER|CARNISS|CARNIC|PEIXOS|PEIXATER|PESCADER|FORN |PANADER|PASTISS|PASTELER|CELLER|BODEGA|ULTRAMARINOS|CASH ?& ?CARRY|COVIRAN|SPAR|BM SUPER/i },

    { c: 'c_rest',  r: /RESTAURA|CAFETER|CAFÉ|CAFE |COFFEE|BAR |BAR\b|TAVERNA|TABERNA|CERVECER|BRASERI|GRILL|PIZZ|BURGER|HAMBURG|MCDONAL|KFC|TELEPIZZA|DOMINO|GOIKO|VIPS|RODILLA|100 ?MONTADITOS|STARBUCKS|GLOVO|UBER ?EATS|JUST ?EAT|DELIVEROO|SUSHI|KEBAB|TAPES|TAPAS|MENJADOR|GELATER|HELADER|XURRER|CHURRER|VERMUT|GASTROBAR|FOODTRUCK|TAGLIATELLA|CASINO|CENTRE ?CIVIC|CENTRE ?CÍVIC|COOPE|ATLANTIDA|CAPUTXI|EL ?RACO|EL ?RACÓ|EL ?TUT|ALTERNATIVA|NOU ?PAMPLONA|GIRONA ?FUT/i },

    { c: 'c_tran',  r: /GASOLIN|CARBURANT|CARBURANTE|ESTACION ?DE ?SERVICIO|REPSOL|CEPSA|GALP|SHELL|PETRONOR|BP ?\b|PLENOIL|BALLENOIL|RENFE|FGC|RODALIES|CERCANIAS|TMB|METRO |AUTOBUS|ALSA|BUS\b|PARKING|APARCAM|SABA |EMPARK|TAXI|UBER\b|CABIFY|BOLT\b|FREE ?NOW|PEATGE|PEAJE|AUTOPIST|ABERTIS|ITV\b|TALLER|NEUMATIC|PNEUMATIC|MIDAS|NORAUTO|FEUVERT|BICING|CARSHARING|ELECTROLIN/i },

    { c: 'c_subm',  r: /ENDESA|IBERDROLA|NATURGY|REPSOL ?LUZ|TOTALENERGIES|HOLALUZ|SOM ?ENERGIA|AUDAX|PLENITUDE|AIGUA|AIGÜES|AGUAS|SOREA|CANAL ?ISABEL|EMASESA|GAS ?NATURAL|NEDGIA|MOVISTAR|VODAFONE|ORANGE|MASMOVIL|MÁSMÓVIL|JAZZTEL|YOIGO|PEPEPHONE|DIGI\b|LOWI|O2\b|SIMYO|PARLEM|ADAMO|AVATEL|FIBRA/i },

    { c: 'c_hab',   r: /LLOGUER|ALQUILER|ARRENDAMENT|HIPOTECA|PRESTAMO ?HIPOTEC|COMUNIDAD ?DE ?PROP|COMUNITAT ?DE ?PROP|ADMINISTRACION ?DE ?FINCAS|IBI\b|TAXA ?ESCOMBRARIES|BASURAS|LEROY ?MERLIN|BRICO ?DEPOT|BAUHAUS|IKEA|CONFORAMA|MAISONS ?DU ?MONDE|FERRETER|AKI\b|OBRAMAT/i },

    { c: 'c_salut', r: /FARMAC|FARMÀC|FARMÁC|PARAFARM|DENTAL|DENTIST|ODONTO|CLINIC|CLÍNIC|CLÍNIQ|HOSPITAL|CENTRE ?MEDIC|CENTRO ?MEDICO|OPTICA|ÒPTICA|ÓPTICA|AUDIOLOG|SANITAS|ADESLAS|DKV|ASISA|MAPFRE ?SALUD|FISIOTERAP|PODOLOG|PSICOLOG|PSIQUIATR|VETERINAR|ANALISIS ?CLINIC/i },

    { c: 'c_cura',  r: /PERRUQUER|PELUQUER|BARBER|ESTETIC|ESTÈTIC|ESTÉTIC|SPA\b|MASSATG|MASAJE|MANICUR|DEPILAC|PRIMOR|DOUGLAS|SEPHORA|BODY ?SHOP|RITUALS|YVES ?ROCHER|JUTECA/i },

    { c: 'c_subs',  r: /NETFLIX|SPOTIFY|HBO|MAX\b|DISNEY|PRIME ?VIDEO|AMAZON ?PRIME|FILMIN|MOVISTAR\+|DAZN|APPLE\.COM|ITUNES|ICLOUD|APPLE ?ONE|GOOGLE ?\*|GOOGLE ?ONE|YOUTUBE|MICROSOFT|OFFICE ?365|ADOBE|DROPBOX|OPENAI|ANTHROPIC|CHATGPT|CLAUDE|CANVA|NOTION|LINKEDIN|DUOLINGO|AUDIBLE|STORYTEL|NINTENDO|PLAYSTATION|XBOX|STEAM|EPIC ?GAMES|PATREON|SUSCRIPCION|SUBSCRIPCIO/i },

    { c: 'c_oci',   r: /CINE|CINEMA|CINESA|YELMO|OCINE|TEATR|MUSEU|MUSEO|CONCERT|TICKETMASTER|ENTRADAS|ATRAPALO|FEVER\b|GIMNAS|GIMNÀS|GYM\b|BASIC ?FIT|DIR\b|CLAROR|DUET|SYNERGY|ANYTIME ?FITNESS|PISCINA|PADEL|PÀDEL|BOWLING|ESCAPE ?ROOM|DISCOTEC|PARC ?ATRACC|PORT ?AVENTURA|TIBIDABO|ZOO\b|AQUARIUM|LOTERIA|LOTERIES|APOST|PIROTECN|PIROTÈCN|PIROSPUTNICK|FOCS ?ARTIFIC/i },

    { c: 'c_roba',  r: /ZARA|MASSIMO ?DUTTI|BERSHKA|STRADIVARIUS|PULL ?& ?BEAR|OYSHO|LEFTIES|H ?& ?M|H&M|MANGO|PRIMARK|SPRINGFIELD|WOMEN ?SECRET|CORTEFIEL|DECATHLON|NIKE|ADIDAS|FOOT ?LOCKER|JD ?SPORTS|SNIPES|SABATER|ZAPATER|CALZEDONIA|INTIMISSIMI|TEZENIS|C ?& ?A|KIABI|UNIQLO|BIMBA ?Y ?LOLA|PARFOIS|MISAKO/i },

    { c: 'c_comp',  r: /AMAZON|AMZN|ALIEXPRESS|EL ?CORTE ?INGLES|EL ?CORTE ?INGLÉS|FNAC|MEDIAMARKT|MEDIA ?MARKT|PCCOMPONENT|WORTEN|CARREFOUR ?ONLINE|SHEIN|TEMU|WALLAPOP|EBAY|ETSY|MILAR|TIEN ?21|NORMAL\b|ACTION\b|FLYING ?TIGER|CASA ?VIVA|BAZAR/i },

    { c: 'c_educ',  r: /LLIBRER|LIBRER|ABACUS|CASA ?DEL ?LLIBRE|ESCOLA|ESCUELA|COL·?LEGI|COLEGIO|INSTITUT|UNIVERSITAT|UNIVERSIDAD|UOC\b|UNED\b|ACADEMIA|ACADÈMIA|MATRICUL|CURS |CURSO |FORMACIO|FORMACIÓN|UDEMY|COURSERA|PLATZI|CAMBRIDGE|ESCOLA ?OFICIAL|EOI\b|AMPA|AFA\b/i },

    { c: 'c_viat',  r: /BOOKING|AIRBNB|EXPEDIA|TRIVAGO|EDREAMS|KIWI\.COM|SKYSCANNER|RYANAIR|VUELING|IBERIA|AIR ?EUROPA|LEVEL\b|EASYJET|WIZZ|LUFTHANSA|TRANSAVIA|HOTEL|HOSTAL|HOSTEL|PARADOR|CAMPING|BALEARIA|TRASMEDITERRANEA|AVIS\b|HERTZ|EUROPCAR|SIXT\b|RENTAL ?CAR/i },

    { c: 'c_asseg', r: /SEGURO|ASSEGURAN|MAPFRE|ALLIANZ|AXA\b|ZURICH|LINEA ?DIRECTA|MUTUA|CATALANA ?OCCIDENT|GENERALI|REALE\b|PELAYO|VERTI|BALUMBA|PRIMA ?SEGURO/i },
    { c: 'c_banc',  r: /COMISION|COMISSIO|COMISSIÓ|MANTENIMIENTO ?CUENTA|MANTENIMENT|INTERES|INTERÈS|DESCUBIERTO|CUOTA ?TARJETA|CUOTA ?ANUAL/i },

    { c: 'c_regal', r: /FLORISTER|FLORER|JOIER|JOYER|TIFFANY|PANDORA|REGAL|REGALO|CRUZ ?ROJA|CREU ?ROJA|UNICEF|GREENPEACE|MEDICOS ?SIN|METGES ?SENSE|OXFAM|INTERMON|CARITAS|DONATIU|DONACION/i },

    { c: 'c_efec',  r: /REINTEGRO ?CAJERO|RETIRADA ?EFECTIVO|DISPOSICION ?EFECTIVO|CAJERO ?AUTOMATICO|CAIXER ?AUTOMATIC/i }
  ];

  var MANEN = { c_trasp: true, i_trasp: true, c_bizum: true, i_bizum: true };

  function categoria(b, esIngres) {
    var txt = textMatch_(b);

    // 1 — traspassos i Bizum manen sobre tota la resta
    for (var i = 0; i < REGLES.length; i++) {
      var g = REGLES[i];
      if (!MANEN[g.c]) continue;
      if (!!g.ingres !== !!esIngres) continue;
      if (g.r.test(txt)) return g.c;
    }

    // 2 — codi de comerç
    if (!esIngres) {
      var mcc = parseInt(b.merchant_category_code, 10);
      if (mcc && MCC[mcc]) return MCC[mcc];
    }

    // 3 — paraules clau
    for (var j = 0; j < REGLES.length; j++) {
      var k = REGLES[j];
      if (!!k.ingres !== !!esIngres) continue;
      if (k.r.test(txt)) return k.c;
    }

    return esIngres ? 'i_alti' : 'c_altd';
  }

  function metode(b, esIngres) {
    var txt = textMatch_(b);
    if (/CAJERO|REINTEGRO|EFECTIVO|EFECTIU|CAIXER|ATM\b|CASH ?WITHDRAW/.test(txt)) return 'efectiu';
    if (/RECIBO|REBUT|ADEUDO|DOMICILI|CARGO ?PERIODIC|CARREC ?PERIODIC|DIRECT ?DEBIT|SEPA ?DD|\bDD\b/.test(txt)) return 'domic';
    if (/BIZUM|TRANSFEREN|TRANSFERÈNC|TRASPAS|TRASPÀS|CREDIT ?TRANSFER|SEPA ?CT|INGRESO|ABONO/.test(txt)) return 'transf';
    if (/COMPRA ?INTERNET|COMERCIO ?ELECTRONIC|E-?COMMERCE|ONLINE|PAYPAL|AMZN|AMAZON|ALIEXPRESS|SHEIN|TEMU/.test(txt)) return 'online';
    if (/COMPRA|TARJ|TARGETA|CARD ?PAYMENT|POS\b/.test(txt)) return 'targeta';
    return esIngres ? 'transf' : 'targeta';
  }

  return { descripcio: descripcio, categoria: categoria, metode: metode,
           contrapart: contrapart, clauNom: clauNom_ };
})();
