# Wisselcarrousel

Opstelling en wisselschema voor 6-tegen-6-jeugdvoetbal (KNVB O8/O9), gemaakt voor de JO8-teams
van DEV Doorn. Langs de lijn op je telefoon: welk blok is het, wie staat waar, wie komt voor
wie erin, en wie gaat er op goal.

## Wat doet het?

- **Vier kwarten, elk kwart een andere keeper**, iedereen precies evenveel speeltijd.
- **Wisselen per 5 minuten** (of per kwart), zó dat niemand lang stilzit en achterin geen
  bankbeurt grenst aan een keepersbeurt — je gaat warm het doel in en warm het veld weer op.
- **Wie voor wie**: bij elk wisselmoment staat wie erin komt, voor wie, en op welke plek; op de
  bank zie je alvast waar je straks heen gaat.
- **Veldje** met de opstelling per blok, plus de hele wedstrijd in één tabel.
- **Keeperbeurten** worden over het seizoen bijgehouden; de hussel-knop zet wie het langst niet
  gekeept heeft achterin.
- Meerdere teams in één app; spelers zelf beheren.

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind 4, installeerbaar als PWA
- **Backend:** Supabase (Postgres + RLS)
- **Deploy:** Netlify (statische SPA)

## Setup

```bash
npm install
cp .env.example .env.local   # Supabase URL + anon key invullen (zonder: demo-stand)
npm run dev                  # http://localhost:5173
npm test                     # domeintests
npm run build                # productiebuild in dist/
```

Zie [`docs/deploy.md`](docs/deploy.md) voor het inrichten van Supabase en Netlify, en
[`CLAUDE.md`](CLAUDE.md) voor de architectuur en de regels van de codebase.
