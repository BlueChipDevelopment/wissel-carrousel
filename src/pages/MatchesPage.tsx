import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTeam } from '@/App'
import { keepersVan } from '@/domain/live'
import { keeperTally } from '@/domain/schedule'
import { db, type Match, type Player } from '@/services/db'
import { formatDate, todayISO } from '@/utils/dateUtils'

/** Geschiedenis van het team: opgeslagen wedstrijden en wie hoe vaak gekeept heeft. */
export function MatchesPage() {
  const team = useTeam()
  const [spelers, setSpelers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [fout, setFout] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    let live = true
    setLaden(true)
    Promise.all([db.listPlayers(team.id), db.listMatches(team.id)])
      .then(([p, m]) => {
        if (!live) return
        setSpelers(p)
        setMatches(m)
      })
      .catch((e: unknown) => live && setFout(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLaden(false))
    return () => {
      live = false
    }
  }, [team.id])

  const naam = (id: string) => spelers.find((p) => p.id === id)?.name ?? '?'
  const vandaag = todayISO()
  const gespeeld = useMemo(() => matches.filter((m) => m.date <= vandaag), [matches, vandaag])
  const tally = useMemo(() => keeperTally(gespeeld.map(keepersVan)), [gespeeld])

  const verwijder = async (m: Match) => {
    if (!window.confirm(`Wedstrijd van ${formatDate(m.date)} verwijderen?`)) return
    try {
      await db.deleteMatch(m.id)
      setMatches((l) => l.filter((x) => x.id !== m.id))
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e))
    }
  }

  if (laden) return <p className="hint">Laden…</p>

  return (
    <div className="flex flex-col gap-6">
      {fout && <p className="text-voor">{fout}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-[23px] font-semibold tracking-[0.03em]">Keeperbeurten</h2>
        <div className="card p-4">
          {gespeeld.length === 0 ? (
            <p className="hint">
              Nog geen gespeelde wedstrijd opgeslagen. Sla op de pagina <Link className="underline" to={`/team/${team.slug}`}>Opstelling</Link>{' '}
              de wedstrijd op; vanaf de wedstrijddag telt hij hier mee.
            </p>
          ) : (
            <p className="hint">
              Geteld over {gespeeld.length} gespeelde wedstrijd{gespeeld.length === 1 ? '' : 'en'}. De hussel-knop zet
              wie het minst gekeept heeft achterin.
            </p>
          )}
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-[7px]">
            {spelers
              .filter((p) => p.active)
              .map((p) => (
                <div key={p.id} className="flex justify-between gap-2 rounded-[7px] bg-sunk px-[11px] py-[6px] text-[14px]">
                  <span>{p.name}</span>
                  <b className="font-display text-[16px] tabular-nums">{tally[p.id] ?? 0}×</b>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[23px] font-semibold tracking-[0.03em]">Wedstrijden</h2>
        <div className="card overflow-x-auto">
          {matches.length === 0 ? (
            <p className="hint p-4">Nog niets opgeslagen.</p>
          ) : (
            <table className="w-full min-w-[560px] border-collapse text-[14.5px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>Datum</Th>
                  <Th>Tegenstander</Th>
                  <Th>Keepers</Th>
                  <Th>Afwezig</Th>
                  <Th>Stand</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-b-0">
                    <Td>
                      <Link className="font-semibold underline" to={`/team/${team.slug}?datum=${m.date}`}>
                        {formatDate(m.date)}
                      </Link>
                      {m.date > vandaag && <small className="ml-2 text-muted">gepland</small>}
                    </Td>
                    <Td>{m.opponent ?? '–'}</Td>
                    <Td>
                      {keepersVan(m).map(naam).join(' · ')}
                      {m.live && <small className="ml-2 text-muted">live</small>}
                    </Td>
                    <Td muted>{m.afwezig.length ? m.afwezig.map(naam).join(', ') : '–'}</Td>
                    <Td muted>{m.wissel === '5min' ? '5 min' : m.wissel === 'vrij' ? 'vrij' : 'kwart'} · {m.formatie}</Td>
                    <Td>
                      <button type="button" className="btn btn-small" onClick={() => verwijder(m)}>
                        Verwijder
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-[13px] py-[9px] text-left font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">
      {children}
    </th>
  )
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <td className={`px-[13px] py-[9px] align-middle ${muted ? 'text-muted' : ''}`}>{children}</td>
}
