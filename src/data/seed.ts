/**
 * Demo-stand: de vier JO8-teams van DEV Doorn, seizoen 2026/2027.
 * Zelfde ids en namen als supabase/migrations/20260905120200_seed_jo8_2026.sql —
 * houd de twee gelijk.
 */
import type { Player, Team } from '@/services/db/types'

const T = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const P = (t: number, n: number) => `00000000-0000-4000-800${t}-${String(n).padStart(12, '0')}`

export const SEED_TEAMS: Team[] = [
  { id: T(1), slug: 'jo8-1', name: 'JO8-1', club: 'DEV Doorn', season: '2026/2027', sortOrder: 1 },
  { id: T(2), slug: 'jo8-2', name: 'JO8-2', club: 'DEV Doorn', season: '2026/2027', sortOrder: 2 },
  { id: T(3), slug: 'jo8-3', name: 'JO8-3', club: 'DEV Doorn', season: '2026/2027', sortOrder: 3 },
  { id: T(4), slug: 'jo8-4', name: 'JO8-4', club: 'DEV Doorn', season: '2026/2027', sortOrder: 4 },
]

const NAMEN: Record<number, string[]> = {
  1: ['Adam', 'Guus', 'Christopher', 'Mees', 'Ties', 'Julan', 'Sara', 'Floris'],
  2: ['Daan', 'Daisy', 'Elise', 'Felix O', 'Ilsa', 'Isaak', 'Joep', 'Joris'],
  3: ['Benjamin', 'Emiel', 'Felix B', 'Hugo', 'Jack', 'Samuel', 'Thomas'],
  4: ['Alexander', 'Charlie', 'Gijs', 'Guus H', 'Noah', 'Rachid', 'Ritchie', 'Souraya'],
}

export const SEED_PLAYERS: Player[] = Object.entries(NAMEN).flatMap(([t, namen]) =>
  namen.map((name, i) => ({
    id: P(Number(t), i + 1),
    teamId: T(Number(t)),
    name,
    active: true,
    sortOrder: i + 1,
  })),
)

/**
 * De opstelling waarmee JO8-1 begon (chat met Chris, sept 2026): achterin in
 * keepervolgorde, voorin in opstellingsvolgorde. Alleen gebruikt als startpunt
 * voor een team zonder eerdere wedstrijd.
 */
export const SEED_START_JO8_1 = {
  achter: ['Mees', 'Sara', 'Christopher', 'Floris'],
  voor: ['Ties', 'Julan', 'Guus', 'Adam'],
}
