# Inrichten en deployen

Twee accounts van Chris: **Supabase** (data) en **Netlify** (hosting). Alles hieronder is
eenmalig, daarna deployt elke push naar `main` automatisch.

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

   Dit draait de drie migrations: schema, open RLS, en de seed met de vier JO8-teams.
3. Haal uit *Project Settings → API* de **Project URL** en de **anon/publishable key**.
4. Zet ze lokaal in `.env.local` (git-ignored):

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

   Zonder deze twee draait de app in **demo-stand** (localStorage). Handig om te testen.
5. Na een schemawijziging: `npm run db:types` en het gegenereerde `src/types/database.ts`
   committen.

Er is geen service-role key nodig: de app schrijft rechtstreeks als `anon` (zie ADR-0001).

## 2. Netlify

1. *Add new site → Import an existing project → GitHub* → deze repo, branch `main`. Netlify
   leest `netlify.toml` (build `npm run build`, publish `dist`, Node 22).
2. *Site configuration → Environment variables*: `VITE_SUPABASE_URL` en
   `VITE_SUPABASE_ANON_KEY` (worden bij de build ingebakken).
3. Deploy. Elke push naar `main` redeployt; PR's krijgen een deploy preview.
4. Optioneel: eigen domein via *Domain management* (CNAME naar de netlify.app-URL).

## 3. Delen met de coaches

Stuur de Netlify-URL in de coachesgroep. Op de telefoon: openen in Safari/Chrome → *Zet op
beginscherm* — dan opent hij als app. Omdat er geen login is: de link alleen binnen de
coachesgroep houden.

## Lokaal ontwikkelen

```bash
npm install          # bij 'edgesOut'-fout: npm install --legacy-peer-deps
npm run dev          # met .env.local tegen Supabase, zonder in demo-stand
npm test
```
