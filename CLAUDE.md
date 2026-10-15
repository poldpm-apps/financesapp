# Instruccions per a Claude Code

## Sincronització amb GitHub: automàtica, sempre

En Pol treballa des de diversos ordinadors (la torre, portàtils, el mòbil).
GitHub és l'única còpia que veuen tots. Per tant, **sense que ho demani**:

- **En començar** qualsevol conversa: `git pull` abans de tocar res. Si hi ha
  canvis locals sense desar o un conflicte, atura't i explica-li-ho.
- **En acabar cada canvi** (fet i comprovat): commit amb un missatge clar en
  català i `git push`. No cal preguntar-ho.
- ⚠ Si el repositori publica una web (GitHub Pages), **el push la publica**:
  famílies i mestres la veuen al moment. Push només quan el canvi està acabat
  i verificat, mai a mig fer.
- Si el pull o el push fallen, digues-ho clarament: si no, el canvi es queda
  en un sol ordinador i en Pol no ho sabrà.

## Aquesta app

- És l'apartat de Finances de JEFE, com a app pròpia. **Res de funcions
  noves**: si alguna cosa no es pot fer igual, s'atura i es pregunta.
- **Les dades no es mouen ni s'esborren mai.** El banc només dona 90 dies
  enrere: el que és més vell no es pot tornar a baixar. El full de JEFE és la
  còpia de seguretat i no es toca.
- **Els rebuts fixos no escriuen res** amb el banc connectat
  (`generaRecurrents` torna la llista buida). Hi ha una prova que ho vigila.
- L'escala del `WRONG_TRANSACTIONS_PERIOD` (422) i `arreglaClauBanc()` es
  queden com són.
- El disseny és «el tall del mes», germà de Nutrició i del cos: vegeu
  `DESIGN.md`. Abans de canviar-lo, mira les germanes.
- `npm run comprova` ha de dir «Tot correcte» abans de cada commit.
