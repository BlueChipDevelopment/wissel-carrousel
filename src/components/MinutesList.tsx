import { minuten } from '@/domain/schedule'
import type { Blok, Opstelling } from '@/domain/types'
import { Chip } from './RolesPanel'

interface Props {
  blokken: Blok[]
  opstelling: Opstelling
  naam: (id: string) => string
}

/** Speeltijd per speler, compact: één regel chips, meeste minuten eerst. */
export function MinutesList({ blokken, opstelling, naam }: Props) {
  const spelers = [...opstelling.achter, ...opstelling.voor]
  const mins = minuten(blokken, spelers)
  const gesorteerd = spelers
    .slice()
    .sort((a, b) => (mins[b] ?? 0) - (mins[a] ?? 0) || naam(a).localeCompare(naam(b)))

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="eyebrow">Speeltijd</span>
      <div className="flex flex-wrap gap-[6px]">
        {gesorteerd.map((p) => (
          <Chip key={p} kleur={opstelling.achter.includes(p) ? 'achter' : 'voor'}>
            {naam(p)} <span className="tabular-nums text-muted">{mins[p] ?? 0}'</span>
          </Chip>
        ))}
      </div>
    </section>
  )
}
