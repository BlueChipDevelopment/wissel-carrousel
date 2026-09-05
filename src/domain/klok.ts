/**
 * Wedstrijdklok: één kwart van 10 minuten, met een wisselmoment op 5 minuten.
 * Puur: de klok bewaart een tijdstip in plaats van te tellen, zodat hij ook klopt als het
 * scherm van de telefoon even uit is geweest. `nu` is altijd Date.now() in milliseconden.
 */
import { AANTAL_KWARTEN, KWART_MIN } from './schedule'

export const KWART_MS = KWART_MIN * 60_000
export const WISSEL_MS = KWART_MS / 2

export interface Klok {
  /** 0..3 */
  kwart: number
  loopt: boolean
  /** Tijdstip waarop de klok (voor het laatst) is gestart; alleen zinvol als `loopt`. */
  gestartOp: number
  /** Verstreken tijd in dit kwart tot aan `gestartOp` (bij pauze: alles tot nu). */
  vast: number
}

export type Signaal = 'wissel' | 'einde'

export function nieuweKlok(kwart = 0): Klok {
  return { kwart, loopt: false, gestartOp: 0, vast: 0 }
}

/** Verstreken milliseconden in het huidige kwart, nooit meer dan een kwart. */
export function verstreken(k: Klok, nu: number): number {
  const ms = k.loopt ? k.vast + Math.max(0, nu - k.gestartOp) : k.vast
  return Math.min(KWART_MS, ms)
}

export function start(k: Klok, nu: number): Klok {
  if (k.loopt) return k
  return { ...k, loopt: true, gestartOp: nu }
}

export function pauzeer(k: Klok, nu: number): Klok {
  if (!k.loopt) return k
  return { ...k, loopt: false, vast: verstreken(k, nu), gestartOp: 0 }
}

export function reset(k: Klok): Klok {
  return nieuweKlok(k.kwart)
}

export function volgendKwart(k: Klok): Klok {
  return nieuweKlok(Math.min(AANTAL_KWARTEN - 1, k.kwart + 1))
}

/** Index in `blokken()` die bij de klokstand hoort. */
export function blokVanKlok(k: Klok, nu: number, vijf: boolean): number {
  if (!vijf) return k.kwart
  return k.kwart * 2 + (verstreken(k, nu) >= WISSEL_MS ? 1 : 0)
}

/** Welke grenzen tussen twee metingen gepasseerd zijn: het wisselmoment en het einde. */
export function signalen(vorigMs: number, nuMs: number): Signaal[] {
  const s: Signaal[] = []
  if (vorigMs < WISSEL_MS && nuMs >= WISSEL_MS) s.push('wissel')
  if (vorigMs < KWART_MS && nuMs >= KWART_MS) s.push('einde')
  return s
}
