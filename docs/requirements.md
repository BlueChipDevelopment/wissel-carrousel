# Requirements — Wisselcarrousel

Status: v1 (sept 2026). Gebruikers: de coaches van de vier JO8-teams van DEV Doorn.

## Spelregels waar alles op rust

- KNVB O8/O9: **6 tegen 6** (keeper + 5), kwartveld 42,5 × 30 m, **2 × 20 minuten** met een
  time-out halverwege elke helft — in de praktijk dus **4 kwarten van 10 minuten**.
  Doorwisselen is onbeperkt.
- Met 8 spelers: 6 slots × 40 min = 240 speelminuten ÷ 8 = **30 minuten per speler**, 10 op de bank.

## Het model

- Per wedstrijd twee vaste linies: **4 achterin** (keeper + 2 verdedigers + 1 wissel) en
  **4 voorin** (3 op het veld + 1 wissel). Formatie 1-2-3 of 1-2-1-2 (verandert alleen de
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
3. Aanwezigheid aantikken; linies ordenen; wisselstand en formatie kiezen; eventueel husselen.
4. Per blok: veldje, rollen, bank met bestemming, en "wie voor wie" bij de start van dat blok.
5. Hele wedstrijd in één tabel + speelminuten per speler.
6. **Opslaan** → de wedstrijd telt vanaf de wedstrijddag mee in de keeperbeurten.
7. Wedstrijden & keeperbeurten: geschiedenis per team, teller per speler, wedstrijd verwijderen.
8. Spelers: toevoegen, hernoemen, uit de selectie halen (geschiedenis blijft).

## Buiten scope v1

- Login / rechten (zie ADR-0001 voor het upgradepad).
- Offline schrijven (de app-shell werkt offline; data heeft netwerk nodig).
- Meerdere clubs, seizoenswissel (teams worden via migrations/SQL beheerd).
- Timer langs de lijn.
