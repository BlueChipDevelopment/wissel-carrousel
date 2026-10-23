import { resultaat } from '@/domain/uitslagen'

const KLEUR = { W: 'bg-accent text-accent-ink', G: 'bg-bank text-white', V: 'bg-voor text-white' } as const
const WOORD = { W: 'gewonnen', G: 'gelijk', V: 'verloren' } as const

/** De stand vanuit ons team, met een gekleurd W/G/V-label. */
export function Uitslag({ voor, tegen }: { voor: number; tegen: number }) {
  const r = resultaat(voor, tegen)
  return (
    <span className="inline-flex items-center gap-[7px] whitespace-nowrap">
      <b className="font-display text-[17px] tabular-nums">
        {voor}–{tegen}
      </b>
      <span
        className={`inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-[6px] font-display text-[12px] font-bold ${KLEUR[r]}`}
        title={WOORD[r]}
        aria-label={WOORD[r]}
      >
        {r}
      </span>
    </span>
  )
}
