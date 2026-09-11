import { FORMATIES, WISSEL_STANDEN, positieNamen, waarschuwing } from '@/domain/schedule'
import type { Formatie, Opstelling, WisselStand } from '@/domain/types'
import type { Player } from '@/services/db'

interface Props {
  spelers: Player[]
  opstelling: Opstelling
  /** Alleen doorgegeven: aanwezigheid regel je in AttendancePanel. */
  afwezig: string[]
  onChange: (next: { opstelling: Opstelling; afwezig: string[] }) => void
  onHussel: () => void
}

/**
 * Instellen van de opstelling. De volgorde van de lijstjes stuurt alles:
 * achterin = keepervolgorde, voorin = opstelling (linksvoor, spits, rechtsvoor, wissel).
 */
export function LineupEditor({ spelers, opstelling, afwezig, onChange, onHussel }: Props) {
  const naam = (id: string) => spelers.find((p) => p.id === id)?.name ?? '?'
  const namen = positieNamen(opstelling.formatie)
  const waarsch = waarschuwing(opstelling)
  /** Vrije stand: 'achter' zijn alleen de keepers, 'voor' is de rest. */
  const vrij = opstelling.wissel === 'vrij'

  const zet = (patch: Partial<Opstelling>, nieuwAfwezig = afwezig) =>
    onChange({ opstelling: { ...opstelling, ...patch }, afwezig: nieuwAfwezig })

  const verschuif = (g: 'achter' | 'voor', idx: number, delta: number) => {
    const arr = [...opstelling[g]]
    const j = idx + delta
    if (j < 0 || j >= arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    zet({ [g]: arr })
  }

  const verplaats = (id: string, van: 'achter' | 'voor') => {
    const naar = van === 'achter' ? 'voor' : 'achter'
    zet({
      [van]: opstelling[van].filter((x) => x !== id),
      [naar]: [...opstelling[naar], id],
    })
  }

  return (
    <section className="no-print flex flex-col gap-3">
      <h2 className="text-[23px] font-semibold tracking-[0.03em]">Opstelling instellen</h2>
      <div className="card p-4">
        <div className="grid gap-5 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          <div>
            <div className="eyebrow">{vrij ? 'Keepers — volgorde = wie wanneer keept' : 'Achterin — volgorde = keepervolgorde'}</div>
            <Lijst
              g="achter"
              ids={opstelling.achter}
              naam={naam}
              vrij={vrij}
              tag={(idx) => (idx < 4 ? `keept K${idx + 1}` : 'reserve')}
              onVerschuif={verschuif}
              onVerplaats={verplaats}
            />
            <div className="eyebrow mt-4">{vrij ? 'De rest — volgorde = opstelling bij de start' : 'Voorin — volgorde = opstelling'}</div>
            <Lijst
              g="voor"
              ids={opstelling.voor}
              naam={naam}
              vrij={vrij}
              tag={(idx) => (vrij ? 'speelt overal' : idx < 3 ? namen.voor[idx] : 'wissel bij start')}
              onVerschuif={verschuif}
              onVerplaats={verplaats}
            />
            <p className="hint mt-2">
              {vrij
                ? 'Met ↑ en ↓ verander je de keepervolgorde. Verder zijn er geen linies: de bank rouleert over iedereen en wie erin komt neemt de plek over van wie eruit gaat.'
                : 'Met ↑ en ↓ verander je de volgorde: achterin bepaalt dat wie wanneer op goal staat, voorin wie linksvoor, spits en rechtsvoor staat. Met de knop rechts schuif je iemand naar de andere linie.'}
            </p>
          </div>

          <div>
            <label className="eyebrow block" htmlFor="wissel">
              Bankbeurten
            </label>
            <select
              id="wissel"
              className="field mt-[9px]"
              value={opstelling.wissel}
              onChange={(e) => zet({ wissel: e.target.value as WisselStand })}
            >
              {WISSEL_STANDEN.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
            <p className="hint mt-2">{WISSEL_STANDEN.find((w) => w.value === opstelling.wissel)?.hint}</p>

            <label className="eyebrow mt-[18px] block" htmlFor="formatie">
              Formatie
            </label>
            <select
              id="formatie"
              className="field mt-[9px]"
              value={opstelling.formatie}
              onChange={(e) => zet({ formatie: e.target.value as Formatie })}
            >
              {FORMATIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="hint mt-2">Verandert alleen waar de drie voorin staan, niet het wisselschema.</p>
          </div>
        </div>

        {waarsch && (
          <div className="mt-3 rounded-lg border border-keeper/45 bg-keeper/15 px-[13px] py-[10px] text-[14px]">
            {waarsch}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={onHussel}>
            {vrij ? 'Hussel de keepers' : 'Hussel de linies'}
          </button>
          <span className="hint">{vrij ? 'Zet wie het langst niet gekeept heeft in de keeperlijst.' : 'Zet wie het langst niet gekeept heeft achterin.'}</span>
        </div>
      </div>
    </section>
  )
}

function Lijst({
  g,
  ids,
  naam,
  vrij,
  tag,
  onVerschuif,
  onVerplaats,
}: {
  g: 'achter' | 'voor'
  ids: string[]
  naam: (id: string) => string
  vrij: boolean
  tag: (idx: number) => string
  onVerschuif: (g: 'achter' | 'voor', idx: number, delta: number) => void
  onVerplaats: (id: string, van: 'achter' | 'voor') => void
}) {
  if (!ids.length) return <p className="hint mt-[9px]">leeg</p>
  const knop = 'inline-flex h-[29px] w-[29px] flex-none items-center justify-center rounded-md border border-line bg-surface text-[13px] disabled:opacity-30 disabled:cursor-default'
  return (
    <div className="mt-[9px] flex flex-col gap-[5px]">
      {ids.map((id, idx) => {
        const isK1 = g === 'achter' && idx === 0
        const kleur = isK1 ? 'var(--color-keeper)' : g === 'achter' ? 'var(--color-achter)' : 'var(--color-voor)'
        return (
          <div
            key={id}
            className={`flex items-center gap-[5px] rounded-lg border px-[5px] py-1 ${
              isK1 ? 'border-keeper/45 bg-keeper/15' : 'border-line bg-sunk'
            }`}
          >
            <span className="mx-1 h-[9px] w-[9px] flex-none rounded-full" style={{ background: kleur }} />
            <div className="flex min-w-0 flex-1 flex-col py-[2px] pr-1 leading-[1.25]">
              <span className="truncate font-medium">{naam(id)}</span>
              <span className="truncate text-[12px] text-muted">{tag(idx)}</span>
            </div>
            <button type="button" className={knop} aria-label="Naar boven" disabled={idx === 0} onClick={() => onVerschuif(g, idx, -1)}>
              ↑
            </button>
            <button type="button" className={knop} aria-label="Naar beneden" disabled={idx === ids.length - 1} onClick={() => onVerschuif(g, idx, 1)}>
              ↓
            </button>
            <button
              type="button"
              className={`${knop} w-auto px-[9px] text-[12.5px]`}
              aria-label={g === 'achter' ? (vrij ? 'Uit de keeperlijst' : 'Naar de voorhoede') : vrij ? 'Naar de keeperlijst' : 'Naar de verdediging'}
              onClick={() => onVerplaats(id, g)}
            >
              {g === 'achter' ? (vrij ? '→ rest' : '→ voorin') : vrij ? '→ keeper' : '→ achterin'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
