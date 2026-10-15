# Finances

Les finances del mes, connectades al banc: el que entra, el que surt i el que
queda. Surt de l'apartat de **Finances** de JEFE i fa exactament el mateix.

- **L'app:** <https://poldpm-apps.github.io/financesapp/>
- **Les dades:** un full de càlcul propi, «Finances», al teu Drive. Les set
  pestanyes es **copien** del full de JEFE, que es queda intacte de còpia de
  seguretat.
- **El servidor:** un projecte d'Apps Script propi.

## Com està fet

```
apps-script/   el codi. Apps Script el serveix i GitHub Pages en publica la pantalla
eines/         comprovar, provar, construir, desplegar i el mirall
index.html     la pantalla publicada. LA GENERA `npm run construeix`: no l'editis
```

El nucli (`00_` a `65_`) és el de JEFE, copiat. Els fitxers propis són
`40_Mod_Finances.gs`, `41_Finances_Import.gs`, `42_Finances_Banc.gs`,
`43_Finances_Regles.gs` i `vista_finances.html`. El frontal té un disseny
propi, «el tall del mes», germà de Nutrició i del cos: vegeu `DESIGN.md`.

## Les ordres

```bash
npm run comprova     # comprovacions i proves; ha de dir «Tot correcte»
npm run mirall       # la pantalla amb dades inventades, per mirar-la en local
npm run puja         # comprova, prova, construeix, puja a Apps Script i desplega
git push             # publica la PANTALLA a GitHub Pages
```

`npm run puja` actualitza el servidor; la pantalla la serveix GitHub Pages i
**sense `git push` segueixes veient la d'abans.**

## La primera vegada (a l'editor d'Apps Script)

1. Executa **`instala()`**. Crea el full «Finances» i s'hi porta les pestanyes
   `Moviments`, `Categories`, `Recurrents`, `FinancesMemoria`, `Pressupostos`,
   `Patrimoni` i `PatrimoniHistoric` del full de JEFE —les **copia**: el de
   JEFE no es toca—. Instal·la els automatismes i escriu la clau d'accés al
   registre. Copia-la.
2. Executa **`comprovaCopia()`**. Compara cel·la per cel·la les set pestanyes
   del full de JEFE amb les del nou, i només llegeix. Ha de dir **TOT QUADRA**.
   Si alguna cosa no quadra, no facis servir l'app: el full de JEFE segueix
   intacte. (Si JEFE ha sincronitzat el banc entre la còpia i la comprovació,
   `Moviments` pot tenir alguna fila de més a JEFE: és normal, i ho diu.)
3. A *Configuració del projecte → Propietats de l'script*, afegeix
   `FIREBASE_COMPTE` amb el mateix valor que al projecte de JEFE.
4. Obre l'app, enganxa-hi l'adreça del desplegament (acaba en `/exec`) i la
   clau, i prem **Activa els avisos**.

## El banc: l'últim de tot

Quan la resta ja funcioni amb les dades copiades:

1. **Atura el banc de JEFE** (a JEFE, treu l'automatisme `triggerBanc`). El
   banc deixa mirar quatre vegades al dia; amb tots dos projectes en farien
   sis.
2. A *Propietats de l'script* d'aquest projecte, posa `EB_APP_ID`,
   `EB_PRIVATE_KEY`, `BANC_NOM` i `EB_REDIRECT` (l'adreça `/exec` d'aquest
   desplegament), i registra aquella adreça a enablebanking.com.
3. **`provaClauBanc()`** i **`provaBanc()`**: la clau ha de signar i l'adreça
   de tornada ha de ser la d'aquesta app.
4. **`connectaBanc()`**, obre l'enllaç i identifica't al banc.
   **`estatBanc()`** ha de dir «Connectat: sí».
5. **`sincronitzaBancAra()`**. Si el banc respon `WRONG_TRANSACTIONS_PERIOD`
   (422), l'escala baixa sola fins a la finestra que dona i se la desa.

## Els automatismes

| Quan | Què |
|---|---|
| a les 6, a les 15 i a les 20 | el banc: baixa els moviments i avisa si n'hi ha per classificar |
| el dia 28 a les 21:00 | el recordatori del patrimoni que no s'actualitza sol |
| cada 3 hores | els senyals: el vigilant dels rebuts fixos |
| cada 10 minuts | prepara les pantalles perquè s'obrin ràpid |
| cada dia a les 3 | manteniment: registre i estructura del full |

## Les propietats de l'script

Mai al codi ni al repositori.

| Propietat | Per a què |
|---|---|
| `ID_FULL` | el full de càlcul; la posa `configura()` |
| `CLAU_ACCES` | la clau de la pantalla; la posa `generaClauAcces()` |
| `FIREBASE_COMPTE` | els avisos al mòbil |
| `EB_APP_ID` · `EB_PRIVATE_KEY` · `EB_REDIRECT` · `BANC_NOM` | el banc |
| `FINANCES_BANC` | l'estat de la connexió amb el banc; el posa `connectaBanc()` |
| `ID_FULL_JEFE` | només si `configura()` no troba sol el full de JEFE |

Les finances no fan servir la IA: no cal `CLAU_IA`.

## Instal·lar-la al mòbil

- **Amb el botó «Instal·la l'app» de la pàgina, no amb el menú de Chrome.** Al
  mòbil, quan al mateix domini ja hi ha una altra app instal·lada, el menú diu
  «ja està instal·lada» i només deixa crear una drecera. El botó crida la
  instal·lació del navegador directament (es va veure amb la de nòmines i amb
  la del cos).
- **L'`"id"` del manifest és `/financesapp/` i no es canvia mai.** Canviar-lo
  vol dir que, per a Chrome, és una altra app.
- Hi ha icones PNG de 192 i 512 i una de retallable: Android no instal·la
  l'app amb només SVG.
- **L'app viu a `poldpm-apps.github.io`, no a `poldpm.github.io`**, com
  Nutrició i el cos. Al mòbil hi ha una app amagada i trencada que reclama tot
  el domini `poldpm.github.io` i no hi deixa instal·lar res.
- L'app de finances del juliol vivia a `poldpm.github.io/finances/`, un altre
  domini: no comparteixen ni memòria ni dades. Si encara la tens instal·lada,
  la pots treure.
