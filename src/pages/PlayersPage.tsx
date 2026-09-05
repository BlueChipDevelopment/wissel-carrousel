import { useEffect, useState, type FormEvent } from 'react'
import { useTeam } from '@/App'
import { db, type Player } from '@/services/db'

/** Spelers van het team beheren: toevoegen, hernoemen, uit de selectie halen. */
export function PlayersPage() {
  const team = useTeam()
  const [spelers, setSpelers] = useState<Player[]>([])
  const [nieuw, setNieuw] = useState('')
  const [bewerk, setBewerk] = useState<{ id: string; name: string } | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    let live = true
    setLaden(true)
    db.listPlayers(team.id)
      .then((p) => live && setSpelers(p))
      .catch((e: unknown) => live && setFout(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLaden(false))
    return () => {
      live = false
    }
  }, [team.id])

  const melding = (e: unknown) => setFout(e instanceof Error ? e.message : String(e))

  const voegToe = async (ev: FormEvent) => {
    ev.preventDefault()
    const n = nieuw.trim()
    if (!n) return
    if (spelers.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      setFout(`${n} staat al in de lijst.`)
      return
    }
    try {
      const p = await db.createPlayer(team.id, n)
      setSpelers((l) => [...l, p])
      setNieuw('')
      setFout(null)
    } catch (e) {
      melding(e)
    }
  }

  const bewaarNaam = async () => {
    if (!bewerk) return
    const n = bewerk.name.trim()
    if (!n) return setBewerk(null)
    try {
      const p = await db.updatePlayer(bewerk.id, { name: n })
      setSpelers((l) => l.map((x) => (x.id === p.id ? p : x)))
      setBewerk(null)
      setFout(null)
    } catch (e) {
      melding(e)
    }
  }

  const toggleActief = async (p: Player) => {
    try {
      const u = await db.updatePlayer(p.id, { active: !p.active })
      setSpelers((l) => l.map((x) => (x.id === u.id ? u : x)))
    } catch (e) {
      melding(e)
    }
  }

  if (laden) return <p className="hint">Laden…</p>

  const actief = spelers.filter((p) => p.active)
  const inactief = spelers.filter((p) => !p.active)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-[23px] font-semibold tracking-[0.03em]">Selectie {team.name}</h2>
        <div className="card p-4">
          {fout && <p className="mb-3 text-[14px] text-voor">{fout}</p>}
          <ul className="flex flex-col gap-[5px]">
            {actief.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-sunk px-3 py-[6px]">
                {bewerk?.id === p.id ? (
                  <>
                    <input
                      className="field flex-1"
                      value={bewerk.name}
                      autoFocus
                      onChange={(e) => setBewerk({ id: p.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') bewaarNaam()
                        if (e.key === 'Escape') setBewerk(null)
                      }}
                    />
                    <button type="button" className="btn btn-small btn-primary" onClick={bewaarNaam}>
                      Bewaar
                    </button>
                    <button type="button" className="btn btn-small" onClick={() => setBewerk(null)}>
                      Annuleer
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{p.name}</span>
                    <button type="button" className="btn btn-small" onClick={() => setBewerk({ id: p.id, name: p.name })}>
                      Hernoem
                    </button>
                    <button type="button" className="btn btn-small" onClick={() => toggleActief(p)}>
                      Uit selectie
                    </button>
                  </>
                )}
              </li>
            ))}
            {!actief.length && <li className="hint">Nog geen spelers.</li>}
          </ul>

          <form onSubmit={voegToe} className="mt-4 flex gap-2">
            <input
              className="field flex-1"
              placeholder="Nieuwe speler (voornaam)"
              value={nieuw}
              onChange={(e) => setNieuw(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!nieuw.trim()}>
              Toevoegen
            </button>
          </form>
          <p className="hint mt-2">
            Alleen voornamen. Een speler die stopt haal je uit de selectie; zijn keeperbeurten blijven in de
            geschiedenis staan.
          </p>
        </div>
      </section>

      {inactief.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[23px] font-semibold tracking-[0.03em]">Niet meer in de selectie</h2>
          <div className="card p-4">
            <ul className="flex flex-wrap gap-[7px]">
              {inactief.map((p) => (
                <li key={p.id}>
                  <button type="button" className="chip opacity-70" onClick={() => toggleActief(p)}>
                    {p.name} <small>· terug in selectie</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
