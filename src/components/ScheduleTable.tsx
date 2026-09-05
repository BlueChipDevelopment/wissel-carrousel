import { minuten, wisselParen } from '@/domain/schedule'
import type { Blok, Opstelling } from '@/domain/types'
import { WisselTekst } from './RolesPanel'

interface Props {
  blokken: Blok[]
  opstelling: Opstelling
  naam: (id: string) => string
  achterIds: string[]
}

export function ScheduleTable({ blokken, opstelling, naam, achterIds }: Props) {
  const spelers = [...opstelling.achter, ...opstelling.voor]
  const mins = minuten(blokken, spelers)
  const th = 'px-[13px] py-[9px] text-left font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-muted'
  const td = 'px-[13px] py-[9px] align-middle border-b border-line'

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[23px] font-semibold tracking-[0.03em]">Hele wedstrijd</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[14.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Kwart</th>
              <th className={th}>Keeper</th>
              <th className={th}>Verdedigers</th>
              <th className={th}>Voorin</th>
              <th className={th}>Bank</th>
              <th className={th}>Wie voor wie</th>
            </tr>
          </thead>
          <tbody>
            {blokken.map((b, i) => {
              const paren = wisselParen(blokken, i, opstelling)
              return (
                <tr key={i} className="last:[&>td]:border-b-0">
                  <td className={`${td} font-display text-[17px] font-bold whitespace-nowrap`}>
                    {b.kwart + 1}
                    <small className="block font-sans text-[12px] font-normal tracking-[0.04em] text-muted">
                      {b.van}–{b.tot}'
                    </small>
                  </td>
                  <td className={td}>{b.keeper ? naam(b.keeper) : '–'}</td>
                  <td className={td}>{b.verdedigers.map(naam).join(', ')}</td>
                  <td className={td}>{b.aanval.map(naam).join(', ')}</td>
                  <td className={`${td} text-muted`}>{b.bank.length ? b.bank.map(naam).join(', ') : '–'}</td>
                  <td className={`${td} text-muted`}>
                    {i === 0 ? (
                      'start'
                    ) : paren.length ? (
                      paren.map((x, k) => (
                        <span key={k} className="block">
                          <WisselTekst x={x} naam={naam} kort />
                        </span>
                      ))
                    ) : (
                      'geen'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-[9px]">
        {spelers
          .slice()
          .sort((a, b) => (mins[b] ?? 0) - (mins[a] ?? 0) || naam(a).localeCompare(naam(b)))
          .map((p) => {
            const m = mins[p] ?? 0
            const kleur = achterIds.includes(p) ? 'var(--color-achter)' : 'var(--color-voor)'
            return (
              <div key={p} className="card px-3 pt-[9px] pb-[11px] shadow-none">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{naam(p)}</span>
                  <span className="font-display text-[17px] font-semibold tabular-nums">{m}'</span>
                </div>
                <div className="mt-[7px] h-[5px] overflow-hidden rounded-[3px] bg-sunk">
                  <i className="block h-full" style={{ width: `${(m / 40) * 100}%`, background: kleur }} />
                </div>
              </div>
            )
          })}
      </div>
    </section>
  )
}
