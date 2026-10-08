/**
 * JEFE — NUCLI · Registre de mòduls
 *
 * CONTRACTE (vegeu MODULS.md per a l'exemple complet):
 *
 *   Un mòdul nou = UN fitxer nou. Res més.
 *
 *   Crea `40_Mod_<Nom>.gs` amb una funció global que es digui `MODUL_<NOM>()`
 *   i que retorni el descriptor. El nucli la troba sola escombrant l'espai
 *   global. No cal registrar-la enlloc, ni tocar cap fitxer del nucli.
 *
 *   Perquè això funcioni el nom ha de complir exactament: MODUL_ + MAJÚSCULES.
 *   `MODUL_HABITS` sí. `modulHabits` o `MODUL_Habits` no.
 */

var _memoModuls = null;

function modulsRegistrats_() {
  if (_memoModuls) return _memoModuls;

  var trobats = [];
  var claus = Object.keys(globalThis);

  for (var i = 0; i < claus.length; i++) {
    var clau = claus[i];
    if (!/^MODUL_[A-Z0-9_]+$/.test(clau)) continue;

    var fabrica = globalThis[clau];
    if (typeof fabrica !== 'function') continue;

    try {
      var m = fabrica();
      if (!m || !m.id) {
        Log.avis('moduls', 'El descriptor de ' + clau + ' no té `id`. Ignorat.');
        continue;
      }
      if (m.actiu === false) continue;
      m.ordre = m.ordre === undefined ? 999 : m.ordre;
      trobats.push(m);
    } catch (err) {
      Log.error('moduls', 'El mòdul ' + clau + ' ha petat en carregar-se: ' + err.message);
    }
  }

  trobats.sort(function (a, b) { return a.ordre - b.ordre; });
  _memoModuls = trobats;
  return trobats;
}

