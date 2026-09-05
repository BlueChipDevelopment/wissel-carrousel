import type { Formatie, WisselStand } from '@/domain/types'

export interface Team {
  id: string
  slug: string
  name: string
  club: string | null
  season: string | null
  sortOrder: number
}

export interface Player {
  id: string
  teamId: string
  name: string
  active: boolean
  sortOrder: number
}

/** Eén opgeslagen wedstrijd: de opstelling zoals de coach die instelde. */
export interface Match {
  id: string
  teamId: string
  /** YYYY-MM-DD */
  date: string
  opponent: string | null
  wissel: WisselStand
  formatie: Formatie
  /** speler-ids in keepervolgorde */
  achter: string[]
  /** speler-ids in opstellingsvolgorde */
  voor: string[]
  afwezig: string[]
  notes: string | null
  updatedAt: string
}

export type MatchInput = Omit<Match, 'id' | 'updatedAt'> & { id?: string }

/**
 * Alle datatoegang loopt via deze interface (src/services/db/index.ts kiest de
 * implementatie). Pages en components praten nooit rechtstreeks met Supabase.
 */
export interface DataSource {
  readonly kind: 'supabase' | 'local'
  listTeams(): Promise<Team[]>
  listPlayers(teamId: string): Promise<Player[]>
  createPlayer(teamId: string, name: string): Promise<Player>
  updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'active' | 'sortOrder'>>): Promise<Player>
  /** Nieuwste eerst. */
  listMatches(teamId: string): Promise<Match[]>
  getMatch(teamId: string, date: string): Promise<Match | null>
  /** Upsert op (team, datum). */
  saveMatch(input: MatchInput): Promise<Match>
  deleteMatch(id: string): Promise<void>
}
