# CLAUDE.md — Wisselcarrousel

Startpunt voor elke Claude-sessie (Claude Code, Cowork, browser) in deze repo. Lees dit eerst.

## Wat is dit?

Opstelling- en wisselschema-app voor de JO8-teams van DEV Doorn (6 tegen 6, 4 kwarten van
10 minuten). De coach kiest zijn team, zet wie er is, en de app rekent per blok van 5 minuten
uit wie waar staat, wie op de bank zit, wie voor wie erin komt en wie wanneer keept — met een
veldje erbij. Wedstrijden worden opgeslagen zodat de keeperbeurten over het seizoen kloppen en
de "hussel"-knop wie het langst niet gekeept heeft achterin zet.

Ontstaan uit een Claude-artifact (één HTML-pagina, localStorage); de app bestaat omdat de
keeperbeurten gedeeld moeten worden over telefoons en coaches heen.

## Stack

- **React 19 + Vite 7 + TypeScript**, SPA. **Tailwind 4** (config in `src/index.css` via `@theme`).
- **Supabase** (Postgres + RLS) — Chris' account. Nog **geen login** (zie ADR-0001).
- **Netlify** — statische SPA, auto-deploy vanuit GitHub. **PWA** via `vite-plugin-pwa`.
- Tests: **Vitest** (domeinlogica volledig unit-getest) en **Playwright** (`e2e/`, demo-stand, desktop + 390 px).

## Lees hierna

1. [`docs/requirements.md`](docs/requirements.md) — wat de app doet en de rekenregels
2. [`docs/decisions/0001-stack.md`](docs/decisions/0001-stack.md) — stack, geen login, upgradepad
3. [`docs/deploy.md`](docs/deploy.md) — Supabase + Netlify inrichten

## Commands

```bash
npm install         # (bij een npm-fout over 'edgesOut': npm install --legacy-peer-deps)
npm run dev         # http://localhost:5173 — zonder .env.local in demo-stand
npm run build       # tsc -b && vite build -> dist/
npm test            # vitest run (domeinlogica)
npm run test:e2e    # playwright, in de demo-stand (eerst: npx playwright install chromium)
npm run audio       # public/kwart.mp3 opnieuw genereren (het kwart-geluid van de klok)
npm run db:push     # supabase db push (gekoppeld project)
npm run db:types    # database.ts opnieuw genereren na een schemawijziging
```

## Architectuur

```
src/
├── domain/        # PUUR: geen React, geen Supabase. schedule.ts = het rekenhart (het plan),
│                  # live.ts = de werkelijkheid tijdens de wedstrijd (herberekenen, slepen,
│                  # uitvallers, tellen), klok.ts = de wedstrijdklok. 100% getest.
│                  # De klok speelt public/kwart.mp3 (scripts/maak-kwartaudio.mjs) mee, zodat het
│                  # piepje ook klinkt met het scherm op slot.
├── services/db/   # De enige weg naar data. index.ts kiest Supabase of demo-stand (localStorage).
│                  # subscribeMatch = realtime (Supabase channel / storage-event in de demo).
├── data/seed.ts   # Seed-teams voor de demo-stand (gelijk houden met de seed-migration!)
├── components/    # Pitch (veldje, sleepbaar met pointer events, bank eronder), BlockTabs,
│                  # LivePanel (blok bezig, undo, "dit verandert", uitvallers), AttendancePanel (wie is er?), RolesPanel,
│                  # ScheduleTable (tabel op desktop, kaartjes op mobiel), MatchClock (klok; zet
│                  # het actieve én op de wedstrijddag het huidige blok mee), MinutesList,
│                  # LineupEditor, TeamNav
├── pages/         # TeamPage (opstelling), MatchesPage (geschiedenis), PlayersPage
├── hooks/         # useTeams
├── utils/         # dateUtils — datums altijd YYYY-MM-DD, nooit new Date('YYYY-MM-DD')
└── types/         # database.ts (Supabase-types, met de hand; regenereren met db:types)
supabase/migrations/   # schema, RLS (open), seed
```

### Harde regels

- **Domeinlogica blijft puur.** `src/domain/` importeert niets uit React of services. Elke
  wijziging aan de rekenregels krijgt een test in `schedule.test.ts`.
- **Geen `supabase.*` buiten `src/services/db/`.** Pages en components praten met `db` uit
  `@/services/db` (interface `DataSource`). De demo-stand (`local.ts`) moet blijven werken —
  dat is ook hoe je ontwikkelt zonder credentials.
- **Datums** als `YYYY-MM-DD` tekst (Postgres `date`). Zie `src/utils/dateUtils.ts`.
- **Nederlandse UI**, alleen voornamen van spelers. Mobile-first: test op 390px en 1100px.
- **Seed op twee plekken** (`src/data/seed.ts` en de seed-migration) — gelijk houden.

### De rekenregels in één alinea

`achter[]` is de keepervolgorde (index 0 keept kwart 1, index 3 keept kwart 4); `voor[]` is de
opstelling voorin (linksvoor, spits, rechtsvoor, daarna de wissel). Wie erin komt neemt de plek
over van wie eruit gaat (`vulSlots`). In de stand `vrij` zijn er geen linies: `achter[]` is alleen
de keeperlijst en `VRIJ8` (`blokkenVrij`) laat de bank over iedereen rouleren. In de 5-minutenstand met 4 achterin bepaalt `BANK4` wie
wanneer op de bank zit, zó dat niemand op de bank zit direct vóór of ná zijn keepersbeurt,
niemand twee blokjes achter elkaar zit, en iedereen op 30 minuten uitkomt. Keeperbeurten worden
niet apart bijgehouden maar afgeleid uit de werkelijke keepers (`matches.keepers`, door de app
geschreven uit de live-stand; oude wedstrijden: `achter[0..3]`) van gespeelde wedstrijden
(`keeperTally` met `keepersVan`, en de view `keeper_counts`).

**Live** (`live.ts`): het plan blijft het anker; `Live` = huidig blok (alles ervoor ligt vast),
werkelijke bezetting per blok, handmatig gezette blokken en beschikbaarheid per speler.
`herbereken()` bepaalt alleen de resterende, niet-handmatige blokken opnieuw: keeper per kwart,
bank per blok (plan minus wie er niet is), dan ruilen tot niemand meer dan één blok voorligt,
dan plekken via `vulSlots`. Zonder wijzigingen komt er bij 8 spelers precies het plan uit. De
UI toont altijd `samengesteld(plan, live ?? nieuwLive(plan))`. Slepen in blok 1 zolang dat het
huidige blok is (vóór de aftrap) past het plan aan (`zetOpPlekInPlan`), geen live-wissel. Live-acties slaan direct op
(debounce) en gaan via realtime naar de andere telefoons; last-write-wins op `updated_at`.

## Toegang (belangrijk)

Er is **geen login**; RLS staat open voor `anon`. Iedereen met de link kan alle teams lezen en
schrijven. Bewuste keuze (alleen voornamen, kleine groep coaches). Het upgradepad naar
magic-link login staat in ADR-0001 — voeg dan `team_coaches` toe en vervang de open policies.

## Waar de app vandaan komt

De oorspronkelijke artifact (met identieke rekenlogica in JavaScript) staat in Chris' Claude-
omgeving; de logica hier is daar een 1-op-1 port van, plus tests.
