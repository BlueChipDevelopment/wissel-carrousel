import type { Formatie, Live, WisselStand } from '@/domain/types'

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
  /** Werkelijke keepers (per kwart, soms twee); leeg bij wedstrijden van vóór de live-stand. */
  keepers: string[]
  /** Werkelijkheid tijdens de wedstrijd; null zolang alles volgens plan is. */
  live: Live | null
  notes: string | null
  updatedAt: string
}

export type MatchInput = Omit<Match, 'id' | 'updatedAt'> & { id?: string }

/** Loskoppelen van een abonnement. */
export type Unsubscribe = () => void

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
  /**
   * Meldt elke wijziging aan de wedstrijd van dit team op deze datum door een andere
   * telefoon (null = verwijderd). Last-write-wins: de ontvanger vergelijkt `updatedAt`.
   */
  subscribeMatch(teamId: string, date: string, cb: (m: Match | null) => void): Unsubscribe
}
