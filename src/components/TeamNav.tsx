import { NavLink } from 'react-router-dom'
import type { Team } from '@/services/db'

export function TeamNav({ teams, team }: { teams: Team[]; team: Team }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full border px-3 py-[6px] text-[14px] font-semibold ${
      isActive ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
    }`

  return (
    <header className="flex flex-col gap-3">
      <div>
        <div className="eyebrow">
          {team.club ?? 'Wisselcarrousel'}
          {team.season ? ` · seizoen ${team.season}` : ''}
        </div>
        <h1 className="text-[clamp(34px,6vw,50px)] font-bold">Wisselcarrousel {team.name}</h1>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3">
        <span className="eyebrow">Team</span>
        <nav className="flex flex-wrap gap-[7px]" aria-label="Team kiezen">
          {teams.map((t) => (
            <NavLink
              key={t.id}
              to={`/team/${t.slug}`}
              end={false}
              className={({ isActive }) =>
                `rounded-full border px-3 py-[6px] text-[14.5px] font-medium ${
                  isActive || t.id === team.id
                    ? 'border-accent bg-accent text-accent-ink font-semibold'
                    : 'border-line bg-sunk'
                }`
              }
            >
              {t.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <nav className="no-print flex flex-wrap gap-[7px]" aria-label="Pagina">
        <NavLink to={`/team/${team.slug}`} end className={tab}>
          Opstelling
        </NavLink>
        <NavLink to={`/team/${team.slug}/wedstrijden`} className={tab}>
          Wedstrijden &amp; keeperbeurten
        </NavLink>
        <NavLink to={`/team/${team.slug}/spelers`} className={tab}>
          Spelers
        </NavLink>
      </nav>
    </header>
  )
}
