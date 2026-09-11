import type { Beschikbaarheid, Blok, Live, Verschil } from '@/domain/types'
import type { Player } from '@/services/db'

interface Props {
  blokken: Blok[]
  live: Live
  vijf: boolean
  spelers: Player[]
  /** Spelers die volgens het plan afwezig zijn (niet in een linie). */
  afwezig: string[]
  naam: (id: string) => string
  /** Laatste wijziging, voor de undo-knop; null = niets om ongedaan te maken. */
  laatste: string | null
  verschillen: Verschil[]
  onHuidig: (h: number) => void
  onUndo: () => void
  onBeschikbaarheid: (speler: string, b: Beschikbaarheid) => void
  onSluitVerschillen: () => void
}

export function blokLabel(b: Blok, vijf: boolean): string {
  return vijf ? `${b.van}–${b.tot} min` : `kwart ${b.kwart + 1}`
}

/**
 * Live-balk boven het veld: welk blok bezig is (en dus wat vastligt), undo, wat er net
 * veranderd is, en wie er uitvalt of later komt.
 */
export function LivePanel({
  blokken,
  live,
  vijf,
  spelers,
  afwezig,
  naam,
  laatste,
  verschillen,
  onHuidig,
  onUndo,
  onBeschikbaarheid,
  onSluitVerschillen,
}: Props) {
  const h = live.huidig
  const nu = blokken[h]
  const perBlok = new Map<number, Verschil[]>()
  for (const v of verschillen) perBlok.set(v.blok, [...(perBlok.get(v.blok) ?? []), v])

  return (
    <div className="no-print flex flex-col gap-3">
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-[10px]">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Bezig</span>
          <button
            type="button"
            className="btn btn-small"
            aria-label="Vorig blok bezig"
            disabled={h === 0}
            onClick={() => onHuidig(h - 1)}
          >
            ‹
          </button>
          <b className="font-display text-[19px] whitespace-nowrap">{nu ? blokLabel(nu, vijf) : '–'}</b>
          <button
            type="button"
            className="btn btn-small"
            aria-label="Volgend blok bezig"
            disabled={h >= blokken.length - 1}
            onClick={() => onHuidig(h + 1)}
          >
            ›
          </button>
        </div>
        <span className="hint flex-1">
          {h === 0 ? 'Nog niets vastgelegd. ' : `${h} blok${h === 1 ? '' : 'ken'} vastgelegd. `}
          Sleep op het veld om het huidige of een later blok aan te passen; de rest rekent mee.
        </span>
        {laatste && (
          <button type="button" className="btn btn-small" onClick={onUndo}>
            ↶ Ongedaan: {laatste}
          </button>
        )}
      </div>

      {/* Ingeklapt één regel, zodat het veldje op de telefoon niet verschuift bij elke actie. */}
      {verschillen.length > 0 && (
        <details
          key={`${verschillen.length}:${verschillen[0].blok}:${verschillen[0].speler}:${verschillen[0].naar}`}
          className="rounded-lg border border-keeper/45 bg-keeper/15 px-[13px] py-[7px] text-[14px]"
        >
          <summary className="flex cursor-pointer items-baseline justify-between gap-3 select-none">
            <span>
              <b className="font-display text-[14px] uppercase tracking-[0.08em]">Dit verandert</b>{' '}
              <span className="text-muted">
                in {perBlok.size} blok{perBlok.size === 1 ? '' : 'ken'} · toon
              </span>
            </span>
            <button
              type="button"
              className="hint underline"
              onClick={(e) => {
                e.preventDefault()
                onSluitVerschillen()
              }}
            >
              sluit
            </button>
          </summary>
          <ul className="m-0 mt-1 list-none p-0">
            {[...perBlok.entries()].map(([i, lijst]) => (
              <li key={i} className="py-[2px]">
                <span className="text-muted">{blokken[i] ? blokLabel(blokken[i], vijf) : `blok ${i + 1}`}:</span>{' '}
                {lijst.map((v, k) => (
                  <span key={v.speler}>
                    {k > 0 && ', '}
                    <b>{naam(v.speler)}</b> {v.van} → {v.naar}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="card overflow-hidden shadow-none">
        <summary className="cursor-pointer px-[14px] py-[9px] font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-muted select-none">
          Wie valt uit of komt later?
        </summary>
        <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">
          {spelers
            .filter((p) => p.active)
            .map((p) => {
              const b = live.beschikbaarheid[p.id]
              const weg = afwezig.includes(p.id)
              const waarde = weg ? 'weg' : b?.tot !== undefined ? `uit:${b.tot}` : b?.vanaf !== undefined ? `in:${b.vanaf}` : 'mee'
              return (
                <label key={p.id} className="flex items-center justify-between gap-3 rounded-[7px] bg-sunk px-[11px] py-[6px] text-[14px]">
                  <span className={weg ? 'text-muted line-through' : ''}>{naam(p.id)}</span>
                  <select
                    className="field w-auto py-1 text-[14px]"
                    value={waarde}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'mee') onBeschikbaarheid(p.id, {})
                      else if (v.startsWith('uit:')) onBeschikbaarheid(p.id, { tot: Number(v.slice(4)) })
                      else if (v.startsWith('in:')) onBeschikbaarheid(p.id, { vanaf: Number(v.slice(3)) })
                    }}
                  >
                    {weg && <option value="weg">afwezig</option>}
                    <option value="mee">{weg ? 'komt toch — hele wedstrijd' : 'hele wedstrijd'}</option>
                    <optgroup label="Valt uit vanaf">
                      {blokken.map((bl, i) =>
                        i >= h && !weg ? (
                          <option key={`uit:${i}`} value={`uit:${i}`}>
                            valt uit vanaf {blokLabel(bl, vijf)}
                          </option>
                        ) : null,
                      )}
                    </optgroup>
                    <optgroup label="Komt vanaf">
                      {blokken.map((bl, i) =>
                        i >= h ? (
                          <option key={`in:${i}`} value={`in:${i}`}>
                            komt vanaf {blokLabel(bl, vijf)}
                          </option>
                        ) : null,
                      )}
                    </optgroup>
                  </select>
                </label>
              )
            })}
        </div>
      </details>
    </div>
  )
}
