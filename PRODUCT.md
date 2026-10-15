# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Una sola persona: en Pol del Pozo. L'app és seva i de ningú més. La fa servir
sobretot des del mòbil —quan arriba un avís del banc, o a final de mes per
veure com ha quedat— i de tant en tant a l'escriptori.

## Product Purpose

Les finances del mes, connectades al banc: el que entra, el que surt, el que
queda. Surt de l'apartat de Finances de JEFE i ha de fer **exactament el
mateix**:

- moviments del mes, amb ingressos, despeses, traspassos i balanç;
- la connexió amb el banc (Enable Banking, PSD2), tres mirades al dia;
- categories pròpies, amb emoji i límit mensual;
- la safata de **Revisar**: per comerç i d'un en un, amb memòria del que ja
  s'ha classificat abans;
- els **rebuts fixos**: proposa els que es repeteixen de debò (mateix import,
  mateixa empresa) i en Pol els accepta o els descarta;
- el **vigilant**: avisa del que no ha arribat i del que ha arribat diferent;
- el **patrimoni**: actius, valors i històric;
- importar les dades de l'app de finances antiga.

Èxit: saber d'un cop d'ull com va el mes, classificar el que entra d'un sol toc
i assabentar-se a temps d'un rebut que no ha arribat o que ha pujat.

## Positioning

No és una app de banc ni un tauler de pressupostos. És el quadern d'una persona
que vol veure el seu mes com un tall: per sobre el que entra, per sota el que
surt.

## Operating Context

- Les dades viuen en un full de càlcul de Google propi (copiat del de JEFE, que
  es queda intacte de còpia de seguretat). El servidor és Apps Script; la
  pantalla la serveix GitHub Pages a `poldpm.github.io/financesapp`,
  instal·lable al mòbil.
- **El banc només dona 90 dies enrere.** El que és més vell que això no es pot
  tornar a baixar: si es perd del full, es perd. Les dades mai es mouen ni
  s'esborren; es copien i es comproven.
- Els rebuts fixos **no escriuen res** amb el banc connectat: la font és el
  banc; ells només vigilen.

## Capabilities and Constraints

- Res de funcions noves respecte de JEFE; el que no es pugui fer igual, s'atura
  i es pregunta.
- Cap credencial al codi ni al repositori: tot a Propietats de l'script.
- Cap dada d'exemple que es pugui confondre amb les seves.
- En Pol no paga res: ni subscripcions ni pagaments únics.

## Design

Vegeu `DESIGN.md`: «el tall del mes», germà de Nutrició i del cos.
