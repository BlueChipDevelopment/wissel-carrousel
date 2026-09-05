import { plekVan, wisselParen } from '@/domain/schedule'
import type { Blok, Opstelling, Wissel } from '@/domain/types'

interface Props {
  blokken: Blok[]
  i: number
  opstelling: Opstelling
  naam: (id: string) => string
}

export function RolesPanel({ blokken, i, opstelling, naam }: Props) {
  const b = blokken[i]
  const volgende = blokken[i + 1]
  const paren = wisselParen(blokken, i, opstelling)

  return (
    <div className="flex flex-col gap-3">
      <Rij label="Keeper">
        {b.keeper ? <Chip kleur="keeper">{naam(b.keeper)}</Chip> : <Chip>–</Chip>}
      </Rij>
      <Rij label="Verdedigers">
        {b.verdedigers.map((p) => (
          <Chip key={p} kleur="achter">
            {naam(p)}
          </Chip>
        ))}
      </Rij>
      <Rij label="Voorin">
        {b.aanval.map((p) => (
          <Chip key={p} kleur="voor">
            {naam(p)}
          </Chip>
        ))}
      </Rij>
      <Rij label="Bank">
        {b.bank.length ? (
          b.bank.map((p) => {
            const doel = volgende ? plekVan(volgende, p, opstelling.formatie) : ''
            return (
              <Chip key={p} dim>
                {naam(p)}
                {doel && doel !== 'bank' && <small className="opacity-75"> → {doel}</small>}
              </Chip>
            )
          })
        ) : (
          <Chip dim>niemand</Chip>
        )}
      </Rij>
      <Rij label={`Op ${b.van} min`} laatste>
        <ul className="m-0 list-none p-0 pt-[3px] text-[14.5px] text-muted">
          {i === 0 ? (
            <Li>
              Beginopstelling — <b className="text-ink">{b.keeper ? naam(b.keeper) : '–'}</b> start op goal.
            </Li>
          ) : paren.length ? (
            paren.map((x, k) => (
              <Li key={k}>
                <WisselTekst x={x} naam={naam} />
              </Li>
            ))
          ) : (
            <Li>Geen wissels.</Li>
          )}
        </ul>
      </Rij>
    </div>
  )
}

export function WisselTekst({ x, naam, kort }: { x: Wissel; naam: (id: string) => string; kort?: boolean }) {
  if (x.keeper)
    return (
      <>
        <b className="text-ink">{naam(x.erin)}</b> gaat op goal
      </>
    )
  if (x.vanGoal)
    return (
      <>
        <b className="text-ink">{naam(x.erin)}</b> van goal naar {x.plek}
      </>
    )
  return (
    <>
      <b className="text-ink">{naam(x.erin)}</b> komt voor {x.eruit ? naam(x.eruit) : '–'}
      {kort ? <small> ({x.plek})</small> : <> — {x.plek}</>}
    </>
  )
}

function Rij({ label, children, laatste }: { label: string; children: React.ReactNode; laatste?: boolean }) {
  return (
    <div className={`grid grid-cols-[104px_minmax(0,1fr)] items-start gap-[14px] ${laatste ? '' : 'border-b border-line pb-3'}`}>
      <div className="pt-[5px] font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="flex flex-wrap gap-[6px]">{children}</div>
    </div>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative py-[3px] pl-[15px] before:absolute before:top-[11px] before:left-0 before:h-[6px] before:w-[6px] before:rounded-full before:bg-accent before:opacity-55 before:content-['']">
      {children}
    </li>
  )
}

const KLEUREN = {
  keeper: 'border-keeper/40 bg-keeper/15',
  achter: 'border-achter/35 bg-achter/12',
  voor: 'border-voor/35 bg-voor/12',
} as const

export function Chip({ children, kleur, dim }: { children: React.ReactNode; kleur?: keyof typeof KLEUREN; dim?: boolean }) {
  return (
    <span className={`chip ${kleur ? KLEUREN[kleur] : ''} ${dim ? 'opacity-70' : ''}`}>
      {kleur && (
        <span
          className="h-[9px] w-[9px] flex-none rounded-full"
          style={{ background: `var(--color-${kleur})` }}
        />
      )}
      {children}
    </span>
  )
}
