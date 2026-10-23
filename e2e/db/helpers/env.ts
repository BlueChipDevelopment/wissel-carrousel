import fs from 'node:fs'
import path from 'node:path'

// Playwright leest .env.local niet zoals Vite; hier laden. Het bestand staat in .gitignore en
// bevat de Supabase-URL, de anon key en (alleen voor deze suite) de service-role key.
let geladen = false
function laadEnv(): void {
  if (geladen) return
  geladen = true
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return
  for (const regel of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(regel)
    if (!m) continue
    const [, key, raw] = m
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^["']|["']$/g, '')
  }
}

export function vereist(naam: string): string {
  laadEnv()
  const v = process.env[naam]
  if (!v) throw new Error(`${naam} ontbreekt — zet hem in .env.local (zie docs/testing.md)`)
  return v
}

/** Het sandboxteam: is_test = true, onzichtbaar voor coaches. De suite schrijft alleen hierin. */
export const E2E_TEAM = {
  id: '00000000-0000-4000-8000-0000000000e2',
  slug: 'e2e',
  name: 'E2E',
}

/** Vaste spelers van het sandboxteam, in deze volgorde: 4 achterin, 4 voorin. */
export const E2E_SPELERS = ['Anna', 'Bram', 'Cas', 'Dirk', 'Eva', 'Finn', 'Gijs', 'Hanna'].map((name, i) => ({
  id: `00000000-0000-4000-80e2-${String(i + 1).padStart(12, '0')}`,
  name,
}))

// Een zaterdag ver in het verleden: botst nooit met een echte wedstrijd, ook niet als iemand
// het sandboxteam toch handmatig opent.
export const E2E_DATUM = '2019-01-05'
export const E2E_DATUM_2 = '2019-01-12'
