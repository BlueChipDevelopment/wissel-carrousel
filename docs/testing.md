# Testen

Drie lagen, van snel naar echt:

| Commando | Wat | Waartegen |
|---|---|---|
| `npm test` | Vitest: de rekenregels in `src/domain/` | niets — puur |
| `npm run test:e2e` | Playwright in de **demo-stand** (localStorage), desktop 1100 px + telefoon 390 px | niets — Vite met lege Supabase-variabelen |
| `npm run test:e2e:db` | Playwright tegen de **echte Supabase**, in het sandboxteam "E2E" | de productiedatabase, alleen team `is_test` |

De demo-suite is snel en draait overal. De database-suite vangt wat de demo-stand niet kan
nabootsen: realtime tussen twee telefoons, de optimistic locking op `updated_at` (ook de
unique-violation bij een nieuwe wedstrijd), RLS en de historie-trigger.

## Database-suite (`e2e/db/`)

### Vereisten

- `npx playwright install chromium`
- De migraties staan op de database (`npm run db:push`), in elk geval `teams_is_test`.
- In `.env.local` (gitignored), naast de twee `VITE_`-variabelen:

```
SUPABASE_SERVICE_ROLE_KEY=<npx supabase projects api-keys --project-ref zelxnjbntelzjknxpmwm>
```

Vite geeft alleen `VITE_`-variabelen door aan de app; de service-role key blijft in het
testproces.

### Hoe het werkt

- **Sandboxteam.** `global-setup.ts` maakt team `E2E` (`is_test = true`, vaste id
  `…0000000000e2`) met acht vaste spelers aan of zet het terug. Staat er op dat id een team
  *zonder* `is_test`, dan stopt de suite in plaats van te schrijven (vangrail).
- **Onzichtbaar voor coaches.** `listTeams` laat `is_test`-teams alleen zien met de
  localStorage-vlag `wisselcarrousel.testteams = 1`; de fixture zet die in elke testbrowser.
  Een test controleert dat een browser zonder vlag het team niet ziet.
- **Reset per test.** Elke test begint met een leeg sandboxteam: wedstrijden, historie en
  gastspelers weg, de vaste spelers terug (fixture `sandbox`, automatisch). `global-teardown.ts`
  doet hetzelfde na afloop, zodat er geen testwedstrijden blijven staan.
- **Wat hij al vond.** De eerste run ving dat een realtime-DELETE nooit aankwam: Supabase kan
  deletes niet filteren, dus een kanaal met `team_id=eq.…` krijgt ze niet. De demo-stand kon
  dat niet laten zien.
- **Datums in 2019** (`E2E_DATUM`): botsen nooit met een echte wedstrijd.
- **De database is de waarheid.** Controles lezen de rij via de service-role client
  (`helpers/db.ts`), niet alleen wat de UI toont.
- **Serieel** (`workers: 1`): één gedeeld team, één database.

### Wat wordt getest

| Spec | Bewijst |
|---|---|
| `opslaan` | Opstelling, keepers, tegenstander en afwezig komen goed in `matches`; één historierij; een opslag zonder echte wijziging geeft geen nieuwe historierij |
| `telefoons` | Een sleep komt via realtime op de andere telefoon; twee telefoons met een nieuwe of bestaande wedstrijd krijgen een conflict in plaats van een stille overschrijving; "toch mijn versie" overschrijft bewust; verwijderd op een andere telefoon geeft een melding en wordt niet stil teruggezet; een andere wedstrijd verwijderen raakt de open wedstrijd niet |
| `keepers` | Corrigeren zet `keepers_vast`, "terug naar geteld" leidt weer af; een keeperswissel halverwege een kwart schuift het corrigeerscherm niet op |
| `uitslagen` | Uitslag invullen schrijft `goals_voor`/`goals_tegen`; opstelling opslaan laat ze staan; de database weigert een halve uitslag |
| `regressies` | Gastspeler na het opslaan; sandboxteam onzichtbaar zonder vlag; vangrail |

### Niet getest

De wedstrijdklok met het scherm op slot (audio), de PWA/service worker, en echte netwerkfouten.
