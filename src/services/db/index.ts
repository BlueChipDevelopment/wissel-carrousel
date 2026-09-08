/**
 * De enige weg naar data. Met VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY praat de app met
 * Supabase; zonder die twee draait hij in demo-stand (localStorage, seed-teams).
 */
import { createLocalSource } from './local'
import { createSupabaseSource } from './supabase'
import type { DataSource } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const db: DataSource = url && key ? createSupabaseSource(url, key) : createLocalSource()

export const isDemo = db.kind === 'local'

export type { DataSource, Match, MatchInput, Player, Team, Unsubscribe } from './types'
