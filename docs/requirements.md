# Requirements — Wisselcarrousel

Status: v1 (sept 2026). Gebruikers: de coaches van de vier JO8-teams van DEV Doorn.

## Spelregels waar alles op rust

- KNVB O8/O9: **6 tegen 6** (keeper + 5), kwartveld 42,5 × 30 m, **2 × 20 minuten** met een
  time-out halverwege elke helft — in de praktijk dus **4 kwarten van 10 minuten**.
  Doorwisselen is onbeperkt.
- Met 8 spelers: 6 slots × 40 min = 240 speelminuten ÷ 8 = **30 minuten per speler**, 10 op de bank.

## Het model

- Per wedstrijd twee vaste linies: **4 achterin** (keeper + 2 verdedigers + 1 wissel) en
  **4 voorin** (3 op het veld + 1 wissel). Formatie 1-2-3, 1-2-1-2 of 1-2-2-1 (verandert alleen de
  drie plekken voorin).
- De **keeper komt uit de achterhoede en wisselt elk kwart** — met 4 achterin keept dus
  iedereen daar precies één kwart, ook de wissel.
- De linies worden **wekelijks gehusseld** door de coach; de app helpt door wie het langst niet
  gekeept heeft achterin te zetten.
- **Bankbeurten** in twee standen:
  - *elke 5 minuten* (standaard): 8 blokjes; iedereen zit 2 × 5 minuten;
  - *per kwart*: 4 blokken; iedereen zit 1 × 10 minuten.
- **Niet koud worden** (5-minutenstand, 4 achterin): niemand zit op de bank in het blokje
  direct vóór of ná zijn keepersbeurt, want dan sta je 15 minuten achter elkaar stil. Ook zit
  niemand twee blokjes achter elkaar. De tabel `BANK4 = [2,3,2,0,3,1,0,1]` (index in de
  keepervolgorde per blok) is de enige verdeling die dat allemaal haalt; de tests bewaken het.
- **Vaste plekken**: wie erin komt, neemt de plek over van wie eruit gaat. De rest blijft staan.
  Bij een keeperswissel schuift de oude keeper naar de vrijgekomen verdedigersplek.
- **Volgorde stuurt alles**: `achter[]` = keepervolgorde (K1..K4); `voor[]` = opstelling
  (linksvoor, spits, rechtsvoor, wissel-bij-start). Herordenen met ↑/↓ verandert dus wie
  wanneer keept resp. wie waar staat.
- **Andere bezettingen** (6, 7, 9 spelers) rekent de app door met een waarschuwing dat de
  bankbeurten niet meer gelijk zijn. Met 3 in een linie zit daar niemand.

## Wat de coach ziet en doet

1. Team kiezen (JO8-1 … JO8-4).
2. Wedstrijddatum (standaard de eerstvolgende opgeslagen wedstrijd, anders komende zaterdag);
   tegenstander optioneel.
3. Aanwezigheid aantikken (direct onder de wedstrijdkop; tijdens de wedstrijd één regel); linies ordenen; wisselstand en formatie kiezen; eventueel husselen.
4. Per blok: veldje, rollen, bank met bestemming, en "wie voor wie" bij de start van dat blok.
5. Hele wedstrijd in één tabel + speelminuten per speler.
6. **Opslaan** → de wedstrijd telt vanaf de wedstrijddag mee in de keeperbeurten.
6a. **Langs de lijn**: klok starten, slepen op het veld, uitvallers en laatkomers aangeven;
    de rest rekent mee en staat meteen op de telefoon van de andere coach (zie "Live").
7. Wedstrijden & keeperbeurten: geschiedenis per team, teller per speler, wedstrijd verwijderen.
8. Spelers: toevoegen, hernoemen, uit de selectie halen (geschiedenis blijft).

## Live tijdens de wedstrijd (v1.1)

Het **plan** (linies, volgorde, stand, formatie) blijft het anker; daarnaast houdt de app de
**werkelijkheid** bij (`Live` in `src/domain/live.ts`, opgeslagen in `matches.live`):

