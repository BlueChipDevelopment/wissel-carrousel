import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTeam } from '@/App'
import { AANTAL_KWARTEN } from '@/domain/schedule'
import { keeperPerKwart, keepersGeteld, keepersVan } from '@/domain/live'
import { keeperTally } from '@/domain/schedule'
import { leesStand } from '@/domain/uitslagen'
import { Uitslag } from '@/components/Uitslag'
import { db, type Match, type Player } from '@/services/db'
import { formatDate, todayISO } from '@/utils/dateUtils'

/** Geschiedenis van het team: opgeslagen wedstrijden en wie hoe vaak gekeept heeft. */
export function MatchesPage() {
  const team = useTeam()
  const [spelers, setSpelers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [fout, setFout] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)
  /** Wedstrijd waarvan de keepers nu gecorrigeerd worden, met de gekozen keeper per kwart. */
  const [correctie, setCorrectie] = useState<{ id: string; keepers: string[] } | null>(null)
  /** Wedstrijd waarvan de uitslag nu ingevuld wordt, met wat er getypt is ("7-3"). */
  const [uitslag, setUitslag] = useState<{ id: string; tekst: string; fout: boolean } | null>(null)

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

  const vervang = (m: Match) => setMatches((l) => l.map((x) => (x.id === m.id ? m : x)))

  const startCorrectie = (m: Match) => {
    setCorrectie({ id: m.id, keepers: keeperPerKwart(m) })
  }

  const bewaarCorrectie = async () => {
    if (!correctie) return
    const keepers = correctie.keepers.filter(Boolean)
    if (keepers.length !== AANTAL_KWARTEN) return
    try {
      vervang(await db.zetKeepers(correctie.id, keepers, true))
      setCorrectie(null)
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e))
    }
  }

  const bewaarUitslag = async (weg = false) => {
    if (!uitslag) return
    const stand = weg ? null : leesStand(uitslag.tekst)
    if (!weg && !stand) {
      setUitslag({ ...uitslag, fout: true })
      return
    }
    try {
      vervang(await db.zetUitslag(uitslag.id, stand))
      setUitslag(null)
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e))
    }
  }

  /** Terug naar geteld: de keepers weer afleiden uit de live-blokken (of het plan). */
  const laatLos = async (m: Match) => {
    const keepers = keepersGeteld(m, m.live)
    try {
      vervang(await db.zetKeepers(m.id, keepers, false))
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e))
    }
  }

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
            <table className="w-full min-w-[680px] border-collapse text-[14.5px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>Datum</Th>
                  <Th>Tegenstander</Th>
                  <Th>Uitslag</Th>
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
                      {uitslag?.id === m.id ? (
                        <form
                          className="flex flex-wrap items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            void bewaarUitslag()
                          }}
                        >
                          <input
                            className="field w-[76px] text-center"
                            aria-label="Uitslag, wij eerst"
                            placeholder="7-3"
                            inputMode="numeric"
                            autoFocus
                            value={uitslag.tekst}
                            onChange={(e) => setUitslag({ ...uitslag, tekst: e.target.value, fout: false })}
                          />
                          <button type="submit" className="btn btn-primary btn-small">
                            Bewaar
                          </button>
                          {m.goalsVoor !== null && (
                            <button type="button" className="text-[13px] underline" onClick={() => void bewaarUitslag(true)}>
                              Weghalen
                            </button>
                          )}
                          <button type="button" className="text-[13px] underline" onClick={() => setUitslag(null)}>
                            Annuleren
                          </button>
                          {uitslag.fout && <small className="basis-full text-voor">Typ de stand als 7-3, wij eerst.</small>}
                        </form>
                      ) : m.goalsVoor !== null && m.goalsTegen !== null ? (
                        <span className="flex flex-wrap items-center gap-x-2">
                          <Uitslag voor={m.goalsVoor} tegen={m.goalsTegen} />
                          <button
                            type="button"
                            className="text-[13px] underline"
                            onClick={() => setUitslag({ id: m.id, tekst: `${m.goalsVoor}-${m.goalsTegen}`, fout: false })}
                          >
                            wijzig
                          </button>
                        </span>
                      ) : m.date <= vandaag ? (
                        <button type="button" className="text-[13px] underline" onClick={() => setUitslag({ id: m.id, tekst: '', fout: false })}>
                          Invullen
                        </button>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </Td>
                    <Td>
                      {correctie?.id === m.id ? (
                        <form
                          className="flex flex-wrap items-end gap-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            void bewaarCorrectie()
                          }}
                        >
                          {correctie.keepers.map((k, q) => (
                            <label key={q} className="flex flex-col gap-1">
                              <span className="eyebrow">Kwart {q + 1}</span>
                              <select
                                className="field"
                                value={k}
                                required
                                onChange={(e) =>
                                  setCorrectie((c) => c && { ...c, keepers: c.keepers.map((x, i) => (i === q ? e.target.value : x)) })
                                }
                              >
                                <option value="">–</option>
                                {spelers
                                  .filter((p) => p.active || p.id === k)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          ))}
                          <button type="submit" className="btn btn-primary btn-small">
                            Keepers opslaan
                          </button>
                          <button type="button" className="btn btn-small" onClick={() => setCorrectie(null)}>
                            Annuleren
                          </button>
                        </form>
                      ) : (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>{keepersVan(m).map(naam).join(' · ')}</span>
                          {m.keepersVast ? (
                            <small className="text-muted">gecorrigeerd</small>
                          ) : (
                            m.live && <small className="text-muted">live</small>
                          )}
                          {m.date <= vandaag && (
                            <button type="button" className="text-[13px] underline" onClick={() => startCorrectie(m)}>
                              Corrigeer
                            </button>
                          )}
                          {m.keepersVast && (
                            <button type="button" className="text-[13px] underline" onClick={() => void laatLos(m)}>
                              Terug naar geteld
                            </button>
                          )}
                        </span>
                      )}
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
