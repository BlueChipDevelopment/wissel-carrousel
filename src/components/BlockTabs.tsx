import type { Blok } from '@/domain/types'

interface Props {
  blokken: Blok[]
  actief: number
  vijf: boolean
  naam: (id: string) => string
  onKies: (i: number) => void
  /** Blok dat nu bezig is; alles ervoor is vastgelegd. Weglaten = niets vastgelegd. */
  huidig?: number
}

export function BlockTabs({ blokken, actief, vijf, naam, onKies, huidig }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Speelblokken">
      {blokken.map((b, i) => {
        const on = i === actief
        const vast = huidig !== undefined && i < huidig
        const nu = huidig !== undefined && i === huidig
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
            {(vast || nu) && (
              <span
                className={`absolute top-[5px] right-[6px] text-[10px] uppercase tracking-[0.08em] ${on ? 'opacity-80' : 'text-muted'}`}
                aria-label={vast ? 'gespeeld' : 'nu bezig'}
              >
                {vast ? '✓' : '● nu'}
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
