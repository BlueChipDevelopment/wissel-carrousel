# Live aanpassen tijdens de wedstrijd + slepen op het veld

Datum: 2026-09-08. Status: uitgevoerd op branch `feature/live-wissels`.

## Doel

De coach kan tijdens de wedstrijd afwijken van het geplande wisselschema (speler valt uit, komt
later, coach zet iemand anders erin) zonder dat de rest van de wedstrijd oneerlijk wordt, en
beide coaches zien hetzelfde op hun telefoon.

## Model: plan en werkelijkheid

- **Plan** = `Opstelling` (achter/voor/wissel/formatie) → `blokken(plan)`. Onveranderd.
- **Werkelijkheid** = `Live` (`src/domain/live.ts`):
  - `huidig`: index van het blok dat nu gespeeld wordt. Blokken ervoor zijn **vastgelegd**.
  - `blokken[]`: per blok keeper, 5 veldplekken (`verdedigers[2]`, `aanval[3]`, `''` = leeg) en bank.
  - `handmatig[]`: blokken die de coach zelf gezet heeft; die blijven staan bij een herberekening.
  - `beschikbaarheid`: per speler `{ vanaf?, tot? }` (blokindices, half-open).
- `live` is `null` tot de eerste live-actie; dan is het plan de werkelijkheid.
- `samengesteld(plan, live)` levert `Blok[]` voor alle bestaande componenten.

## Herberekenen (`herbereken(plan, live, vanaf)`)

Alleen blokken `>= vanaf` (en niet handmatig) worden opnieuw bepaald. Het **plan** is de basis
voor die blokken (niet de vorige live-stand), zodat een teruggedraaide wijziging het plan
exact herstelt en de uitkomst niet afhangt van de volgorde van eerdere acties:

1. **Keeper per kwart**: binnen een kwart blijft de keeper (tenzij uitgevallen). Nieuw kwart:
   eerste uit `achter` (planvolgorde) die deze wedstrijd nog niet gekeept heeft; anders wie het
   minst gekeept heeft. Zonder achterspelers: uit `voor`.
2. **Bank per blok**: begin met de plan-bank ∩ beschikbaar, minus wie koud zou worden; te veel →
   wie (naar verwachting: gespeeld + rest van het plan) het minst speelt gaat spelen; te weinig →
   wie het meest speelt gaat zitten. Randvoorwaarden: niet twee blokken achter elkaar, en in de
   5-minutenstand niet vlak vóór/ná de eigen keepersbeurt.
3. **Eerlijk maken**: zolang speler X meer dan één blok voorligt op speler Y, ruil in het eerste
   blok waar Y zit en X speelt (mits de randvoorwaarden dat toestaan).
4. **Plekken**: `vulSlots` over de 5 veldplekken vanaf het laatste vastgelegde blok; achterin-spelers
   eerst. Zo neemt wie erin komt de plek over van wie eruit gaat, ook over de linies heen (7 spelers).

Zonder wijzigingen levert dit exact het plan op (getest voor 8 spelers in beide standen).

## Acties

- `wisselPlek(plan, live, h, a, b)`: ruil twee spelers in blok h (bank↔veld, veld↔veld, goal).
  Blok h wordt handmatig; herberekening vanaf h+1.
- `zetBeschikbaarheid(plan, live, speler, {vanaf|tot})`: herberekening vanaf `max(huidig, blok)`.
- `zetHuidig(live, h)`: vastleggen t/m h-1. De klok zet dit vooruit (alleen op de wedstrijddag).
- `verschillen(oud, nieuw, formatie)`: per blok wie van plek verandert — getoond na elke actie.
- Undo: stapel van snapshots in de pagina; "Maak ongedaan" zet de vorige terug en slaat op.

## Tellen

Keeperbeurten en speelminuten komen uit `samengesteld(plan, live)`. Per kwart telt elke
(onderscheiden) keeper één beurt. `matches.keepers uuid[]` bewaart dat; de view `keeper_counts`
valt terug op `achter[1:4]` voor oude wedstrijden.

## Opslag en sync

- `matches.live jsonb` (het `Live`-object) en `matches.keepers uuid[]`; migration
  `20260908120000_live.sql` zet ook `matches` in de realtime-publicatie.
- Elke live-actie slaat direct op (debounce 400 ms). Planwijzigingen blijven handmatig opslaan.
- `db.subscribeMatch(teamId, date, cb)`: Supabase `postgres_changes` op `matches`; in de
  demo-stand het `storage`-event. Last-write-wins op `updated_at`: een nieuwere rij vervangt de
  lokale stand, tenzij er niet-opgeslagen planwijzigingen zijn (dan een melding met "Ophalen").

## Slepen

Eigen pointer-events in de `Pitch`-SVG (geen HTML5 DnD, geen extra dependency): de bank staat
onder het veld in dezelfde SVG. Slepen van een marker naar een andere marker of lege plek roept
`onWissel(a, b)` aan. Alleen in blokken `>= huidig`.
