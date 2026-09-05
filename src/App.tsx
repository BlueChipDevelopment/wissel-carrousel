import { Navigate, Outlet, Route, Routes, useOutletContext, useParams } from 'react-router-dom'
import type { Team } from '@/services/db'
import { TeamNav } from '@/components/TeamNav'
import { useTeams } from '@/hooks/useTeams'
import { MatchesPage } from '@/pages/MatchesPage'
import { PlayersPage } from '@/pages/PlayersPage'
import { TeamPage } from '@/pages/TeamPage'
import { isDemo } from '@/services/db'

export default function App() {
  const { teams, loading, error } = useTeams()

  if (loading) return <Shell><p className="hint">Teams laden…</p></Shell>
  if (error) return <Shell><p className="text-voor">Kon de teams niet laden: {error}</p></Shell>
  if (!teams.length) return <Shell><p className="hint">Er zijn nog geen teams.</p></Shell>

  const eerste = teams[0].slug

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/team/${eerste}`} replace />} />
      <Route path="/team/:slug" element={<TeamShell />}>
        <Route index element={<TeamPage />} />
        <Route path="wedstrijden" element={<MatchesPage />} />
        <Route path="spelers" element={<PlayersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function TeamShell() {
  const { slug } = useParams()
  const { teams } = useTeams()
  const team = teams.find((t) => t.slug === slug)
  if (!team) return <Navigate to="/" replace />
  return (
    <Shell>
      <TeamNav teams={teams} team={team} />
      <Outlet context={{ team } satisfies TeamContext} />
    </Shell>
  )
}

export interface TeamContext {
  team: Team
}

/** Het gekozen team, voor pages onder /team/:slug. */
export function useTeam(): Team {
  return useOutletContext<TeamContext>().team
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1060px] flex-col gap-6 px-5 pt-5 pb-16">
      {isDemo && (
        <div className="no-print rounded-lg border border-keeper/40 bg-keeper/10 px-3 py-2 text-[13.5px]">
          <b>Demo-stand.</b> Er is geen Supabase gekoppeld; alles wat je hier doet blijft in deze
          browser. Zet <code>VITE_SUPABASE_URL</code> en <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
          <code>.env.local</code> voor de gedeelde versie.
        </div>
      )}
      {children}
    </div>
  )
}