var Moduls = (function () {

  function tots() { return modulsRegistrats_(); }

  function perId(id) {
    var m = modulsRegistrats_();
    for (var i = 0; i < m.length; i++) if (m[i].id === id) return m[i];
    return null;
  }

  /** Sincronitza el full `_Moduls` amb el que hi ha realment carregat. */
  function sincronitzaFull() {
    var m = modulsRegistrats_();
    for (var i = 0; i < m.length; i++) {
      var existent = Dades.un('_Moduls', { id_modul: m[i].id });
      Dades.desa('_Moduls', {
        id_modul: m[i].id,
        nom: m[i].nom || m[i].id,
        icona: m[i].icona || '',
        // Respecta el que jo hagi posat a mà; només posa SI la primera vegada.
        actiu: existent ? existent.actiu : 'SI',
        ordre: m[i].ordre,
        versio_esquema: m[i].versioEsquema || 1,
        actualitzat_el: Utils.ara()
      }, ['id_modul']);
    }
    return m.length;
  }

  /** Mòduls actius segons el full `_Moduls` (permet apagar-ne un sense tocar codi). */
  function actius() {
    var estat = {};
    try {
      var files = Dades.llegeix('_Moduls');
      for (var i = 0; i < files.length; i++) estat[files[i].id_modul] = files[i].actiu;
    } catch (e) { /* abans de la primera instal·lació */ }

    return modulsRegistrats_().filter(function (m) {
      return estat[m.id] === undefined || String(estat[m.id]).toUpperCase() === 'SI';
    });
  }

  /**
   * Targetes de la pantalla d'inici. Un mòdul que peta no tomba la pantalla.
   *
   * CADA TARGETA ES DESA A CASA SEVA. Muntar-les totes vol dir obrir un full
   * per mòdul, i això és el que costava obrir l'app. Desades una per una, la
   * targeta de finances només es torna a muntar quan s'escriu a finances i les
   * altres no se n'assabenten. El mòdul que es declara `volatil` no es desa
   * mai: el que ensenya no surt del seu full i seria mentir.
   */
  function resumInici() {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      if (typeof m[i].resumInici !== 'function') continue;
      try {
        var r = m[i].volatil || typeof Memoria === 'undefined'
          ? m[i].resumInici()
          : Memoria.recorda(m[i].id, 'resumInici',
              (function (mod) { return function () { return mod.resumInici(); }; })(m[i]));
        /* Es pot tocar sense por: quan ve desat, `Memoria` en torna una còpia
           acabada de fer, i el que hi ha guardat no porta el `modul` a dins. */
        /* La icona la declara el modul i la passa el nucli: si la targeta se la
           inventes, cada pantalla que ensenyi modul hauria de saber-se-les totes. */
        if (r) { r.modul = m[i].id; r.icona = m[i].icona || 'modul'; out.push(r); }
      } catch (err) {
        Log.error('moduls.resumInici', 'Mòdul ' + m[i].id + ': ' + err.message);
        out.push({ modul: m[i].id, error: true, etiqueta: m[i].nom, valor: '—' });
      }
    }
    return out;
  }

  /**
   * QUÈ HA PASSAT ENTRE DUES DATES, segons cada mòdul.
   *
   * Existeix per a la revisió setmanal, i és el que fa que la revisió pugui
   * dir xifres de veritat en comptes de prosa. El mòdul que la genera no sap
   * que existeixen ni els hàbits ni el banc: pregunta al nucli i el nucli
   * pregunta a qui sàpiga contestar.
   *
   * És OPCIONAL. Un mòdul que no l'implementi senzillament no surt a la
   * revisió, i no passa res. Un mòdul escrit d'aquí a un any que sí que la
   * implementi hi surt sol, sense tocar la revisió.
   *
   * Retorna [{ modul, titol, linies: ['...'] }].
   */
  function resumPeriode(desde, fins) {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      if (typeof m[i].resumPeriode !== 'function') continue;
      try {
        var r = m[i].resumPeriode(desde, fins);
        if (r && r.linies && r.linies.length) {
          out.push({ modul: m[i].id, titol: r.titol || m[i].nom, linies: r.linies });
        }
      } catch (err) {
        Log.error('moduls.resumPeriode', 'Mòdul ' + m[i].id + ': ' + err.message);
      }
    }
    return out;
  }

  /**
   * QUÈ HI HA D'AQUEST DIA, segons cada mòdul, per ensenyar-ho.
   *
   * És germana de `resumPeriode` però per a un sol dia i pensada per pintar-la,
   * no per resumir-la: cada mòdul torna les seves coses una per una, amb el
   * text que hi ha d'anar. La fa servir la pàgina del dia.
   *
   * És OPCIONAL. Un mòdul que no la implementi no hi surt. Un que es faci
   * d'aquí a un any i sí que la implementi, hi sortirà sol.
   *
   * Retorna [{ modul, titol, urgent, accio, coses: [{ text, menut, fet }] }].
   */
  /**
   * QUÈ VE AQUESTA SETMANA, segons cada mòdul.
   *
   * Germana d'`elDia`, i la diferència no és la mida de la finestra: `elDia`
   * mira ENRERE i cap a ara —què portes fet, què t'has deixat—, i això mira
   * ENDAVANT. La pregunta que respon no és «què he de fer» sinó «quan ho
   * faré», que només es pot contestar veient alhora on hi ha les hores
   * ocupades i què és el que espera.
   *
   * FORMA DE CADA COSA:
   *
   *     { data, text, menut, hora, minuts, urgent, fet, mou }
   *
   *   `data`   el dia on va. **En null, va a la pila**: coses que t'esperen
   *            i no tenen dia. La pila és la meitat de la pantalla, i és a
   *            posta —el que arrossegues no té data justament perquè encara
   *            no has decidit quan.
   *   `minuts` quant ocupa. Només ho sap qui té hores (el calendari), i
   *            serveix per dir quin dia és ple sense comptar res.
   *   `mou`    { accio, params, camp } — que aquesta cosa es pot posar en un
   *            dia. Qui sap com moure's és el mòdul; la pantalla només envia
   *            `params` més `camp: data`. Sense això, la pantalla hauria de
   *            saber què és una tasca de Google, i llavors ja no seria una
   *            pantalla del nucli.
   *
   * És OPCIONAL, com totes. Un mòdul que no la implementi no hi surt.
   *
   * Retorna [{ modul, titol, accio, coses: [...] }].
   */
  function laSetmana(desde, fins) {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      if (typeof m[i].laSetmana !== 'function') continue;
      try {
        var r = m[i].laSetmana(desde, fins);
        if (r && r.coses && r.coses.length) {
          out.push({
            modul: m[i].id,
            titol: r.titol || m[i].nom,
            accio: r.accio || m[i].id,
            coses: r.coses
          });
        }
      } catch (err) {
        Log.error('moduls.laSetmana', 'Mòdul ' + m[i].id + ': ' + err.message);
      }
    }
    return out;
  }

  /**
   * ELS NÚMEROS D'UN MÒDUL, DIA A DIA.
   *
   * Existeix per creuar-los: el pes, els cigarros, les calories, l'ànim i les
   * hores del calendari són sèries de números que fins ara no s'havien mirat
   * mai juntes, i coses com «les setmanes que dorms bé fumes menys» només les
   * pot veure qui té les dues.
   *
   * Un mòdul torna una llista de sèries:
   *
   *     { id, nom, unitat, agrega: 'suma'|'mitjana', familia, dies: {data: n} }
   *
   *   `agrega`  com es passa de dies a setmanes. Els cigarros se SUMEN (set
   *             dies a tres al dia són vint-i-un); el pes es fa la MITJANA
   *             (la suma de set peses no vol dir res).
   *   `familia` dues sèries de la mateixa família no es creuen mai. Que el pes
   *             i la cintura vagin junts no és cap descobriment, i si les
   *             deixes competir s'emporten totes les places de les que sí que
   *             en són.
   *   `dies`    només els dies que tenen dada. Un dia que falta NO és un zero:
   *             no haver-te pesat no vol dir que pesis zero.
   *
   * És OPCIONAL. Un mòdul que no la implementi no es creua amb res.
   *
   * Retorna [{ modul, ...la sèrie }].
   */
  function seriesDiaries(desde, fins) {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      if (typeof m[i].seriesDiaries !== 'function') continue;
      try {
        var l = m[i].seriesDiaries(desde, fins) || [];
        for (var k = 0; k < l.length; k++) {
          var s = l[k];
          if (!s || !s.id || !s.dies) continue;
          out.push({
            modul: m[i].id,
            id: m[i].id + '.' + s.id,
            nom: s.nom || s.id,
            unitat: s.unitat || '',
            agrega: s.agrega === 'suma' ? 'suma' : 'mitjana',
            /* Quants dies apuntats calen perquè una setmana compti. El mòdul
               ho sap i el nucli no: una pesada a la setmana ja és la dada de
               la setmana, però dos dies de menjar apuntats no ho són. */
            minimDies: Number(s.minimDies) || 0,
            familia: m[i].id + '.' + (s.familia || s.id),
            /* Si més val que pugi o que baixi. Sense això no es pot dir «i
               això és bona notícia»; amb això, tampoc es diu —però es pot
               ordenar el que s'ensenya. */
            millorAmunt: s.millorAmunt === undefined ? null : !!s.millorAmunt,
            dies: s.dies
          });
        }
      } catch (err) {
        Log.error('moduls.seriesDiaries', 'Mòdul ' + m[i].id + ': ' + err.message);
      }
    }
    return out;
  }

  /**
   * ELS AVISOS PROGRAMATS DELS MÒDULS.
   *
   * Fins ara els automatismes eren tots del nucli i amb nom fix, i per tant un
   * mòdul nou no podia demanar que se l'avisés a cap hora sense que algú
   * toqués `90_Instalacio.gs`. Això era un forat del nucli, no del mòdul: el
   * contracte diu que afegir un mòdul ha de ser crear un fitxer i prou.
   *
   * Un modul declara:
   *
   *     avisos: [{
   *       id: 'control',
   *       hora: 6,                 // 0-23, hora local
   *       dia: 5,                  // 1=dilluns … 7=diumenge. Omes = cada dia
   *       mira: function () {      // null = avui no hi ha res a dir
   *         return { titol: '…', cos: '…', url: 'seguiment' };
   *       }
   *     }]
   *
   * `instalaTriggers` mira quines hores demana algú i en crea una per hora, ni
   * una més: si cap mòdul demana res, no hi ha cap automatisme de més. Un avís
   * que no toqui avui no arriba ni a preguntar-ho al mòdul.
   *
   * QUÈ VOL DIR `hora` DE VERITAT: dins del quart d'hora abans o després. Apps
   * Script no deixa demanar un minut exacte, i el més estret que hi ha és
   * `nearMinute`. Posar-hi 6 vol dir entre les 5:45 i les 6:15, no a les sis
   * clavades. Si un avís només té sentit a una hora clavada, no el pengis
   * d'aquí.
   */
  function avisos() {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      if (!m[i].avisos || !m[i].avisos.length) continue;
      for (var k = 0; k < m[i].avisos.length; k++) {
        var a = m[i].avisos[k];
        var hora = Number(a.hora);
        if (!(hora >= 0 && hora <= 23)) {
          Log.avis('moduls.avisos', 'Avís de ' + m[i].id + ' sense hora vàlida. Ignorat.');
          continue;
        }
        /* EL DIA POT SER UNA FUNCIÓ, i és un contracte nou que el nucli ofereix
           a tothom. El seguiment en tenia dos, de dies: el `5` escrit aquí i el
           `control.dia` del seu full de pla, i tots dos deien quan toca fer el
           control setmanal. Mentre coincidien no es notava. En Pol el va voler
           moure a diumenge i el que hauria passat és que el full diria diumenge
           i l'avís seguiria picant divendres, sense que cap error ho digués.
           Amb una funció, el mòdul contesta amb el que llegeix del seu full i
           només hi ha un lloc on canviar-ho.

           Es demana AQUÍ i no en crear el trigger perquè es demana a cada
           execució: canviar el dia al full té efecte de seguida, sense tornar a
           instal·lar res. L'hora no pot fer això —el trigger la fixa quan
           neix—, i per això l'hora segueix sent un número. */
        var dia = a.dia;
        if (typeof dia === 'function') {
          try {
            dia = dia();
          } catch (err) {
            /* NO SABER QUIN DIA ÉS NO POT VOLER DIR «CADA DIA».
               `dia: null` vol dir diàriament, i caure-hi per un error seria
               convertir una avaria silenciosa en un avís cada matí a les sis
               fins que algú se n'adonés. Un zero no és cap dia de la setmana
               —van d'1 a 7—, o sigui que aquest avís no picarà, i al registre
               hi queda per què. Perdre'n un de setmanal es recupera; que piqui
               cada dia set dies seguits, no. */
            Log.avis('moduls.avisos', 'Avís de ' + m[i].id + '.' + (a.id || k) +
                     ': no he pogut saber quin dia toca (' + err.message + '). No pica.');
            dia = 0;
          }
        }

        out.push({
          modul: m[i].id,
          id: a.id || (m[i].id + '.' + k),
          hora: hora,
          dia: dia === undefined || dia === null ? null : Number(dia),
          mira: a.mira
        });
      }
    }
    return out;
  }

  function elDia(data) {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      if (typeof m[i].elDia !== 'function') continue;
      try {
        var r = m[i].elDia(data);
        if (r && r.coses && r.coses.length) {
          out.push({
            modul: m[i].id,
            titol: r.titol || m[i].nom,
            urgent: !!r.urgent,
            accio: r.accio || m[i].id,
            coses: r.coses
          });
        }
      } catch (err) {
        Log.error('moduls.elDia', 'Mòdul ' + m[i].id + ': ' + err.message);
      }
    }
    return out;
  }

  var CAU_CONTEXT = 'ia_context_';       // + id del mòdul + dia

  /* Mitja hora, i no cinc minuts.
     Els cinc minuts hi eren per una por concreta: que «avui» es quedés sent
     ahir. Però ara la clau porta el dia a dins, o sigui que a mitjanit el
     tros caduca sol i la por desapareix. La resta del temps, el que fa que
     un tros deixi de valer és que ES DESI alguna cosa d'aquell mòdul, i això
     ja s'atrapa al moment. Caducar cada cinc minuts era pagar tres segons per
     res cada vegada que passaves una estona sense preguntar. */
  var VIDA_CONTEXT = 1800;

  function clauContext_(id) { return CAU_CONTEXT + id + '_' + Utils.avui(); }

  /**
   * Fitxa compacta per a la IA: cada mòdul aporta el seu resum en text curt.
   *
   * ES DESA PER MÒDULS, NO SENCERA. Muntar-la vol dir obrir el full de cada
   * mòdul, i sencera costava tres o quatre segons. Desada d'una peça, marcar
   * un hàbit obligava a tornar a llegir també finances, nutrició i calendari
   * —que no havien canviat— i aquells segons es pagaven a la pregunta
   * següent. Per trossos, marcar un hàbit només fa tornar a llegir hàbits.
   *
   * NO POT QUEDAR MAI ENDARRERIDA: si es desa una dada, el tros del mòdul que
   * la té s'esborra tot seguit (ho fa `Dades.invalida`). Val més tornar-lo a
   * muntar que respondre amb el que hi havia fa un minut, perquè aquí la
   * regla que mana és que JEFE no digui res que no sigui cert ara mateix.
   */
  function contextIA(opcions) {
    var m = actius().filter(function (x) { return typeof x.contextIA === 'function'; });
    var claus = m.map(function (x) { return clauContext_(x.id); });

    var cau = null, desats = {};
    try { cau = CacheService.getScriptCache(); } catch (e) { /* sense cau: seguim */ }
    // Tots els trossos d'una sola anada a la memòria cau, no un per un.
    if (cau && claus.length) { try { desats = cau.getAll(claus) || {}; } catch (e) { desats = {}; } }

    var trossos = [], nous = {};
    for (var i = 0; i < m.length; i++) {
      var clau = clauContext_(m[i].id);
      if (desats[clau] !== undefined && desats[clau] !== null) {
        if (desats[clau]) trossos.push(desats[clau]);
        continue;
      }
      try {
        var t = m[i].contextIA(opcions || {});
        t = t ? String(t) : '';
        nous[clau] = t;
        if (t) trossos.push(t);
      } catch (err) {
        Log.error('moduls.contextIA', 'Mòdul ' + m[i].id + ': ' + err.message);
      }
    }

    if (cau && Object.keys(nous).length) {
      try { cau.putAll(nous, VIDA_CONTEXT); } catch (e) {}
    }
    return trossos.join('\n\n');
  }

  /**
   * Dona el control al mòdul que reclami una tornada externa.
   *
   * Un mòdul que necessiti una autorització de fora declara `reclamaTornada`
   * i `gestionaTornada`. El nucli no sap de quin servei es tracta ni què fa:
   * només pregunta i s'aparta. Retorna la pàgina a ensenyar, o null si aquesta
   * visita no és cap tornada i s'ha d'obrir l'app normal.
   */
  function gestionaTornada(parametres) {
    var p = parametres || {};
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      if (typeof m[i].reclamaTornada !== 'function') continue;
      try {
        if (!m[i].reclamaTornada(p)) continue;
        return m[i].gestionaTornada(p);
      } catch (err) {
        Log.error('moduls.tornada', 'Mòdul ' + m[i].id + ': ' + err.message);
        return HtmlService.createHtmlOutput(
          '<div style="font:16px/1.6 system-ui;padding:40px">' +
          '<h2>No ha anat bé</h2><pre style="white-space:pre-wrap">' +
          String(err.message) + '</pre></div>');
      }
    }
    return null;
  }

  /**
   * Esborra el tros de fitxa que aquest full pot haver canviat, i només aquell.
   * La crida `Dades.invalida` a cada escriptura. Sense nom de full, tots.
   */
  function invalidaContext(full) {
    var m = actius().filter(function (x) { return typeof x.contextIA === 'function'; });
    var fora = [];

    for (var i = 0; i < m.length; i++) {
      if (!full || teFull_(m[i], full)) fora.push(clauContext_(m[i].id));
    }
    /* Un full que no és de ningú —o cap nom— pot haver canviat qualsevol cosa:
       es tomben tots. Val més tornar-los a muntar que mentir. */
    if (full && !fora.length && !deQui_(full)) {
      fora = m.map(function (x) { return clauContext_(x.id); });
    }

    if (!fora.length) return;
    try { CacheService.getScriptCache().removeAll(fora); } catch (e) {}
  }

  function teFull_(modul, nom) {
    var f = modul.fulls || [];
    for (var i = 0; i < f.length; i++) if (f[i].nom === nom) return true;
    return false;
  }

  function deQui_(nom) {
    var m = actius();
    for (var i = 0; i < m.length; i++) if (teFull_(m[i], nom)) return m[i];
    return null;
  }

  /**
   * Aquest full pot canviar la fitxa que llegeix la IA?
   *
   * Sí si el declara un mòdul que aporta `contextIA`. Un full que no és de
   * ningú —els del nucli, com la configuració— compta que sí: davant del
   * dubte val més tornar a muntar la fitxa que respondre amb el que hi havia.
   */
  /* Els fulls del nucli que no expliquen res d'en Pol. S'hi escriu sovint
     —a `_Dispositius` cada cop que obre l'app— i cap d'ells canvia una sola
     línia de la fitxa. `_Config` no hi és a posta: allà hi ha els objectius,
     i canviar-ne un sí que canvia el que la IA ha de saber. */
  var FULLS_MUTS = { _Registre: 1, _RegistreArxiu: 1, _Dispositius: 1, _Moduls: 1 };

  function alimentaContext(nom) {
    if (FULLS_MUTS[nom]) return false;
    var seu = deQui_(nom);
    if (!seu) return true;                                   // de ningú: davant del dubte, sí
    return typeof seu.contextIA === 'function';
  }

  /** Eines que la IA pot cridar, aportades pels mòduls. */
  function einesIA() {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      var e = m[i].einesIA || [];
      for (var j = 0; j < e.length; j++) {
        var eina = e[j];
        eina._modul = m[i].id;
        out.push(eina);
      }
    }
    return out;
  }

  /**
   * DRECERES: ordres que NO han de passar per la IA.
   *
   * «Ensenya'm la pàgina del dia» no és una pregunta, és un botó dit amb la
   * boca. Fer-la passar pel model vol dir muntar la fitxa, esperar el model,
   * que decideixi que ja té la resposta a la fitxa i te la reciti en comptes
   * d'obrir res: vint-i-cinc segons per acabar no obrint la pantalla.
   *
   * Un mòdul declara quines frases obren quina vista i el client hi va tot
   * sol, sense tocar el servidor. El nucli no sap què vol dir cap frase: només
   * les reparteix.
   */
  function dreceres() {
    var out = [];
    var m = actius();
    for (var i = 0; i < m.length; i++) {
      var d = m[i].dreceres || [];
      for (var j = 0; j < d.length; j++) {
        if (!d[j] || !d[j].vista || !(d[j].frases || []).length) continue;
        out.push({ vista: d[j].vista, frases: d[j].frases, params: d[j].params || null });
      }
    }
    return out;
  }

  /**
   * Quina drecera diu aquest text, si en diu cap.
   *
   * La fa servir la veu: un cop transcrit «obre'm la pàgina del dia» ja no cal
   * preguntar-li res a ningú, i ens estalviem la crida cara i els seus segons.
   * El client fa el mateix amb el que escrius, i per això aquesta comparació
   * ha de ser idèntica a la seva.
   */
  function drecera(text) {
    var net = Utils.aixafa(text);
    if (!net) return null;
    var l = dreceres();
    for (var i = 0; i < l.length; i++) {
      for (var j = 0; j < l[i].frases.length; j++) {
        if (net.indexOf(l[i].frases[j]) !== -1) return l[i];
      }
    }
    return null;
  }

  /** Metadades per a la interfície (sense funcions, serialitzable). */
  function perAlClient() {
    return actius().map(function (m) {
      return {
        id: m.id,
        nom: m.nom || m.id,
        icona: m.icona || '',
        ordre: m.ordre,
        /* SECUNDARI: no és per a ell, és per a l'app.
           La memòria i les relacions són eines de dins —què sap de tu i què
           ha vist creuant dades—: hi entra molt de tant en tant i no han
           d'ocupar un lloc a la graella principal, al costat dels hàbits o
           les finances, que són on va cada dia. La pàgina principal els posa
           en una icona al marge.
           Ho declara el mòdul i no la pantalla, perquè si demà en neix un
           altre d'aquesta mena s'ha de poder col·locar sol. */
        secundari: !!m.secundari,
        teVista: !!m.vista
      };
    });
  }

  return {
    tots: tots,
    perId: perId,
    actius: actius,
    sincronitzaFull: sincronitzaFull,
    resumInici: resumInici,
    resumPeriode: resumPeriode,
    laSetmana: laSetmana,
    seriesDiaries: seriesDiaries,
    elDia: elDia,
    avisos: avisos,
    contextIA: contextIA,
    invalidaContext: invalidaContext,
    alimentaContext: alimentaContext,
    deQui: deQui_,
    gestionaTornada: gestionaTornada,
    einesIA: einesIA,
    dreceres: dreceres,
    drecera: drecera,
    perAlClient: perAlClient
  };
})();
