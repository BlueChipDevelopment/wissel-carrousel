import type { Blok } from '@/domain/types'

interface Props {
  blokken: Blok[]
  actief: number
  vijf: boolean
  naam: (id: string) => string
  onKies: (i: number) => void
  /** Blok dat nu bezig is; alles ervoor is vastgelegd. Weglaten = niets vastgelegd. */
  huidig?: number
  /** Blokken die de coach zelf gezet heeft; de app rekent die niet meer om. */
  handmatig?: number[]
}

/** Klein handje: dit blok heeft de coach met de hand gezet. */
function Handje({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 13" width="11" height="12" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.2 1.2c.5 0 .8.4.8.8v4.2h.6V.8c0-.4.4-.8.8-.8s.8.4.8.8v5.4h.6V1.6c0-.4.4-.8.8-.8s.8.4.8.8v4.6h.6V3.4c0-.4.4-.8.8-.8s.8.4.8.8V8c0 2.8-1.8 5-4.6 5-1.6 0-2.8-.6-3.6-1.7L.7 8.6c-.3-.4-.2-.9.2-1.1.4-.3.9-.2 1.2.1l1.3 1.5V2c0-.4.4-.8.8-.8z"
      />
    </svg>
  )
}

export function BlockTabs({ blokken, actief, vijf, naam, onKies, huidig, handmatig }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Speelblokken">
      {blokken.map((b, i) => {
        const on = i === actief
        const vast = huidig !== undefined && i < huidig
        const nu = huidig !== undefined && i === huidig
        const zelf = !vast && !!handmatig?.includes(i)
        return (
          <button
            key={i}
            role="tab"
            aria-selected={on}
            onClick={() => onKies(i)}
            className={`relative rounded-[10px] border px-1 pt-[10px] pb-[11px] text-center transition-colors ${
              on ? 'border-accent bg-accent text-accent-ink' : vast ? 'border-line bg-sunk text-muted' : 'border-line bg-surface'
            }`}
          >
            {(vast || nu || zelf) && (
              <span
                className={`absolute top-[5px] right-[6px] flex items-center gap-[5px] text-[10px] uppercase tracking-[0.08em] ${on ? 'opacity-80' : 'text-muted'}`}
                aria-label={[zelf ? 'zelf gezet' : '', vast ? 'gespeeld' : nu ? 'nu bezig' : ''].filter(Boolean).join(', ')}
              >
                {zelf && <Handje className="shrink-0" />}
                {vast ? '✓' : nu ? '● nu' : null}
              </span>
            )}
            <b className="block font-display text-[20px] font-bold uppercase tracking-[0.02em]">
              {vijf ? `${b.van}–${b.tot}` : `Kwart ${b.kwart + 1}`}
            </b>
            <span className={`block truncate text-[11.5px] uppercase tracking-[0.07em] ${on ? 'opacity-80' : 'text-muted'}`}>
              {vijf ? `kwart ${b.kwart + 1} · ` : `${b.van}–${b.tot} min · `}
              {b.keeper ? naam(b.keeper) : '–'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
