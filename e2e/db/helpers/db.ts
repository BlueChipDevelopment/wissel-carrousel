import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { E2E_SPELERS, E2E_TEAM, vereist } from './env'

// Service-role client voor klaarzetten, controleren en opruimen. Hij omzeilt RLS, dus hij
// wordt ALLEEN vanuit het testproces gebruikt — nooit vanuit iets dat de app meelevert.
let admin: SupabaseClient | null = null
export function db(): SupabaseClient {
  admin ??= createClient(vereist('VITE_SUPABASE_URL'), vereist('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  return admin
}

/**
 * Sandboxteam en zijn spelers aanmaken of terugzetten. Idempotent; draait vóór de suite.
 * Vangrail: staat er op dit id een team zonder is_test, dan stoppen we in plaats van te schrijven.
 */
export async function zetSandboxKlaar(): Promise<void> {
  const { data: bestaand, error: leesFout } = await db().from('teams').select('id, is_test').eq('id', E2E_TEAM.id).maybeSingle()
  if (leesFout) {
    throw new Error(`teams lezen: ${leesFout.message}. Is de migratie teams_is_test al uitgevoerd (npm run db:push)?`)
  }
  if (bestaand && bestaand.is_test !== true) {
    throw new Error(`Team ${E2E_TEAM.id} bestaat zonder is_test — de e2e-suite weigert daarin te schrijven`)
  }
  const { error: teamFout } = await db()
    .from('teams')
    .upsert({ ...E2E_TEAM, club: 'E2E', season: 'test', sort_order: 99, is_test: true })
  if (teamFout) throw new Error(`sandboxteam aanmaken: ${teamFout.message}`)
  await resetSandbox()
}

/** Alles wat de suite in het sandboxteam kan hebben geschreven weg, de vaste spelers terug. */
export async function resetSandbox(): Promise<void> {
  await bevestigSandbox()
  const team = E2E_TEAM.id
  await verplicht(db().from('matches').delete().eq('team_id', team), 'wedstrijden opruimen')
  await verplicht(db().from('match_history').delete().eq('team_id', team), 'historie opruimen')
  const vast = E2E_SPELERS.map((p) => p.id)
  await verplicht(db().from('players').delete().eq('team_id', team).not('id', 'in', `(${vast.join(',')})`), 'gastspelers opruimen')
  await verplicht(
    db()
      .from('players')
      .upsert(E2E_SPELERS.map((p, i) => ({ ...p, team_id: team, active: true, sort_order: i + 1 }))),
    'spelers terugzetten',
  )
}

async function bevestigSandbox(): Promise<void> {
  const { data } = await db().from('teams').select('is_test').eq('id', E2E_TEAM.id).single()
  if (data?.is_test !== true) throw new Error('Het sandboxteam heeft geen is_test — opruimen geweigerd')
}

async function verplicht(q: PromiseLike<{ error: { message: string } | null }>, wat: string): Promise<void> {
  const { error } = await q
  if (error) throw new Error(`${wat}: ${error.message}`)
}

export interface MatchRij {
  id: string
  match_date: string
  opponent: string | null
  achter: string[]
  voor: string[]
  afwezig: string[]
  keepers: string[]
  keepers_vast: boolean
  goals_voor: number | null
  goals_tegen: number | null
  live: { huidig: number; blokken: unknown[] } | null
  updated_at: string
}

/** De wedstrijd zoals hij in de database staat: de waarheid, niet wat de UI denkt. */
export async function wedstrijd(datum: string): Promise<MatchRij | null> {
  const { data, error } = await db()
    .from('matches')
    .select('id, match_date, opponent, achter, voor, afwezig, keepers, keepers_vast, live, goals_voor, goals_tegen, updated_at')
    .eq('team_id', E2E_TEAM.id)
    .eq('match_date', datum)
    .maybeSingle()
  if (error) throw new Error(`wedstrijd lezen: ${error.message}`)
  return data as MatchRij | null
}

export async function historie(datum: string): Promise<{ actie: string }[]> {
  const { data, error } = await db()
    .from('match_history')
    .select('actie')
    .eq('team_id', E2E_TEAM.id)
    .eq('match_date', datum)
    .order('id')
  if (error) throw new Error(`historie lezen: ${error.message}`)
  return data ?? []
}

/** Naam bij een speler-id van het sandboxteam (ook gastspelers). */
export async function namen(ids: string[]): Promise<string[]> {
  const { data } = await db().from('players').select('id, name').eq('team_id', E2E_TEAM.id)
  const map = new Map((data ?? []).map((p) => [p.id as string, p.name as string]))
  return ids.map((id) => map.get(id) ?? '?')
}
