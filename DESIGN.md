---
name: Finances — el tall del mes
description: El mes és un tall de terreny; per sobre del nivell el que entra, per sota el que surt, i on acaben totes dues línies és el que et queda. Germà de Nutrició i del cos.
colors:
  camp: "#e8eef0"
  camp-alt: "#f3f6f7"
  blanc: "#fbfcfc"
  tinta: "#0d191e"
  tinta-2: "#3d5560"
  tinta-3: "#5b717a"
  t1: "#bcced4"
  t2: "#7ab5c1"
  t3: "#1c8496"
  t4: "#054a57"
  fil: "#9fb4bb"
  fil-fort: "#0d191e"
  ocre: "#85580f"
  ocre-fons: "#f4ead7"
typography:
  balanc:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.035em"
  titol:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  xifra:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22–28px"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  cos:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  gravat:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.14em"
  import:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
rounded:
  cap: "0px"
spacing:
  e1: "4px"
  e2: "8px"
  e3: "12px"
  e4: "16px"
  e5: "24px"
  e6: "32px"
  e7: "48px"
components:
  boto-primari:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.blanc}"
    rounded: "{rounded.cap}"
    height: "44px"
  boto:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.cap}"
    height: "44px"
  entrada:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.cap}"
    height: "48px"
  fila:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    height: "60px"
---

# Finances — el tall del mes

## Overview

El mateix món que les germanes, **Nutrició** i **el cos**, triat a posta perquè
les tres apps es reconeguin de la mateixa família: un catàleg (Factory Records,
Peter Saville) sobre el camp pàl·lid de la icona. Regles i alineació, cap
targeta; versaletes gravades; números tabulars com en un registre.

La peça pròpia d'aquesta app és **el tall del mes**, que és la icona feta amb
els moviments de debò:
- l'eix és el mes, de l'1 a l'últim dia;
- per sobre del nivell, el que ha entrat, acumulat dia a dia;
- per sota, en ocre, el que ha sortit;
- totes dues amb la mateixa escala, i el nivell es posa allà on hi caben
  senceres: res no s'escapça;
- els traspassos no hi compten (tampoc al balanç), i sense moviments les dues
  línies són planes. Cap cim inventat.

És una eina d'una sola persona, sobretot al mòbil: entra un avís del banc, obre
l'app al mes, mira el balanç i el tall, classifica el que hi ha per classificar
i marxa. Un sol tema, el clar.

Es refusa: el tauler bancari amb targetes, anells de pressupost i pastissos; el
mapa topogràfic de JEFE.

## Colors

- **El camp** `#e8eef0` és el fons de tot i el de la icona. `#f3f6f7` és on es
  posa el dit; `#fbfcfc`, el que està triat i els camps on s'escriu.
- **La tinta** `#0d191e` és el text i el botó primari. `#3d5560` el secundari
  (6,7:1) i `#5b717a` el que menys diu (4,6:1).
- **La rampa** `#bcced4` → `#7ab5c1` → `#1c8496` → `#054a57`. `t4` és el que
  entra (al tall, als mesos, als imports positius) i el focus.
- **L'ocre** `#85580f` (fons `#f4ead7`) té dues feines i cap de decoració:
  - és **el que surt** al tall i als mesos, com a la icona;
  - és **el que s'ha de vigilar**: un rebut que no ha arribat o que ha pujat,
    un límit passat, un balanç negatiu, un moviment per revisar, un error.
    Sempre amb paraules al costat («passat», «no ha arribat»): el color sol no
    diu res.
- Res més: cap degradat, cap color fora d'aquesta família.

## Typography

**Hanken Grotesk** sola (OFL, a `fonts/`, variable 400–600), sempre amb xifres
tabulars.

- **Balanç** 52/500: el número que has vingut a mirar.
- **Títol** 30/600: el mes o la pantalla, i alhora el botó per triar què veure.
- **Xifres** 22–28/500, tres per fila: ingressos, despeses, moviments.
- **Gravat** 12/600, versaletes amb 0,14em: etiquetes, capçaleres de secció i
  el dia als moviments. És l'únic lloc amb majúscules.
- **Cos** 16/400 a 1,45; **menut** 14; **entrades** 17 (l'iPhone no s'apropa);
  **l'import** 28 quan l'escrius.

## Layout

- Mòbil primer, columna única de 680 px com a molt, marge de 16 px.
- A ≥ 960 px, el mes en dues columnes: a l'esquerra el balanç, el tall i les
  xifres, quiets mentre baixes; a la dreta, els moviments i les categories.
- Cada secció s'obre amb un filet de tinta i un `seccio-cap` (títol en gravat a
  l'esquerra, comentari a la dreta); les files se separen amb filet `fil`.
- Una sola escala d'espai: 4 · 8 · 12 · 16 · 24 · 32 · 48 px. Tocs de 44 px com
  a mínim; les files, de 56–60.

## Elevation & Depth

Pla. Cap ombra. L'única profunditat és el full que puja des de baix (al mòbil)
o surt al mig (a l'escriptori), separat per una cortina de tinta al 44 %.

## Shapes

Cantonades rectes a tot arreu. Icones d'un sol traç d'1,6 px amb puntes
arrodonides, com les de les germanes. La marca és el tall de la icona.

## Components

- **Capçalera**: la marca («FINANCES» gravat), «+» (on no hi ha el botó gros) i
  els ajustos; a sota, les fletxes del mes a banda i banda del títol.
- **Balanç**: gravat «BALANÇ · FINS AVUI», el número gros (ocre si és
  negatiu) i la frase que el diu.
- **El tall** (`.tall`): vegeu més amunt. La llegenda diu «Entra», «Surt» i, al
  mes en curs, quin dia és avui (línia de punts).
- **Xifres** (`.xifres`): tres caselles entre filets.
- **Per classificar** (`.reclam`): una fila sencera que porta a la safata.
- **Moviment** (`.mov`): tota la fila obre el moviment; el nom, la categoria
  (i «per revisar» en ocre), l'import a la dreta (turquesa si entra).
- **Categoria** (`.cat-fila`): un filet que fa la llargada del que s'hi ha
  gastat; amb límit, una marca vertical diu on és, i passat, en ocre i amb la
  paraula «passat».
- **Vigilant** (`.vigila`): filets d'ocre; el que no ha arribat i el que ha
  pujat, amb el botó per posar-hi el preu nou.
- **Rebut fix** (`.rec-fila`): el dia del mes al davant, com un número de
  catàleg; l'estat en paraules.
- **Full** (modal): capçalera enganxada, etiquetes gravades, l'import gros amb
  el focus a dins; Escape tanca, el focus no s'escapa i torna on era.
- **Brindis**: barra de tinta a baix; ocre si és un error.

## Do's and Don'ts

- **Fes** servir filets i alineació per separar; un filet fort obre cada secció.
- **Fes** que el tall surti dels moviments i de res més.
- **Fes** que l'ocre vagi sempre amb paraules.
- **No** facis servir targetes, ombres, anells de pressupost, pastissos ni
  barres que s'omplen com una bateria.
- **No** inventis dades als dibuixos: si no n'hi ha, la línia és plana.
- **No** hi tornis a posar res del mapa topogràfic de JEFE.
- **Abans de canviar res**, mira Nutrició i el cos: les tres han de continuar
  sent germanes.
