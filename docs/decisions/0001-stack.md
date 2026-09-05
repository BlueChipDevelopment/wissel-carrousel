# ADR 0001 — Stack: Vite SPA + Supabase + Netlify, voorlopig zonder login

Status: accepted
Date: 2026-09-05

## Context

- Er was een werkende Claude-artifact (één HTML-pagina, alles in localStorage). Die is niet te
  synchroniseren tussen telefoons of coaches, en de keeperbeurten moeten juist gedeeld zijn —
  bijvoorbeeld als een andere coach een wedstrijd overneemt.
- Vier teams, ±12 coaches, allemaal vrijwilligers. Gebruik op de telefoon langs de lijn.
- Chris host op zijn eigen Supabase- en Netlify-accounts, zoals bij tri-flow en Karamoja.
- Er staan alleen voornamen van kinderen in.

## Beslissing

- **React 19 + Vite + TypeScript + Tailwind 4** als statische SPA (zoals tri-flow), met de
  conventies van KaramojaBakeries: pure domeinlogica in `src/domain/`, data alleen via
  `src/services/db/`, `CLAUDE.md`, `docs/`, migrations met RLS.
- **Supabase** (Postgres + RLS) als backend, direct vanuit de client. Geen eigen API.
- **Netlify** voor deploy; PWA via `vite-plugin-pwa`.
- **Geen login in v1.** RLS staat open voor de `anon`-rol: iedereen met de link kan lezen en
  schrijven. Bewust, op verzoek van Chris ("nog even zonder inlog, er zitten alleen voornamen in").

## Rationale

- Geen SSR nodig, dus Next.js is zwaarder dan nodig; een SPA op Netlify is de simpelste deploy.
- Supabase + RLS scheelt een backend; Chris kent het uit twee andere projecten.
- Zonder login is de drempel voor vrijwilligers nul en hoeft er geen accountbeheer te zijn.

## Consequenties

### Positief
- Eén link voor alle coaches; alles synchroon; keeperbeurten centraal.
- Demo-stand zonder credentials (`src/services/db/local.ts`) — ontwikkelen en demonstreren
  zonder Supabase.

### Negatief / risico
- **Iedereen met de link kan alle teams aanpassen.** Geen bescherming tegen vergissingen of
  kattenkwaad. De link daarom alleen in de coachesgroep delen.
- De anon key staat in de client; dat is bij Supabase normaal, maar zonder RLS-beperking is er
  geen tweede slot.

## Upgradepad: magic-link login (als het nodig blijkt)

1. Supabase Auth aanzetten (e-mail OTP). `AuthContext` zoals in tri-flow (`signInWithOtp`).
2. Tabel `team_coaches (team_id, email)`; Chris beheert die per team.
3. RLS: `select` voor `authenticated`; `insert/update/delete` op `players` en `matches` alleen
   als `auth.jwt() ->> 'email'` in `team_coaches` van dat team staat, of als admin.
4. Open policies uit `20260905120100_rls_open.sql` laten vallen in een nieuwe migration.
5. `matches.created_by uuid` toevoegen voor provenance (optioneel).

Geen datamigratie nodig; het schema blijft gelijk.

## Alternatieven

| Alternatief | Waarom niet |
|---|---|
| Artifact met Claude-database | Alleen toegankelijk binnen Chris' eigen Claude-omgeving; niet deelbaar met andere coaches. |
| Next.js (Karamoja-stijl) | Niets te server-renderen; extra complexiteit zonder winst. |
| Google Sheet | Geen veldje, geen wisselregels; rekenlogica in formules is niet te onderhouden. |
| Login vanaf dag 1 | Extra drempel en beheer voor vrijwilligers terwijl de data alleen voornamen zijn. |
