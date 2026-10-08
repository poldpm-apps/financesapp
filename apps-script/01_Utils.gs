/**
 * JEFE — NUCLI · Utilitats
 *
 * REGLA DE DATES (val per a tot el sistema):
 *   - Les dates de calendari es desen com a TEXT 'AAAA-MM-DD'.
 *     Si es desessin com a tipus data de Sheets, la zona horària del
 *     dispositiu les podria desplaçar un dia i trencaria les ratxes.
 *   - Les marques de temps es desen en ISO 8601 amb zona: '2026-07-30T21:14:02+02:00'.
 */

var Utils = (function () {

  function tz() {
    try { return Config.zonaHoraria(); } catch (e) { return 'Europe/Madrid'; }
  }

  /** Identificador únic i llegible: 'tsk_ln4k2x_a7f' */
  function nouId(prefix) {
    var temps = Date.now().toString(36);
    var atzar = Math.random().toString(36).slice(2, 5);
    return (prefix || 'id') + '_' + temps + '_' + atzar;
  }

  /** Marca de temps actual en ISO 8601 amb zona. */
  function ara() {
    return Utilities.formatDate(new Date(), tz(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  /** Data d'avui com a text 'AAAA-MM-DD' en la zona horària configurada. */
  function avui() {
    return Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd');
  }

  /** Converteix un objecte Date a text 'AAAA-MM-DD'. */
  function aText(data) {
    return Utilities.formatDate(data, tz(), 'yyyy-MM-dd');
  }

  /** Converteix un text 'AAAA-MM-DD' a Date local (migdia, per evitar salts d'horari d'estiu). */
  function aData(text) {
    var t = String(text).trim();
    var p = t.split('-');
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function esDataValida(text) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(text)) && aData(text) !== null;
  }

  /** Suma (o resta) dies a una data en text. Retorna text. */
  function sumaDies(text, dies) {
    var d = aData(text);
    if (!d) return null;
    d.setDate(d.getDate() + dies);
    return aText(d);
  }

  /** Diferència en dies entre dues dates en text (b - a). */
  function diesEntre(a, b) {
    var da = aData(a), db = aData(b);
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  /** Dia de la setmana: 1 = dilluns ... 7 = diumenge. */
  function diaSetmana(text) {
    var d = aData(text);
    if (!d) return null;
    var js = d.getDay();          // 0 = diumenge
    return js === 0 ? 7 : js;
  }

  /** Llista de dates entre dues (incloses), com a text. */
  function rangDates(desde, fins) {
    var out = [];
    var d = desde;
    var guarda = 0;
    while (d && d <= fins && guarda++ < 1000) {
      out.push(d);
      d = sumaDies(d, 1);
    }
    return out;
  }

  /** Setmana ISO d'una data: '2026-W31'. */
  function setmanaISO(text) {
    var d = aData(text);
    if (!d) return null;
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dia = (t.getDay() + 6) % 7;             // 0 = dilluns
    t.setDate(t.getDate() - dia + 3);           // dijous d'aquesta setmana
    var any = t.getFullYear();
    var primer = new Date(any, 0, 4);
    var dia2 = (primer.getDay() + 6) % 7;
    primer.setDate(primer.getDate() - dia2 + 3);
    var setmana = 1 + Math.round((t.getTime() - primer.getTime()) / (7 * 86400000));
    return any + '-W' + (setmana < 10 ? '0' + setmana : String(setmana));
  }

  /** Dilluns de la setmana d'una data donada. */
  function dillunsDe(text) {
    var dia = diaSetmana(text);
    return dia ? sumaDies(text, -(dia - 1)) : null;
  }

  /** Talla un text a n caràcters sense partir paraules pel mig. */
  function talla(text, n) {
    var t = String(text || '');
    if (t.length <= n) return t;
    var tallat = t.slice(0, n);
    var esp = tallat.lastIndexOf(' ');
    return (esp > n * 0.6 ? tallat.slice(0, esp) : tallat) + '…';
  }

  /**
   * Quant fa, dit com ho diria una persona.
   *
   * «Fa 4 minuts» es llegeix; «2026-08-02T14:12:03+02:00» s'ha de desxifrar.
   * Serveix per a tot allò que et surt a la pantalla amb una data al costat i
   * que el que realment vols saber és si és d'ara o d'abans-d'ahir.
   */
  function faQuant(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return 'no se sap quan';

    var s = Math.round((new Date().getTime() - d.getTime()) / 1000);
    if (s < 0) return 'ara mateix';
    if (s < 90) return 'ara mateix';

    var min = Math.round(s / 60);
    if (min < 60) return 'fa ' + min + ' minuts';

    var h = Math.round(min / 60);
    if (h < 24) return 'fa ' + h + (h === 1 ? ' hora' : ' hores');

    var dies = Math.round(h / 24);
    if (dies === 1) return 'ahir';
    if (dies < 30) return 'fa ' + dies + ' dies';
    return 'fa més d\'un mes';
  }

  /**
   * NOMÉS ELS ACCENTS FORA, i res més.
   *
   * Serveix per comparar noms escrits per una persona en dos llocs diferents:
   * la llista «Coordinació» del Google Tasks i la «coordinacio» que en surt en
   * un missatge de text. Els signes s'hi queden —«D'un correu» no és «D un
   * correu»— i per això no és `aixafa`, que sí que se'ls menja.
   *
   * Viu aquí perquè estava escrita DUES vegades, a Escola i a Tasques, i ja
   * havien començat a separar-se: una retallava els espais i l'altra no.
   */
  function senseAccents(text) {
    var s = String(text || '').toLowerCase().trim();
    var amb = 'àáâäèéêëìíîïòóôöùúûüñç', sense = 'aaaaeeeeiiiioooouuuunc';
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var n = amb.indexOf(s.charAt(i));
      out += n === -1 ? s.charAt(i) : sense.charAt(n);
    }
    return out;
  }

  /**
   * Text a mà oberta: minúscules, sense accents, sense signes, un sol espai.
   *
   * Serveix per comparar el que ha dit una persona amb una frase que tenim
   * escrita. «Ensenya'm la pàgina del dia» i «obre la pagina del dia» han de
   * ser la mateixa cosa, que és com les diu algú parlant.
   *
   * TÉ UNA BESSONA al client, a `vista_conversa`. Han de fer el mateix: si en
   * toques una, toca l'altra.
   */
  function aixafa(text) {
    var s = String(text || '').toLowerCase();
    var amb = 'àáâäèéêëìíîïòóôöùúûüñç';
    var sense = 'aaaaeeeeiiiioooouuuunc';
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var n = amb.indexOf(s.charAt(i));
      var c = n === -1 ? s.charAt(i) : sense.charAt(n);
      out += /[a-z0-9]/.test(c) ? c : ' ';
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  /**
   * UNA CLAU PEM, TORNADA A PLEGAR.
   *
   * Els llocs on es desen les claus no sempre respecten els salts de línia.
   * El quadre de Propietats de l'script és d'una sola línia i se'ls menja; un
   * JSON els porta escrits com a dues lletres. En tots dos casos la clau hi és
   * sencera i sense tocar, però `computeRsaSha256Signature` no la vol i diu
   * «Invalid argument: key», que no explica res i fa perdre una tarda.
   *
   * Aquí es desfà: es prenen els \n escrits com a salts de debò, i si encara
   * queda tot en una ratlla, s'agafa el cos i es plega de seixanta-quatre en
   * seixanta-quatre, que és com ha d'anar un PEM. Una clau que ja ve bé no es
   * toca. No es desa res enlloc: es plega cada cop que fa falta.
   */
  function plegaPem(text) {
    var brut = String(text || '').replace(/\\n/g, '\n').trim();
    if (brut.indexOf('\n') !== -1) return brut;

    var m = brut.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END [A-Z0-9 ]+-----/);
    if (!m) return brut;

    var cos = m[2].replace(/\s+/g, '');
    var linies = [];
    for (var i = 0; i < cos.length; i += 64) linies.push(cos.slice(i, i + 64));
    return '-----BEGIN ' + m[1] + '-----\n' + linies.join('\n') +
           '\n-----END ' + m[1] + '-----';
  }

  /** JSON tolerant: mai llança. */
  function json(obj) {
    try { return JSON.stringify(obj); } catch (e) { return '' + obj; }
  }

  function desJson(text, perDefecte) {
    try { return JSON.parse(text); } catch (e) { return perDefecte === undefined ? null : perDefecte; }
  }

  return {
    nouId: nouId,
    ara: ara,
    avui: avui,
    aText: aText,
    aData: aData,
    esDataValida: esDataValida,
    sumaDies: sumaDies,
    diesEntre: diesEntre,
    diaSetmana: diaSetmana,
    rangDates: rangDates,
    setmanaISO: setmanaISO,
    dillunsDe: dillunsDe,
    talla: talla,
    faQuant: faQuant,
    aixafa: aixafa,
    senseAccents: senseAccents,
    plegaPem: plegaPem,
    json: json,
    desJson: desJson
  };
})();
