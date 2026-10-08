/**
 * JEFE — NUCLI · Capa d'IA (adaptador de proveïdor)
 *
 * AQUEST ÉS L'ÚNIC FITXER QUE SAP AMB QUI PARLEM.
 * La resta del sistema crida IA.genera(...) i no sap ni li importa el proveïdor.
 * Canviar de Gemini a Anthropic el dia de demà és tocar aquest fitxer i la
 * cel·la `proveidor_ia` del full `_Config`. Res més.
 *
 * INTERRUPTOR: la capa està apagada mentre no hi hagi clau a Script Properties
 * I `ia_activa` valgui SI al full `_Config`. Amb la capa apagada, el sistema
 * sencer continua funcionant: el que es perd és la classificació automàtica,
 * l'observació dels resums i la conversa.
 *
 * LA CLAU NO POT ANAR MAI EN AQUEST FITXER. Va a:
 *   Configuració del projecte → Propietats de l'script → CLAU_IA
 */

var IA = (function () {

  function clau_() {
    return PropertiesService.getScriptProperties().getProperty(PROP_CLAU_IA) || null;
  }

  function proveidor_() {
    return String(Config.get('proveidor_ia', 'gemini')).toLowerCase();
  }

  function disponible() {
    return !!clau_() && Config.esSi('ia_activa');
  }

  /** Per què no està disponible, en llenguatge que es pugui ensenyar a la pantalla. */
  function motiu() {
    if (!clau_()) return 'Falta la clau de l\'API a les propietats de l\'script (CLAU_IA).';
    if (!Config.esSi('ia_activa')) return 'La capa d\'IA està desactivada (`ia_activa` = NO a _Config).';
    return null;
  }

  function estat() {
    return {
      disponible: disponible(),
      motiu: motiu(),
      proveidor: proveidor_(),
      modelBarat: Config.get('model_barat'),
      modelBo: Config.get('model_bo'),
      incloDiari: Config.esSi('ia_inclou_diari')
    };
  }

  // ---------------------------------------------------------------- Gemini

  /* QUANT SE'L DEIXA RUMIAR, PER MODEL, APRÈS A BASE DE PROVAR-HO.
     El valor que volem és zero —rumiar costa segons i aquí no cal—, però no
     tots l'accepten: n'hi ha que demanen un mínim. Si es queixa del zero es
     prova el mínim, i si també es queixa es deixa córrer i que faci el que
     vulgui. Val més rumiar poc que rumiar sense fre, i molt més que un error
     a la cara. Viu mentre viu l'execució: no cal desar-ho enlloc. */
  var RUMIAR_MIN = 128;
  var QUANT_RUMIA = {};        // model → tokens, o null si no se li pot dir res

  /* ------------------------------------------------------------------------
     QUANTES PETICIONS PORTES AVUI

     Google NO diu quantes te'n queden: no hi ha cap manera de preguntar-ho.
     L'únic que se sap del cert és el que hem gastat NOSALTRES, i quan ens han
     dit que prou. Doncs això és el que es compta, i el que s'ensenya.

     I NO HI HA CAP PERCENTATGE. Va existir mig dia: calculava el que quedava
     contra un límit que havia d'escriure ell a mà. En Pol el va fer fora, i
     tenia raó: un tant per cent contra un denominador suposat sembla una dada
     i no ho és. Val més un número petit que se sap cert que un de gran que
     s'ha d'anar creient.
     ------------------------------------------------------------------------ */

  var CAU_COMPTADOR = 'ia_peticions_';   // + dia
  var PROP_ULTIM_NO = 'IA_ULTIM_LIMIT';

  function compta_(model) {
    try {
      var cau = CacheService.getScriptCache();
      var clau = CAU_COMPTADOR + Utils.avui();
      var n = Number(cau.get(clau) || 0) + 1;
      /* Sis hores: prou per cobrir un dia de fer servir l'app, i si es perd
         només vol dir que el número surt més baix del que toca. Cap decisió
         depèn d'aquest comptador: només serveix per mirar-se'l. */
      cau.put(clau, String(n), 21600);
    } catch (e) { /* sense cau no es compta, i no passa res */ }
  }

  function apuntaLimit_(segons, quota) {
    try {
      PropertiesService.getScriptProperties().setProperty(PROP_ULTIM_NO,
        JSON.stringify({ quan: Utils.ara(), segons: segons || null, quota: quota || '' }));
    } catch (e) {}
  }

  /** Què sabem del consum. Tot mesurat, res estimat. */
  function consum() {
    var avui = 0;
    try {
      avui = Number(CacheService.getScriptCache().get(CAU_COMPTADOR + Utils.avui()) || 0);
    } catch (e) {}

    var ultim = null;
    try {
      ultim = Utils.desJson(
        PropertiesService.getScriptProperties().getProperty(PROP_ULTIM_NO), null);
    } catch (e) {}

    var r = { avui: avui, tocat: false, faSegons: null, esperaSegons: null };

    if (ultim && ultim.quan) {
      var d = new Date(ultim.quan);
      if (!isNaN(d.getTime())) {
        var fa = Math.round((new Date().getTime() - d.getTime()) / 1000);
        r.faSegons = fa;
        r.esperaSegons = ultim.segons || null;
        /* «Tocat» vol dir que el límit encara pot estar actiu. Amb el temps
           d'espera que ens va dir Google si el va dir, i si no, un minut, que
           és el que dura el límit per minut. */
        r.tocat = fa < (ultim.segons || 60);
        r.quota = ultim.quota || '';
      }
    }
    return r;
  }

  var Gemini = {
    url: function (model) {
      return 'https://generativelanguage.googleapis.com/v1beta/models/' +
             encodeURIComponent(model) + ':generateContent';
    },

    cos: function (p) {
      var cos = { contents: [] };

      if (p.sistema) cos.systemInstruction = { parts: [{ text: p.sistema }] };

      for (var i = 0; i < p.missatges.length; i++) {
        var m = p.missatges[i];
        if (m.parts) { cos.contents.push(m); continue; }   // missatge ja format (eines)
        cos.contents.push({
          role: m.rol === 'assistent' ? 'model' : 'user',
          parts: [{ text: String(m.text) }]
        });
      }

      if (p.eines && p.eines.length) {
        cos.tools = [{
          functionDeclarations: p.eines.map(function (e) {
            var d = { name: e.nom, description: e.descripcio };
            // Un esquema amb `properties` buit fa que l'API retorni 400.
            // Una eina sense arguments simplement no declara paràmetres.
            if (e.esquema && e.esquema.properties && Object.keys(e.esquema.properties).length) {
              d.parameters = e.esquema;
            }
            return d;
          })
        }];
      }

      cos.generationConfig = {
        temperature: p.temperatura === undefined ? 0 : p.temperatura,
        maxOutputTokens: p.maxTokens || 1024
      };
      if (p.json) cos.generationConfig.responseMimeType = 'application/json';

      /* PENSAR ABANS DE RESPONDRE COSTA SEGONS, I AQUÍ GAIREBÉ MAI CAL.
         Els models nous es prenen una estona per pensar si no els dius el
         contrari. Però la feina d'aquí és mirar una fitxa que ja ve resolta
         i, com a molt, triar una eina: no hi ha res a rumiar. Amb l'àudio es
         notava el doble, i una pregunta de dos segons de veu en costava deu
         de resposta.

         Va per configuració i no clavat al codi: si algun dia hi ha una
         pregunta que sí que ho necessiti, es puja `pensa_tokens` al full.

         I NO S'ENDEVINA QUIN MODEL HO ACCEPTA. El primer intent ho endevinava
         pel nom i li va costar un error a la cara a en Pol: n'hi ha que volen
         un mínim i no zero. Ara es prova, i si el model es queixa, `crida`
         ho torna a demanar sense i se'n recorda per a la resta de l'execució. */
      var model = String(p._model || '');
      if (model) {
        var quant = QUANT_RUMIA[model];
        if (quant === undefined) quant = Config.getNum('pensa_tokens', 0);
        if (quant !== null) cos.generationConfig.thinkingConfig = { thinkingBudget: quant };
      }

      return cos;
    },

    crida: function (p, model) {
      p._model = model;

      function envia(cos) {
        compta_(model);
        return UrlFetchApp.fetch(Gemini.url(model), {
          method: 'post',
          contentType: 'application/json',
          // La clau va a la capçalera, MAI a l'URL: els URLs acaben als registres.
          headers: { 'x-goog-api-key': clau_() },
          payload: JSON.stringify(cos),
          muteHttpExceptions: true
        });
      }

      var cos = Gemini.cos(p);
      var resposta = envia(cos);

      /* SI ES QUEIXA DE QUANT EL DEIXEM RUMIAR, ES BAIXA UN ESGLAÓ.
         Primer el mínim que en accepten la majoria; si tampoc, es deixa
         córrer. Baixar directament a «que rumiï el que vulgui» era regalar
         els segons que preteníem estalviar, i és el que li passava a en Pol:
         402 tokens de rumiar en una pregunta de mirar una llista. */
      if (resposta.getResponseCode() === 400 && cos.generationConfig.thinkingConfig) {
        var eren = cos.generationConfig.thinkingConfig.thinkingBudget;
        if (eren < RUMIAR_MIN) {
          QUANT_RUMIA[model] = RUMIAR_MIN;
          cos.generationConfig.thinkingConfig.thinkingBudget = RUMIAR_MIN;
          Log.avis('ia.rumiar', 'El model ' + model + ' no accepta ' + eren +
                                ' tokens de rumiar. Ho provo amb ' + RUMIAR_MIN + '.');
        } else {
          QUANT_RUMIA[model] = null;
          delete cos.generationConfig.thinkingConfig;
          Log.avis('ia.rumiar', 'El model ' + model + ' no deixa que li diguin quant rumiar. ' +
                                'Rumiarà el que vulgui.',
                   { resposta: Utils.talla(resposta.getContentText(), 200) });
        }
        resposta = envia(cos);

        // Si el mínim tampoc no li va bé, l'últim recurs és no dir-li res.
        if (resposta.getResponseCode() === 400 && cos.generationConfig.thinkingConfig) {
          QUANT_RUMIA[model] = null;
          delete cos.generationConfig.thinkingConfig;
          Log.avis('ia.rumiar', 'Ni amb ' + RUMIAR_MIN + '. Rumiarà el que vulgui.');
          resposta = envia(cos);
        }
      }

      var codi = resposta.getResponseCode();
      var text = resposta.getContentText();

      if (codi === 429) {
        // Google diu quant s'ha d'esperar i quina quota s'ha exhaurit.
        // Val la pena llegir-ho en comptes de reintentar a cegues.
        var d = Utils.desJson(text, {});
        var detalls = (d.error && d.error.details) || [];
        var espera = null, quota = null;
        for (var k = 0; k < detalls.length; k++) {
          if (detalls[k].retryDelay) espera = String(detalls[k].retryDelay);
          if (detalls[k].violations && detalls[k].violations[0]) {
            quota = detalls[k].violations[0].quotaId || detalls[k].violations[0].quotaMetric;
          }
        }
        Log.avis('ia.quota', 'Límit de quota assolit', { quota: quota, espera: espera });
        apuntaLimit_(espera ? parseInt(espera, 10) : null, quota);

        var segons = espera ? parseInt(espera, 10) : null;
        var e429 = new Error(
          'Has arribat al límit gratuït de Gemini' +
          (segons ? '. Torna-ho a provar d\'aquí ' + segons + ' segons.'
                  : '. Espera un minut i torna-hi.') +
          (quota ? ' (límit: ' + quota + ')' : '')
        );
        e429.quota = true;
        e429.esperaSegons = segons;
        throw e429;
      }
      if (codi >= 500) throw new Error('El servei d\'IA no respon ara mateix (codi ' + codi + ').');
      if (codi !== 200) {
        var detall = Utils.desJson(text, {});
        var msg = (detall.error && detall.error.message) ? detall.error.message : Utils.talla(text, 300);
        throw new Error('Error de l\'API (codi ' + codi + '): ' + msg);
      }

      return Gemini.interpreta(Utils.desJson(text, {}));
    },

    interpreta: function (dades) {
      var cand = (dades.candidates && dades.candidates[0]) || null;
      var parts = (cand && cand.content && cand.content.parts) || [];

      var textos = [];
      var crides = [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].text) textos.push(parts[i].text);
        if (parts[i].functionCall) {
          crides.push({ nom: parts[i].functionCall.name, args: parts[i].functionCall.args || {} });
        }
      }

      var us = dades.usageMetadata || {};
      return {
        text: textos.join('\n').trim(),
        crides: crides,
        motiuFi: cand ? cand.finishReason : null,
        contingutBrut: cand ? cand.content : null,
        tokensEntrada: us.promptTokenCount || 0,
        tokensSortida: us.candidatesTokenCount || 0,
        /* Quant ha rumiat abans de contestar, dit per Google i no suposat per
           mi. Li demanem que no ho faci, però no tots els models fan cas i
           endevinar-ho pel nom ja va sortir malament un cop. Amb aquesta
           xifra a la pantalla, si un dia torna a anar lent es veu de seguida
           si és això o és una altra cosa. */
        tokensPensats: us.thoughtsTokenCount || 0
      };
    },

    /** Missatge a afegir a la conversa amb els resultats de les eines. */
    respostaEines: function (resultats) {
      return {
        role: 'user',
        parts: resultats.map(function (r) {
          return { functionResponse: { name: r.nom, response: r.resultat } };
        })
      };
    }
  };

  /**
   * Quins models pot fer servir AQUESTA clau, ara mateix.
   * Els noms dels models canvien i es retiren sense avisar; per això no n'hi ha
   * cap escrit a foc al codi: es demanen i es desen a `_Config`.
   */
  Gemini.models = function () {
    var resposta = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      { method: 'get', headers: { 'x-goog-api-key': clau_() }, muteHttpExceptions: true });

    var codi = resposta.getResponseCode();
    if (codi !== 200) {
      throw new Error('No s\'ha pogut llegir la llista de models (codi ' + codi + '): ' +
                      Utils.talla(resposta.getContentText(), 200));
    }

    var dades = Utils.desJson(resposta.getContentText(), {});
    return (dades.models || [])
      .filter(function (m) {
        return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
      })
      .map(function (m) {
        return {
          id: String(m.name || '').replace(/^models\//, ''),
          nom: m.displayName || '',
          entrada: m.inputTokenLimit || 0,
          sortida: m.outputTokenLimit || 0
        };
      });
  };

  var PROVEIDORS = { gemini: Gemini };

  // ---------------------------------------------------------------- públic

  /**
   * Crida genèrica al model.
   *
   * p = {
   *   sistema:     text d'instruccions,
   *   missatges:   [{rol: 'usuari'|'assistent', text}] o missatges ja formats,
   *   eines:       [{nom, descripcio, esquema}] (opcional),
   *   model:       'barat' | 'bo' | id concret,
   *   maxTokens, temperatura, json
   * }
   *
   * Retorna {text, crides, tokensEntrada, tokensSortida} o llança un error
   * amb missatge llegible per a una persona.
   */
  function genera(p) {
    if (!disponible()) {
      var e = new Error(motiu() || 'La capa d\'IA no està disponible.');
      e.iaApagada = true;
      throw e;
    }

    var prov = PROVEIDORS[proveidor_()];
    if (!prov) {
      throw new Error('Proveïdor d\'IA desconegut: «' + proveidor_() + '». Revisa `proveidor_ia` a _Config.');
    }

    var model = p.model === 'bo' ? Config.get('model_bo')
              : p.model === 'barat' || !p.model ? Config.get('model_barat')
              : p.model;

    /* EL LÍMIT ÉS PER MODEL, i això obre una porta.
       Google va contestar `GenerateRequestsPerMinutePerProjectPerModel`: el
       compte de peticions per minut es porta MODEL A MODEL. O sigui que si
       el model bo diu prou, el petit encara té el seu compte sencer.
       Reintentar amb el mateix model és perdre el temps —el límit no es mou
       en quatre segons—, però passar la pregunta a l'altre model no és
       reintentar: és fer-la per un camí que no està tancat. La resposta surt
       una mica més justa, i la té. */
    var altre = (p.model === 'bo') ? Config.get('model_barat') : null;
    var canviat = false;

    /* ══════════════════════════════════════════════════════════════════════
       QUE NO ES QUEDI A MITJA FRASE SENSE DIR-HO
       ══════════════════════════════════════════════════════════════════════

       El proveïdor ja diu per què ha parat —`finishReason`— i durant mesos
       aquí no ho mirava ningú. La conseqüència no era un error: era pitjor.
       En Pol va demanar la lectura de les fotos i li va sortir «De front i de
       perfil es nota clarament la reducció al voltant del melic i a la part
       baixa de l'abdomen. La caiguda», i s'acabava allà, presentada com si
       fos la resposta sencera. Una lectura del cos tallada a mitges no és
       mitja lectura: és una que diu una cosa diferent de la que deia.

       PER QUÈ PASSA. El sostre de `maxOutputTokens` no és només per a la
       resposta: els models que rumien hi compten també el que rumien. Li
       demanem que no rumiï, però no tots en fan cas, i quan un se'n va
       vuit-cents tokens pensant, del sostre en queden trenta paraules.

       QUÈ ES FA. Es torna a demanar UN cop amb el triple de sostre. No és
       reintentar a cegues: sabem exactament què ha fallat i sabem que amb més
       marge no torna a passar. I si tot i així es torna a tallar, la resposta
       se'n va amb `tallat` posat perquè qui la reculli ho pugui dir en comptes
       de fer veure que està acabada.

       El que hi rumia queda al registre a posta: és l'única manera de saber si
       un model concret ignora que li demanem que no rumiï. */
    var intents = 0;
    var espera = 1000;
    var sostre = p.maxTokens || 1024;
    var ampliat = false;

    while (true) {
      try {
        p.maxTokens = sostre;
        var r = prov.crida(p, model);
        r.model = model;
        if (canviat) r.rebaixat = true;      // que la pantalla ho pugui dir

        if (r.motiuFi === 'MAX_TOKENS' && !ampliat) {
          ampliat = true;
          Log.avis('ia.tallat', 'La resposta s\'ha quedat a mitges: la torno a demanar amb més sostre',
                   { model: model, sostre: sostre, pensats: r.tokensPensats || 0,
                     sortida: r.tokensSortida || 0 });
          sostre = Math.min(sostre * 3, 8192);
          continue;
        }
        if (r.motiuFi === 'MAX_TOKENS') {
          r.tallat = true;
          Log.avis('ia.tallat', 'S\'ha tornat a tallar fins i tot amb ' + sostre + ' de sostre',
                   { model: model, pensats: r.tokensPensats || 0 });
        }
        return r;
      } catch (err) {
        intents++;

        if (err.quota && altre && altre !== model && !canviat) {
          Log.avis('ia.genera', 'Quota del model bo tocada: passo al petit',
                   { de: model, a: altre });
          model = altre; canviat = true; intents = 0;
          continue;
        }

        /* La quota NO es reintenta amb el mateix model. Un límit per minut no
           es recupera en quatre segons: reintentar-ho només afegeix espera
           abans de fallar igualment, i encara consumeix més quota. Es falla
           de seguida i es diu quant s'ha d'esperar. */
        var recuperable = !err.quota && /no respon ara mateix/.test(err.message || '');
        if (!recuperable || intents >= 2) {
          Log.error('ia.genera', err, { model: model, intents: intents });
          throw err;
        }
        Utilities.sleep(espera);
        espera *= 4;
      }
    }
  }

  /** Adapta els resultats de les eines al format del proveïdor actiu. */
  function missatgeEines(resultats) {
    var prov = PROVEIDORS[proveidor_()];
    return prov.respostaEines(resultats);
  }

  /** Models disponibles per al proveïdor actiu. */
  function models() {
    var prov = PROVEIDORS[proveidor_()];
    if (!prov || !prov.models) throw new Error('Aquest proveïdor no sap llistar models.');
    if (!clau_()) throw new Error('Falta la clau de l\'API a Script Properties (CLAU_IA).');
    return prov.models();
  }

  return {
    disponible: disponible,
    motiu: motiu,
    estat: estat,
    consum: consum,
    genera: genera,
    missatgeEines: missatgeEines,
    models: models
  };
})();