- **Vastgelegd en aanpasbaar.** Het blok dat bezig is (`huidig`) schuift mee met de klok op de
  wedstrijddag, of met ‹ › in de live-balk. Blokken ervoor zijn historie en niet meer te
  wijzigen; het huidige en de komende blokken wel.
- **Slepen op het veld.** Speler van de bank naar een plek, twee plekken ruilen, iemand op goal,
  of naar de bank. Werkt met pointer events (ook op de telefoon). Het blok wordt dan
  *handmatig* en blijft staan bij latere herberekeningen.
- **Uitvallen en later komen.** Per speler een venster "valt uit vanaf …" of "komt vanaf …".
  Een speler die volgens het plan afwezig was en toch komt, gaat achteraan in de kortste linie
  (dus zonder keeperbeurt).
- **Herberekenen** van alleen de resterende, niet-handmatige blokken, met zo min mogelijk
  verandering ten opzichte van het plan:
  1. keeper per kwart: binnen een kwart blijft de keeper (tenzij uitgevallen); een nieuw kwart
     krijgt de eerste uit `achter` die deze wedstrijd nog niet gekeept heeft, anders wie het
     minst gekeept heeft;
  2. bank per blok: het plan minus wie er niet is; te veel op de bank → wie het minst speelt
     gaat spelen, te weinig → wie (naar verwachting) het meest speelt gaat zitten. Niemand zit
     twee blokken achter elkaar en in de 5-minutenstand niemand vlak vóór of ná zijn keepersbeurt;
  3. eerlijk maken: zolang speler X meer dan één blok voorligt op speler Y, ruilen ze in het
     eerste blok waar Y zit en X speelt (als de regels hierboven dat toelaten). Zo komt met
     7 spelers iedereen op 30 of 35 uit, ook over de linies heen;
  4. plekken: wie erin komt neemt de plek over van wie eruit gaat, bij voorkeur in de eigen linie.
  Zonder wijzigingen komt hier bij 8 spelers precies het plan uit (getest).
- **Dit verandert.** Na elke actie staat er per blok wie van plek verandert; met **Ongedaan**
  zet je de laatste wijziging terug (ook een uitvaller of een planwijziging tijdens de wedstrijd).
- **Tellen uit de werkelijkheid.** Speeltijd en keeperbeurten komen uit de werkelijke blokken.
  Per kwart telt elke keeper één beurt (bij een keeperswissel halverwege dus twee). De app
  schrijft ze in `matches.keepers`; oudere wedstrijden vallen terug op `achter[0..3]`.
- **Beide coaches zien hetzelfde.** Elke live-actie wordt direct opgeslagen en via Supabase
  realtime naar de andere telefoons gestuurd; de nieuwste `updated_at` wint. Staan er op een
  telefoon nog niet-opgeslagen planwijzigingen, dan krijgt die een melding met "Die versie
  ophalen". Planwijzigingen (linies, stand, formatie) sla je zoals altijd zelf op.
- Wissel je van bankstand (5 min ↔ kwart) terwijl er een live-stand is, dan begint die opnieuw.

## De klok in de broekzak

Met het scherm op slot zet de browser JavaScript stil, dus een piepje uit code hoor je dan
niet. Daarom speelt de klok bij Start een audiobestand van precies één kwart af
(`public/kwart.mp3`, gemaakt met `npm run audio`): stilte, een piep op 5:00, een dubbele piep
op 10:00. De audiospeler van de telefoon houdt de tijd bij en speelt door met het scherm op
slot. Pauze en Reset stoppen het; Verder hervat op de klokstand. Zolang de klok loopt blijft
het scherm aan (Wake Lock) als de telefoon in beeld is. Trillen werkt alleen met de app in
beeld. Geen notificaties, geen server. Het bestand zit in de PWA-cache voor velden zonder bereik.

## Buiten scope v1

- Login / rechten (zie ADR-0001 voor het upgradepad).
- Offline schrijven (de app-shell werkt offline; data heeft netwerk nodig).
- Meerdere clubs, seizoenswissel (teams worden via migrations/SQL beheerd).
- Rechten op wie live mag aanpassen (iedereen met de link kan dat, zoals alles).
