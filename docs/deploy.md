# Inrichten en deployen

Twee accounts van Chris: **Supabase** (data) en **Netlify** (hosting). Alles hieronder is
eenmalig.

> **Let op (sinds sept 2026):** de GitHub-koppeling van Netlify is kapot ("Host key
> verification failed"), dus een push naar `main` deployt **niet**. Na elke push zelf:
>
> ```bash
> npm run build && npx netlify deploy --prod --dir dist
> curl -s https://wisselcarrousel.netlify.app/ | grep -o "index-[A-Za-z0-9_-]*\.js"   # nieuwe bundel?
> ```
>
> Herstellen kan in Netlify onder *Build & deploy → Continuous deployment*.

## 1. Supabase

1. Maak een nieuw project aan (dashboard → *New project*), regio West-EU. Onthoud het
   database-wachtwoord.
2. Koppel de repo aan het project en push het schema:

   ```bash
   npx supabase login
   npx supabase init      # maakt supabase/config.toml aan (migrations blijven staan)
   npx supabase link --project-ref <project-ref>
   npm run db:push
   ```

   Dit draait de migrations: schema, open RLS, de seed met de vier JO8-teams, en de
   live-stand (`matches.live`, `matches.keepers`, realtime op `matches`), de historie
   (`match_history`, gevuld door een trigger op `matches`; alleen echte wijzigingen, nieuwste
   200 per wedstrijd) en `teams.is_test` voor het e2e-sandboxteam. Realtime moet in het project
   aanstaan (*Database → Publications → supabase_realtime*); de migration voegt `matches`
   aan die publicatie toe. Kijk vóór een push wat er meegaat:
   `npx supabase db push --dry-run`.

   **Historie terugzoeken** (SQL Editor), bijvoorbeeld alle versies van één wedstrijd:

   ```sql
   select saved_at, actie, achter, keepers, live->'huidig' as huidig, live->'handmatig' as handmatig
   from match_history
   where match_date = '2026-09-12' and team_id = '<team-id>'
   order by saved_at;
   ```
3. Haal uit *Project Settings → API* de **Project URL** en de **anon/publishable key**.
4. Zet ze lokaal in `.env.local` (git-ignored):

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

   Zonder deze twee draait de app in **demo-stand** (localStorage). Handig om te testen.
5. Na een schemawijziging: `npm run db:types` en het gegenereerde `src/types/database.ts`
   committen.

De app heeft geen service-role key nodig: hij schrijft rechtstreeks als `anon` (zie ADR-0001).
Alleen de database-e2e-suite gebruikt er een (`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`,
zie `docs/testing.md`); Vite geeft die niet door aan de app, want hij begint niet met `VITE_`.

## 2. Netlify

1. *Add new site → Import an existing project → GitHub* → deze repo, branch `main`. Netlify
   leest `netlify.toml` (build `npm run build`, publish `dist`, Node 22).
2. *Site configuration → Environment variables*: `VITE_SUPABASE_URL` en
   `VITE_SUPABASE_ANON_KEY` (worden bij de build ingebakken).
3. Deploy. Zolang de GitHub-koppeling kapot is: handmatig (zie de let-op bovenaan).
4. Optioneel: eigen domein via *Domain management* (CNAME naar de netlify.app-URL).

## 3. Delen met de coaches

Stuur de Netlify-URL in de coachesgroep. Op de telefoon: openen in Safari/Chrome → *Zet op
beginscherm* — dan opent hij als app. Omdat er geen login is: de link alleen binnen de
coachesgroep houden.

## 4. Programma invoeren (per competitiefase)

Het programma komt van voetbal.nl; daar heten de teams O8 in plaats van JO8. Alleen de JO8-teams
(KickStars niet). Op de programmapagina: *Mijn team* en daarna *Toon volledig programma*.

| App | voetbal.nl |
|---|---|
| JO8-1 | [DEV Doorn O8-1](https://www.voetbal.nl/team/T1453267252/programma) |
| JO8-2 | [DEV Doorn O8-2](https://www.voetbal.nl/team/T1046593671/programma) |
| JO8-3 | [DEV Doorn O8-3](https://www.voetbal.nl/team/T1978676792/programma) |
| JO8-4 | [DEV Doorn O8-4JM](https://www.voetbal.nl/team/T1082827297/programma) |

Per wedstrijd een rij in `matches` (één per team per dag):

- `opponent` = `Tegenstander (thuis|uit HH:MM)`, bijv. `DOSC O8-2 (uit 08:30)`;
- `achter`, `voor`, `wissel`, `formatie` = die van de laatste wedstrijd ervóór (zoals
  `maakDraft` in `TeamPage` doet), nieuwe actieve spelers achteraan in `voor`;
- een datum die al bestaat overslaan (`on_conflict=team_id,match_date` +
  `resolution=ignore-duplicates`), nooit overschrijven.

Een afgelaste wedstrijd verwijder je op de pagina Wedstrijden: blijft hij staan, dan tellen na
die datum de eerste vier achterin als keepers mee.

## Lokaal ontwikkelen

```bash
npm install          # bij 'edgesOut'-fout: npm install --legacy-peer-deps
npm run dev          # met .env.local tegen Supabase (= productie!), zonder in demo-stand
npm test
```

`.env.local` wijst naar de productiedatabase. Handmatig testen doe je dus in de demo-stand
(`VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite`) of in het sandboxteam via
`npm run test:e2e:db` — zie `docs/testing.md`.
