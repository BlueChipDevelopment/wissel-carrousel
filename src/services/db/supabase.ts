import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Formatie, WisselStand } from '@/domain/types'
import type { DataSource, Match, MatchInput, Player, Team } from './types'

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

function toTeam(r: Row<'teams'>): Team {
  return { id: r.id, slug: r.slug, name: r.name, club: r.club, season: r.season, sortOrder: r.sort_order }
}

function toPlayer(r: Row<'players'>): Player {
  return { id: r.id, teamId: r.team_id, name: r.name, active: r.active, sortOrder: r.sort_order }
}

function toMatch(r: Row<'matches'>): Match {
  return {
    id: r.id,
    teamId: r.team_id,
    date: r.match_date,
    opponent: r.opponent,
    wissel: (r.wissel === 'kwart' ? 'kwart' : '5min') as WisselStand,
    formatie: (r.formatie === '1-2-1-2' ? '1-2-1-2' : '1-2-3') as Formatie,
    achter: r.achter ?? [],
    voor: r.voor ?? [],
    afwezig: r.afwezig ?? [],
    notes: r.notes,
    updatedAt: r.updated_at,
  }
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'onbekende fout'}`)
}

export function createSupabaseSource(url: string, anonKey: string): DataSource {
  const sb: SupabaseClient<Database> = createClient<Database>(url, anonKey)

  return {
    kind: 'supabase',

    async listTeams() {
      const { data, error } = await sb.from('teams').select('*').order('sort_order')
      if (error) fail('teams laden', error)
      return (data ?? []).map(toTeam)
    },

    async listPlayers(teamId) {
      const { data, error } = await sb
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('sort_order')
        .order('name')
      if (error) fail('spelers laden', error)
      return (data ?? []).map(toPlayer)
    },

    async createPlayer(teamId, name) {
      const { data: bestaand } = await sb
        .from('players')
        .select('sort_order')
        .eq('team_id', teamId)
        .order('sort_order', { ascending: false })
        .limit(1)
      const sortOrder = (bestaand?.[0]?.sort_order ?? 0) + 1
      const { data, error } = await sb
        .from('players')
        .insert({ team_id: teamId, name, sort_order: sortOrder })
        .select('*')
        .single()
      if (error) fail('speler toevoegen', error)
      return toPlayer(data)
    },

    async updatePlayer(id, patch) {
      const { data, error } = await sb
        .from('players')
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.active !== undefined ? { active: patch.active } : {}),
          ...(patch.sortOrder !== undefined ? { sort_order: patch.sortOrder } : {}),
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) fail('speler bijwerken', error)
      return toPlayer(data)
    },

    async listMatches(teamId) {
      const { data, error } = await sb
        .from('matches')
        .select('*')
        .eq('team_id', teamId)
        .order('match_date', { ascending: false })
      if (error) fail('wedstrijden laden', error)
      return (data ?? []).map(toMatch)
    },

    async getMatch(teamId, date) {
      const { data, error } = await sb
        .from('matches')
        .select('*')
        .eq('team_id', teamId)
        .eq('match_date', date)
        .maybeSingle()
      if (error) fail('wedstrijd laden', error)
      return data ? toMatch(data) : null
    },

    async saveMatch(input) {
      const row = {
        team_id: input.teamId,
        match_date: input.date,
        opponent: input.opponent,
        wissel: input.wissel,
        formatie: input.formatie,
        achter: input.achter,
        voor: input.voor,
        afwezig: input.afwezig,
        notes: input.notes,
      }
      const { data, error } = await sb
        .from('matches')
        .upsert(row, { onConflict: 'team_id,match_date' })
        .select('*')
        .single()
      if (error) fail('wedstrijd opslaan', error)
      return toMatch(data)
    },

    async deleteMatch(id) {
      const { error } = await sb.from('matches').delete().eq('id', id)
      if (error) fail('wedstrijd verwijderen', error)
    },
  }
}

export type { MatchInput }
