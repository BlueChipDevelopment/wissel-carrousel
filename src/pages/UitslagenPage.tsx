import { useEffect, useMemo, useState } from 'react'
import { useTeam } from '@/App'
import { Uitslag } from '@/components/Uitslag'
import { useTeams } from '@/hooks/useTeams'
import { perTeam, tegenstander, totaal, type Totaal, type Uitslag as UitslagRij } from '@/domain/uitslagen'
import { db } from '@/services/db'
import { formatDateShort } from '@/utils/dateUtils'

/** Uitslagen van alle JO8-teams naast elkaar: voor ons eigen overzicht, geen officiële stand. */
export function UitslagenPage() {
  const team = useTeam()
  const { teams } = useTeams()
  const [uitslagen, setUitslagen] = useState<UitslagRij[]>([])
  const [fout, setFout] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    let live = true
    db.listUitslagen()
      .then((u) => live && setUitslagen(u))
      .catch((e: unknown) => live && setFout(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLaden(false))
    return () => {
      live = false
    }
  }, [])

  // Alleen de teams die de app toont (dus niet het e2e-sandboxteam), nieuwste uitslag eerst.
  const zichtbaar = useMemo(() => {
    const ids = new Set(teams.map((t) => t.id))
    return uitslagen.filter((u) => ids.has(u.teamId)).sort((a, b) => b.date.localeCompare(a.date))
  }, [uitslagen, teams])
  const alle = useMemo(() => totaal(zichtbaar), [zichtbaar])
  const per = useMemo(() => perTeam(zichtbaar, teams.map((t) => t.id)), [zichtbaar, teams])

  if (laden) return <p className="hint">Laden…</p>

  return (
    <div className="flex flex-col gap-6">
      {fout && <p className="text-[14px] text-voor">{fout}</p>}

      <section className="flex flex-col gap-3" aria-label="Alle JO8-teams">
        <h2 className="text-[23px] font-semibold tracking-[0.03em]">Uitslagen JO8</h2>
        <div className="card flex flex-wrap">
          <Getal b={alle.gespeeld} s="gespeeld" />
          <Getal b={alle.gewonnen} s="gewonnen" />
          <Getal b={alle.gelijk} s="gelijk" />
          <Getal b={alle.verloren} s="verloren" />
          <Getal b={`${alle.voor}–${alle.tegen}`} s="doelpunten" />
          <Getal b={saldo(alle)} s="doelsaldo" laatste />
        </div>
        <p className="hint">
          Voor ons eigen overzicht, geen officiële stand. De coach vult de uitslag in op de pagina Wedstrijden.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[23px] font-semibold tracking-[0.03em]">Per team</h2>
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-[14px] sm:text-[14.5px]">
            <thead>
              <tr className="border-b border-line">
                <Th>Team</Th>
                <Th rechts>Gesp.</Th>
                <Th rechts>W</Th>
                <Th rechts>G</Th>
                <Th rechts>V</Th>
                <Th rechts>Doelp.</Th>
                <Th rechts>Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const s = per[t.id]
                const eigen = t.id === team.id
                return (
                  <tr key={t.id} className={`border-b border-line last:border-b-0 ${eigen ? 'bg-sunk font-semibold' : ''}`}>
                    <Td>{t.name}</Td>
                    <Td rechts>{s.gespeeld}</Td>
                    <Td rechts>{s.gewonnen}</Td>
                    <Td rechts>{s.gelijk}</Td>
                    <Td rechts>{s.verloren}</Td>
                    <Td rechts>
                      {s.voor}–{s.tegen}
                    </Td>
                    <Td rechts>{saldo(s)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {teams.map((t) => {
        const lijst = zichtbaar.filter((u) => u.teamId === t.id)
        return (
          <section key={t.id} className="flex flex-col gap-2" aria-label={`Uitslagen ${t.name}`}>
            <h3 className="text-[19px] font-semibold tracking-[0.03em]">{t.name}</h3>
            {lijst.length === 0 ? (
              <p className="hint">Nog geen uitslagen.</p>
            ) : (
              <ul className="card flex flex-col">
                {lijst.map((u) => {
                  const { naam, waar } = tegenstander(u.opponent)
                  return (
                    <li key={u.date} className="flex items-center gap-3 border-b border-line px-[13px] py-[8px] last:border-b-0">
                      <span className="w-[64px] flex-none text-[13.5px] text-muted">{formatDateShort(u.date)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {naam}
                        {waar && <small className="ml-2 text-muted">{waar}</small>}
                      </span>
                      <Uitslag voor={u.voor} tegen={u.tegen} />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function saldo(t: Totaal): string {
  return t.saldo > 0 ? `+${t.saldo}` : String(t.saldo)
}

function Getal({ b, s, laatste }: { b: number | string; s: string; laatste?: boolean }) {
  return (
    <div className={`min-w-[96px] flex-1 px-[14px] py-[9px] ${laatste ? '' : 'border-r border-line'}`}>
      <b className="block font-display text-[22px] font-semibold tabular-nums">{b}</b>
      <span className="text-[12px] uppercase tracking-[0.06em] text-muted">{s}</span>
    </div>
  )
}

function Th({ children, rechts }: { children: React.ReactNode; rechts?: boolean }) {
  return (
    <th
      className={`px-[7px] py-[9px] font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-muted first:pl-[13px] last:pr-[13px] sm:px-[13px] sm:text-[13px] ${rechts ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

function Td({ children, rechts }: { children: React.ReactNode; rechts?: boolean }) {
  return <td className={`px-[7px] py-[9px] tabular-nums first:pl-[13px] last:pr-[13px] sm:px-[13px] ${rechts ? 'text-right' : ''}`}>{children}</td>
}
