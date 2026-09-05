import { useCallback, useEffect, useRef, useState } from 'react'
import {
  KWART_MS,
  WISSEL_MS,
  blokVanKlok,
  nieuweKlok,
  pauzeer,
  reset,
  signalen,
  start,
  verstreken,
  volgendKwart,
  type Klok,
  type Signaal,
} from '@/domain/klok'
import { AANTAL_KWARTEN } from '@/domain/schedule'

interface Props {
  /** Sleutel om de klokstand te bewaren, bijv. het team-id. */
  sleutel: string
  vijf: boolean
  /** Wordt aangeroepen als de klok een ander speelblok in gaat. */
  onBlok: (i: number) => void
}

/**
 * Wedstrijdklok per kwart van 10 minuten. Piept en trilt op 5 minuten (wissel) en op 10
 * minuten (einde kwart), en zet het actieve blok mee zodat het veldje klaarstaat.
 */
export function MatchClock({ sleutel, vijf, onBlok }: Props) {
  const opslagKey = `klok:${sleutel}`
  const [klok, setKlok] = useState<Klok>(() => lees(opslagKey))
  const [nu, setNu] = useState(() => Date.now())
  const vorigMs = useRef<number>(verstreken(klok, Date.now()))
  const vorigBlok = useRef<number | null>(null)
  const audio = useRef<AudioContext | null>(null)

  // Ander team: klokstand van dat team laden.
  useEffect(() => {
    const k = lees(opslagKey)
    setKlok(k)
    vorigMs.current = verstreken(k, Date.now())
    vorigBlok.current = null
  }, [opslagKey])

  useEffect(() => {
    try {
      localStorage.setItem(opslagKey, JSON.stringify(klok))
    } catch {
      /* privé-venster of vol: dan geen geheugen */
    }
  }, [klok, opslagKey])

  // Tikken zolang de klok loopt.
  useEffect(() => {
    if (!klok.loopt) return
    const id = window.setInterval(() => setNu(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [klok.loopt])

  const ms = verstreken(klok, nu)
  const blok = blokVanKlok(klok, nu, vijf)

  // Grenzen gepasseerd? Dan piepen, trillen en bij het einde stoppen.
  useEffect(() => {
    const s = signalen(vorigMs.current, ms)
    vorigMs.current = ms
    if (!s.length) return
    if (s.includes('einde')) {
      meld('einde', audio.current)
      setKlok((k) => pauzeer(k, Date.now()))
    } else {
      meld('wissel', audio.current)
    }
  }, [ms])

  // Actieve blok mee laten lopen.
  useEffect(() => {
    if (vorigBlok.current === blok) return
    vorigBlok.current = blok
    onBlok(blok)
  }, [blok, onBlok])

  const zetKlok = useCallback((f: (k: Klok) => Klok) => {
    const t = Date.now()
    setNu(t)
    setKlok((k) => f(k))
  }, [])

  const klaar = ms >= KWART_MS
  const laatsteKwart = klok.kwart >= AANTAL_KWARTEN - 1
  const totWissel = WISSEL_MS - ms
  const totEinde = KWART_MS - ms

  const doeStart = () => {
    // AudioContext mag alleen na een tik van de gebruiker; daarom hier.
    if (!audio.current && 'AudioContext' in window) audio.current = new AudioContext()
    audio.current?.resume().catch(() => {})
    zetKlok((k) => start(k, Date.now()))
  }

  return (
    <div className="card no-print flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
      <div className="flex flex-1 items-center gap-4">
        <span
          className={`font-display text-[44px] leading-none font-bold tabular-nums ${klaar ? 'text-voor' : ''}`}
          aria-live="off"
        >
          {mmss(ms)}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-muted">
            Kwart {klok.kwart + 1}
          </span>
          <span className="hint whitespace-nowrap">
            {klaar ? 'einde kwart' : ms < WISSEL_MS ? `wissel over ${mmss(totWissel)}` : `einde over ${mmss(totEinde)}`}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {klaar ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={laatsteKwart}
            onClick={() => zetKlok(volgendKwart)}
          >
            {laatsteKwart ? 'Afgelopen' : `Kwart ${klok.kwart + 2} klaarzetten`}
          </button>
        ) : klok.loopt ? (
          <button type="button" className="btn" onClick={() => zetKlok((k) => pauzeer(k, Date.now()))}>
            Pauze
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={doeStart}>
            {ms > 0 ? 'Verder' : 'Start'}
          </button>
        )}
        <button type="button" className="btn btn-small" disabled={ms === 0 && !klok.loopt} onClick={() => zetKlok(reset)}>
          Reset
        </button>
        {!laatsteKwart && !klaar && ms > 0 && !klok.loopt && (
          <button type="button" className="btn btn-small" onClick={() => zetKlok(volgendKwart)}>
            Volgend kwart
          </button>
        )}
        {klok.kwart > 0 && !klok.loopt && ms === 0 && (
          <button type="button" className="btn btn-small" onClick={() => zetKlok(() => nieuweKlok())}>
            Naar kwart 1
          </button>
        )}
      </div>
    </div>
  )
}

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function lees(key: string): Klok {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const k = JSON.parse(raw) as Klok
      if (typeof k.kwart === 'number' && typeof k.vast === 'number') return k
    }
  } catch {
    /* geen of kapotte opslag */
  }
  return nieuweKlok()
}

/** Piep (twee tonen bij het einde) en tril, voor zover de telefoon dat toelaat. */
function meld(s: Signaal, ctx: AudioContext | null) {
  try {
    navigator.vibrate?.(s === 'einde' ? [300, 150, 300, 150, 300] : [250, 100, 250])
  } catch {
    /* niet ondersteund */
  }
  if (!ctx) return
  const tonen = s === 'einde' ? [880, 880, 1175] : [988, 1319]
  tonen.forEach((f, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.value = f
    g.gain.value = 0.15
    o.connect(g).connect(ctx.destination)
    const t = ctx.currentTime + i * 0.28
    o.start(t)
    o.stop(t + 0.2)
  })
}
