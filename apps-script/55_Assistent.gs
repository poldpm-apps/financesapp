/**
 * JEFE — NUCLI · L'assistent
 *
 * Aquí viu la conversa: qui és JEFE, què pot mirar i què no pot tocar.
 * El transport (parlar amb Gemini) és a 50_IA.gs; això és el cervell del damunt.
 *
 * LES DUES REGLES QUE HO SOSTENEN TOT
 *
 *   1. NO POT INVENTAR-SE RES. Només pot afirmar el que hagi sortit d'una eina
 *      en aquesta mateixa conversa. Zero files és una resposta vàlida: «no en
 *      tinc dades». Una xifra plausible inventada és el pitjor error possible,
 *      perquè és la que et farà deixar de creure-te'l.
 *
 *   2. NO ESCRIU MAI. Les eines marcades amb `escriu: true` NO s'executen:
 *      es converteixen en una PROPOSTA que has de confirmar tu amb un botó.
 *      (Requisit 6 del teu briefing.)
 */

var Assistent = (function () {

  /* Cada volta és UNA petició sencera a Gemini. Amb la capa gratuïta, el
     límit no són els diners sinó les peticions per minut: tres voltes per
     pregunta esgoten la quota en un parell de preguntes. Dues n'hi ha prou
     per a qualsevol cosa que sàpiga fer avui. */
  var MAX_VOLTES = 2;
  var MAX_RESULTAT = 8000;     // caràcters per resultat d'eina

  // -------------------------------------------------------------------- eines

  function eines() {
    var totes = Moduls.einesIA().slice();

    totes.push({
      nom: 'quines_dades_hi_ha',
      descripcio: 'Retorna quins mòduls i quines eines existeixen, i la data d\'avui. ' +
                  'Crida-la si dubtes de si pots respondre una pregunta amb dades reals.',
      esquema: { type: 'object', properties: {} },
      executa: function () {
        return {
          files: 1,
          data_avui: Utils.avui(),
          moduls: Moduls.actius().map(function (m) { return m.id; }),
          eines: Moduls.einesIA().map(function (e) { return e.nom; })
        };
      }
    });

    return totes;
  }

  function cerca_(llista, nom) {
    for (var i = 0; i < llista.length; i++) if (llista[i].nom === nom) return llista[i];
    return null;
  }

  /**
   * El que va al plafó, amb un sostre.
   *
   * Això viatja fins al navegador a cada resposta. Una eina que torni tres
   * mil files no ha de poder fer una resposta de mig mega: el que no hi cap
   * es talla i es diu al peu, que és més honest que ensenyar-ne dues-centes
   * i callar que n'hi havia mil.
   */
  var VISOR_MAX = 120;

  function visorRetallat_(v) {
    if (!v || typeof v !== 'object') return undefined;
    var out = {
      titol: String(v.titol || ''),
      mena: v.mena || 'llista',
      unitat: v.unitat || '',
      peu: (v.peu || []).slice(0, 3),
      buit: v.buit || ''
    };

    if (out.mena === 'taula') {
      var files = (v.dades && v.dades.files) || [];
      out.dades = { caps: (v.dades && v.dades.caps) || [], files: files.slice(0, VISOR_MAX) };
      if (files.length > VISOR_MAX) out.peu.push('i ' + (files.length - VISOR_MAX) + ' més');
      return out;
    }

    var d = v.dades || [];
    out.dades = d.slice(0, VISOR_MAX);
    if (d.length > VISOR_MAX) out.peu.push('i ' + (d.length - VISOR_MAX) + ' més');
    return out;
  }

  function retalla_(obj) {
    var s = Utils.json(obj);
    if (s.length <= MAX_RESULTAT) return obj;
    Log.avis('assistent', 'Resultat d\'eina retallat', { mida: s.length });
    return {
      retallat: true,
      avis: 'El resultat era massa gran. Torna a demanar-ho amb un rang més curt.',
      mostra: Utils.talla(s, 6000)
    };
  }

  // ------------------------------------------------------------- instruccions

  function sistema_() {
    var fitxa;
    try { fitxa = Moduls.contextIA({ compacte: true }); }
    catch (e) { fitxa = ''; }

    return [
      'Ets JEFE, l\'assistent personal d\'en Pol. Respons SEMPRE en català.',
      '',
      'Qui és en Pol: mestre de primària i agent rural. Fa senderisme i curses de',
      'muntanya. Els contextos de la seva vida són docència, agent rural i personal.',
      '',
      '== REGLA ABSOLUTA SOBRE LES DADES ==',
      'Només pots afirmar dades que hagin sortit d\'una eina o de la SITUACIÓ D\'AVUI',
      'que tens més avall. Si una eina retorna 0 files, o no hi ha eina per a allò que',
      'et pregunten, la resposta correcta és dir-ho clarament: «no en tinc dades».',
      'No estimis. No dedueixis. No facis una mitjana plausible. No diguis',
      '«probablement» ni «diria que». Si no ho has consultat, no ho saps.',
      '',
      '== NO CRIDIS EINES SI NO CALEN ==',
      'La SITUACIÓ D\'AVUI de més avall JA ESTÀ CONSULTADA i és real: hi tens els',
      'hàbits, si estan fets, les ratxes i el compliment de 30 dies. Si la resposta',
      'ja hi és, respon directament SENSE cridar cap eina. Cada eina que crides',
      'afegeix uns quants segons d\'espera. Crida-les només per a coses que la fitxa',
      'no contingui: rangs de dates concrets, històrics llargs o hàbits que no hi surtin.',
      '',
      '== SOVINT ET PARLA, NO T\'ESCRIU ==',
      'Moltes preguntes venen del micròfon, i el reconeixedor de veu de Google en',
      'català s\'equivoca sovint: canvia paraules per altres que sonen igual, talla',
      'finals i deixa faltes. «Quants hàbits EN falten per MERCA» vol dir «quants',
      'hàbits EM falten per MARCAR». Llegeix-ho pel so i pel context, no al peu de',
      'la lletra, i respon el que és evident que et volia dir. Si de debò no ho pots',
      'endevinar, digues què has entès i pregunta-ho; no t\'inventis la pregunta.',
      '',
      '== ENSENYAR NO ÉS EXPLICAR ==',
      'Si et demana VEURE o OBRIR una pantalla —«ensenya\'m», «obre\'m», «mostra\'m»—,',
      'crida l\'eina que l\'obre ENCARA QUE la resposta ja la tinguis a la fitxa. El que',
      'vol és la pantalla, no el text; això mana sobre la regla d\'aquí sobre. I un cop',
      'cridada, ell ja ho té davant dels ulls: no l\'hi recitis. Una frase curta o cap.',
      '',
      '== MAI PARLIS DE LES TEVES EINES ==',
      'No diguis MAI «no tinc cap eina per a això», ni «no disposo de la funció»,',
      'ni «el sistema no em permet». Les teves eines són la teva cuina i a ell no',
      'li interessen: quan li dius que et falta una eina, li estàs explicant com',
      'estàs fet en comptes de respondre-li, i el deixes sense saber què fer.',
      '',
      'Quan no puguis fer una cosa, digues-li DUES coses i cap més:',
      '  1. què és el que no pots, en els seus termes —«això encara no t\'ho sé',
      '     ensenyar», «d\'això no en tinc dades»—;',
      '  2. què SÍ que li pots donar d\'allò mateix, i ofereix-ho.',
      'Exemple: si et demana veure un gràfic que no saps dibuixar, ensenya-li les',
      'dades que sí que tens d\'aquell tema, o digues-li quina cosa semblant sí que',
      'li pots ensenyar. Si no hi ha res semblant, digues-ho en una línia i prou.',
      'Mai facis una llista de les teves limitacions.',
      '',
      '== NO POTS ESCRIURE ==',
      'No modifiques res pel teu compte. Si et demana apuntar, registrar, marcar o',
      'treure alguna cosa, crida l\'eina corresponent: es convertirà en una proposta',
      'que ell haurà de confirmar.',
      'Digues-li QUÈ faràs i acaba demanant-li que ho confirmi. Pot fer-ho amb el',
      'botó o dient-t\'ho —«sí», «fes-ho», «no»—, o sigui que NO li diguis mai que',
      'ha de prémer res: ell pot estar parlant-te sense mirar la pantalla.',
      '',
      '== TO ==',
      'Directe i curt. Sense preàmbuls, sense «és una bona pregunta», sense emojis.',
      'Si la resposta cap en una línia, fes-ne una. Parla\'l de tu.',
      '',
      '== SITUACIÓ D\'AVUI (dades reals, ja consultades) ==',
      fitxa || '(encara no hi ha cap mòdul amb dades)'
    ].join('\n');
  }

  // ----------------------------------------------------------------- pregunta

  /**
   * missatges: [{rol:'usuari'|'assistent', text}] en ordre cronològic.
   * Retorna {text, propostes, einesUsades, tokens, model}.
   */
  function pregunta(missatges) {
    if (!IA.disponible()) {
      var e = new Error(IA.motiu() || 'La capa d\'IA no està disponible.');
      e.iaApagada = true;
      throw e;
    }

    var t0 = Date.now();
    var llistaEines = eines();
    var conversa = missatges.slice();
    var propostes = [], einesUsades = [];
    var tEntrada = 0, tSortida = 0, tPensats = 0, model = null;

    /* El context es construeix UN COP, no a cada volta.
       Dins del bucle tornava a llegir tots els fulls a cada iteració, i això
       són segons regalats en una conversa que ja va justa de temps. */
    var instruccions = sistema_();
    var msContext = Date.now() - t0;
    var msIA = 0, msEines = 0;

    for (var volta = 0; volta < MAX_VOLTES; volta++) {
      var tIA = Date.now();
      var r = IA.genera({
        sistema: instruccions,
        missatges: conversa,
        eines: llistaEines,
        /* LA PRIMERA VOLTA NO ESCRIU RES: TRIA UNA EINA.
           Cada volta és una petició sencera, i totes dues anaven al model bo:
           dues peticions per pregunta del model amb el límit més estret, i
           amb cinc preguntes seguides la quota se n'anava.
           Triar una eina d'una llista i omplir-ne els arguments és
           exactament el que fa bé un model petit; escriure la resposta amb
           les dades al davant, no. Aquí es reparteix segons la feina, i de
           passada la primera volta va més de pressa. */
        model: volta === 0 ? 'barat' : 'bo',
        maxTokens: 1200,
        temperatura: 0
      });

      msIA += Date.now() - tIA;
      tEntrada += r.tokensEntrada; tSortida += r.tokensSortida; model = r.model;
      tPensats += r.tokensPensats || 0;

      if (!r.crides.length) {
        return {
          text: r.text || 'No sé què respondre a això.',
          propostes: propostes, einesUsades: einesUsades,
          tokens: { entrada: tEntrada, sortida: tSortida }, model: model,
          temps: { rumiat: tPensats, total: Date.now() - t0, context: msContext, ia: msIA,
                   eines: msEines, voltes: volta + 1 }
        };
      }

      // Torna el torn del model sencer a la conversa (hi van les crides a eines)
      conversa.push({ parts: r.contingutBrut.parts, role: 'model' });

      var resultats = [];
      for (var i = 0; i < r.crides.length; i++) {
        var c = r.crides[i];
        var eina = cerca_(llistaEines, c.nom);
        var resultat;

        if (!eina) {
          resultat = { error: 'Aquesta eina no existeix.', files: 0 };
        } else if (eina.escriu) {
          propostes.push({
            eina: eina.nom,
            modul: eina._modul,
            accio: eina.accio,
            etiqueta: eina.etiqueta ? eina.etiqueta(c.args || {}) : eina.nom,
            args: c.args || {}
          });
          resultat = { pendent_de_confirmacio: true,
                       missatge: 'Proposta creada. Encara NO s\'ha fet res: en Pol l\'ha de confirmar.' };
        } else {
          var tE = Date.now();
          try {
            resultat = eina.executa(c.args || {});
          } catch (err) {
            Log.error('assistent.eina', 'L\'eina ' + c.nom + ' ha fallat: ' + err.message, c.args);
            resultat = { error: 'L\'eina ha fallat: ' + err.message, files: 0 };
          }
          msEines += Date.now() - tE;
        }

        /* `obre` és com una eina demana que l'app ensenyi una pantalla.
           No és cap escriptura —ensenyar-te una cosa no canvia res—, o sigui
           que no passa per confirmació: passa pel client, que ja hi va. Ho
           porta l'eina al seu descriptor i el nucli no sap quines pantalles
           hi ha ni li cal saber-ho. */
        /* I `mostra` és el germà petit: en comptes de canviar de pantalla,
           obre un plafó a sobre de la conversa amb una cosa concreta —una
           corba, una setmana—. La diferència no és tècnica: canviar de
           pantalla és marxar d'on ets, i això és ensenyar-t'ho sense
           moure't. Igual que `obre`, el nucli no sap què hi ha a dins. */
        /* I `_visor`: QUALSEVOL EINA POT ENSENYAR EL QUE HA TROBAT.
           Aquest és el que fa que no calgui una llista de coses ensenyables.
           L'eina no ha de saber dibuixar: torna les seves dades en una de
           les quatre formes que el visor sap pintar —llista, línia, barres,
           taula— i el plafó s'obre sol. Afegir-hi una cosa nova no és tocar
           el nucli ni la pantalla: és que una eina que ja existeix ho
           retorni.
           Només hi va si ELL ha demanat veure-ho: les eines porten un
           `ensenya` que el model posa quan la pregunta era «ensenya'm» i no
           «quant». Si no, es contesta amb paraules i no s'obre res. */
        einesUsades.push({
          eina: c.nom, args: c.args || {},
          obre: eina && eina.obre ? eina.obre : undefined,
          mostra: eina && eina.mostra ? eina.mostra : undefined,
          obreAmb: (eina && (eina.obre || eina.mostra) && resultat && resultat._params)
                     ? resultat._params : undefined,
          visor: (resultat && resultat._visor) ? visorRetallat_(resultat._visor) : undefined,
          files: (resultat && resultat.files !== undefined) ? resultat.files : null
        });
        resultats.push({ nom: c.nom, resultat: retalla_(resultat) });
      }

      conversa.push(IA.missatgeEines(resultats));
    }

    Log.avis('assistent', 'S\'han esgotat les voltes d\'eines');
    return {
      text: 'He consultat les dades però no n\'he tret una resposta clara. Prova de preguntar-ho més concret.',
      propostes: propostes, einesUsades: einesUsades,
      tokens: { entrada: tEntrada, sortida: tSortida }, model: model,
      temps: { rumiat: tPensats, total: Date.now() - t0, context: msContext, ia: msIA, eines: msEines, voltes: MAX_VOLTES }
    };
  }

  return { pregunta: pregunta, eines: eines };
})();
