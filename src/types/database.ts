/**
 * Databasetypes voor Supabase. Met de hand geschreven naar supabase/migrations;
 * na een schemawijziging opnieuw genereren met `npm run db:types` (vereist een
 * gekoppeld Supabase-project) en dit bestand vervangen.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          slug: string
          name: string
          club: string | null
          season: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          club?: string | null
          season?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
        Relationships: []
      }
      players: {
        Row: {
          id: string
          team_id: string
          name: string
          active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['players']['Insert']>
        Relationships: []
      }
      matches: {
        Row: {
          id: string
          team_id: string
          match_date: string
          opponent: string | null
          wissel: string
          formatie: string
          achter: string[]
          voor: string[]
          afwezig: string[]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          match_date: string
          opponent?: string | null
          wissel?: string
          formatie?: string
          achter?: string[]
          voor?: string[]
          afwezig?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
        Relationships: []
      }
    }
    Views: {
      keeper_counts: {
        Row: { team_id: string; player_id: string; beurten: number }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
