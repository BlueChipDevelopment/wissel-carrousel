/**
 * Demo-stand zonder Supabase: dezelfde interface, maar alles blijft in localStorage van
 * deze browser. Handig om te ontwikkelen zonder credentials en om de app te laten zien.
 * Wordt gekozen in index.ts als VITE_SUPABASE_URL ontbreekt.
 */
import { SEED_PLAYERS, SEED_TEAMS } from '@/data/seed'
import type { DataSource, Match, MatchInput, Player, Team } from './types'

const KEY = 'wisselcarrousel.local.v1'

interface Store {
  players: Player[]
  matches: Match[]
}

function lees(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<Store>
      if (Array.isArray(v.players) && Array.isArray(v.matches)) {
        return { players: v.players, matches: v.matches }
      }
    }
  } catch {
    /* privémodus of onleesbare opslag: begin opnieuw met de seed */
  }
  return { players: SEED_PLAYERS.map((p) => ({ ...p })), matches: [] }
}

function schrijf(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* opslag geblokkeerd: de app draait door, alleen niet persistent */
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function createLocalSource(): DataSource {
  let store = lees()
  const wacht = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 0))

  return {
    kind: 'local',

    listTeams: () => wacht<Team[]>(SEED_TEAMS.map((t) => ({ ...t }))),

    listPlayers: (teamId) =>
      wacht(
        store.players
          .filter((p) => p.teamId === teamId)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .map((p) => ({ ...p })),
      ),

    async createPlayer(teamId, name) {
      const max = Math.max(0, ...store.players.filter((p) => p.teamId === teamId).map((p) => p.sortOrder))
      const p: Player = { id: uuid(), teamId, name, active: true, sortOrder: max + 1 }
      store = { ...store, players: [...store.players, p] }
      schrijf(store)
      return wacht({ ...p })
    },

    async updatePlayer(id, patch) {
      let out: Player | undefined
      store = {
        ...store,
        players: store.players.map((p) => {
          if (p.id !== id) return p
          out = { ...p, ...patch }
          return out
        }),
      }
      if (!out) throw new Error('speler bijwerken: niet gevonden')
      schrijf(store)
      return wacht({ ...out })
    },

    listMatches: (teamId) =>
      wacht(
        store.matches
          .filter((m) => m.teamId === teamId)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((m) => ({ ...m })),
      ),

    getMatch: (teamId, date) => {
      const m = store.matches.find((x) => x.teamId === teamId && x.date === date)
      return wacht(m ? { ...m } : null)
    },

    async saveMatch(input: MatchInput) {
      const bestaand = store.matches.find((x) => x.teamId === input.teamId && x.date === input.date)
      const m: Match = {
        ...input,
        id: bestaand?.id ?? input.id ?? uuid(),
        updatedAt: new Date().toISOString(),
      }
      store = {
        ...store,
        matches: [...store.matches.filter((x) => x.id !== m.id), m],
      }
      schrijf(store)
      return wacht({ ...m })
    },

    async deleteMatch(id) {
      store = { ...store, matches: store.matches.filter((x) => x.id !== id) }
      schrijf(store)
      return wacht(undefined)
    },
  }
}
