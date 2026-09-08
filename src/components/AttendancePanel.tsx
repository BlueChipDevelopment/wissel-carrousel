import { useState } from 'react'
import type { Player } from '@/services/db'

interface Props {
  spelers: Player[]
  afwezig: string[]
  onToggle: (id: string) => void
  /** Wedstrijd bezig: één regel, uitklapbaar. Vooraf: alle namen als knopjes. */
  compact: boolean
}

/**
 * Wie is er? Direct onder de wedstrijdkop, want dat is het eerste wat je op de wedstrijddag
 * invult. Zodra de wedstrijd loopt krimpt het tot een samenvatting.
 */
export function AttendancePanel({ spelers, afwezig, onToggle, compact }: Props) {
  const [open, setOpen] = useState(false)
  const actief = spelers.filter((p) => p.active)
  const erbij = actief.filter((p) => !afwezig.includes(p.id))
  const weg = actief.filter((p) => afwezig.includes(p.id))
  const uitgeklapt = !compact || open

  return (
    <section className="card no-print flex flex-col gap-2 px-4 py-3" aria-label="Wie is er?">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="eyebrow">Wie is er?</span>
        <span className="text-[14.5px]">
          <b>{erbij.length}</b> van {actief.length} erbij
          {weg.length > 0 && (
            <span className="text-muted"> · afwezig: {weg.map((p) => p.name).join(', ')}</span>
          )}
        </span>
        {compact && (
          <button type="button" className="hint ml-auto underline" onClick={() => setOpen((o) => !o)}>
            {open ? 'sluit' : 'wijzig'}
          </button>
        )}
      </div>
      {uitgeklapt && (
        <div className="flex flex-wrap gap-[7px]">
          {actief.map((p) => {
            const er = !afwezig.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={er}
                onClick={() => onToggle(p.id)}
                className={`chip ${er ? '' : 'opacity-40 line-through'}`}
              >
                {p.name}
              </button>
            )
          })}
          {!actief.length && <span className="hint">Nog geen spelers — voeg ze toe onder Spelers.</span>}
          <span className="hint basis-full">Tik een naam aan om hem of haar op afwezig te zetten.</span>
        </div>
      )}
    </section>
  )
}
