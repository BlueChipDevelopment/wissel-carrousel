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
 * Eén kwart aan geluid (public/kwart.mp3, zie scripts/maak-kwartaudio.mjs): stilte met een
 * piep op 5:00 en een dubbele piep op 10:00. De audiospeler van de telefoon houdt de tijd
 * bij, ook met het scherm op slot — JavaScript-timers worden dan stilgezet, dit niet.
 */
const KWART_AUDIO = '/kwart.mp3'

/**
 * Wedstrijdklok per kwart van 10 minuten. Piept en trilt op 5 minuten (wissel) en op 10
 * minuten (einde kwart), en zet het actieve blok mee zodat het veldje klaarstaat. Zolang de
 * klok loopt blijft het scherm aan (Wake Lock) en loopt het kwart-geluid mee.
 */
export function MatchClock({ sleutel, vijf, onBlok }: Props) {
  const opslagKey = `klok:${sleutel}`
  const [klok, setKlok] = useState<Klok>(() => lees(opslagKey))
  const [nu, setNu] = useState(() => Date.now())
  const vorigMs = useRef<number>(verstreken(klok, Date.now()))
  const vorigBlok = useRef<number | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const speler = useRef<HTMLAudioElement>(null)
  /** Het kwart-geluid kon niet starten (browser blokkeert, bestand mist): dan de piep uit JS. */
  const geluidFaalt = useRef(false)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

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
      meld('einde', geluidFaalt.current ? audio.current : null)
      setKlok((k) => pauzeer(k, Date.now()))
    } else {
      meld('wissel', geluidFaalt.current ? audio.current : null)
    }
  }, [ms])

  // Actieve blok mee laten lopen.
  useEffect(() => {
    if (vorigBlok.current === blok) return
    vorigBlok.current = blok
    onBlok(blok)
  }, [blok, onBlok])

  // Kwart-geluid en scherm-aan volgen de klok: aan bij lopen, uit bij pauze/einde.
  useEffect(() => {
    const el = speler.current
    if (!klok.loopt) {
      el?.pause()
      wakeLock.current?.release().catch(() => {})
      wakeLock.current = null
      return
    }
    const sync = () => {
      const el = speler.current
      if (!el || !klok.loopt) return
      const doel = verstreken(klok, Date.now()) / 1000
      if (Math.abs(el.currentTime - doel) > 1.5) el.currentTime = doel
      if (el.paused && doel < KWART_MS / 1000) {
        el.play().catch(() => {
          geluidFaalt.current = true
        })
      }
    }
    const houdWakker = () => {
      if (document.visibilityState !== 'visible' || wakeLock.current) return
      navigator.wakeLock
        ?.request('screen')
        .then((lock) => {
          wakeLock.current = lock
          lock.addEventListener('release', () => {
            if (wakeLock.current === lock) wakeLock.current = null
          })
        })
        .catch(() => {})
    }
    const terug = () => {
      if (document.visibilityState !== 'visible') return
      sync()
      houdWakker()
    }
    sync()
    houdWakker()
    document.addEventListener('visibilitychange', terug)
    return () => document.removeEventListener('visibilitychange', terug)
  }, [klok])

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
    // Geluid mag alleen na een tik van de gebruiker; daarom hier, vóór de state-update.
    const el = speler.current
    if (el) {
      el.currentTime = ms / 1000
      el.play().catch(() => {
        geluidFaalt.current = true
      })
    } else {
      geluidFaalt.current = true
    }
    if (!audio.current && 'AudioContext' in window) audio.current = new AudioContext()
    audio.current?.resume().catch(() => {})
    zetKlok((k) => start(k, Date.now()))
  }

  return (
    <div className="card no-print flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
      <audio ref={speler} src={KWART_AUDIO} preload="auto" playsInline aria-hidden="true" data-testid="kwart-geluid" />
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
      {klok.loopt && (
        <p className="hint basis-full">
          Het piepje komt uit de audiospeler en klinkt ook met het scherm op slot; zet het geluid van je
          telefoon aan.
        </p>
      )}
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

/**
 * Tril, en piep uit JS als het kwart-geluid niet loopt (`ctx` null = het geluid loopt wel).
 * Trillen kan alleen als de pagina in beeld is; het geluid is daarom de hoofdzaak.
 */
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
