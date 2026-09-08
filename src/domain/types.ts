/**
 * Domeintypes voor het wisselschema. Puur: geen React, geen Supabase.
 *
 * Een speler is hier alleen een id (string). De UI vertaalt ids naar namen.
 */

/** Wisselritme: bankbeurten per kwart (10 min) of per half kwart (5 min). */
export type WisselStand = '5min' | 'kwart'

/** Opstelling van de drie voorin. De achterhoede is altijd keeper + 2 verdedigers. */
export type Formatie = '1-2-3' | '1-2-1-2' | '1-2-2-1'

/** Wat de coach instelt vóór de wedstrijd. */
export interface Opstelling {
  /** Achterin, in keepervolgorde: index 0 keept kwart 1, index 3 keept kwart 4. */
  achter: string[]
  /** Voorin, in opstellingsvolgorde: linksvoor, spits, rechtsvoor, daarna de wissel(s). */
  voor: string[]
  wissel: WisselStand
  formatie: Formatie
}

/** Eén speelblok: een kwart (10 min) of een half kwart (5 min). */
export interface Blok {
  /** 0..3 */
  kwart: number
  /** 0 of 1; altijd 0 in de kwart-stand */
  helft: number
  van: number
  tot: number
  /** duur in minuten */
  min: number
  keeper: string | null
  /** vaste plekken: [links, rechts] */
  verdedigers: string[]
  /** vaste plekken volgens de formatie, bijv. [linksvoor, spits, rechtsvoor] */
  aanval: string[]
  bank: string[]
}

/** Eén wissel bij de start van een blok. */
export interface Wissel {
  plek: string
  erin: string
  eruit: string | null
  /** true: dit is de nieuwe keeper */
  keeper?: boolean
  /** true: de oude keeper schuift naar deze veldplek */
  vanGoal?: boolean
}

/** Werkelijke bezetting van één blok, zoals gespeeld of zoals nu voorzien. */
export interface LiveBlok {
  keeper: string | null
  /** vaste plekken [links, rechts]; '' = leeg */
  verdedigers: string[]
  /** vaste plekken volgens de formatie; '' = leeg */
  aanval: string[]
  bank: string[]
}

/** Beschikbaar in de blokken [vanaf, tot). Ontbreekt = de hele wedstrijd. */
export interface Beschikbaarheid {
  vanaf?: number
  tot?: number
}

/**
 * De werkelijkheid naast het plan: wat er per blok echt gebeurt (blokken vóór `huidig`
 * zijn vastgelegd), wie er uitvalt of later komt, en welke blokken de coach zelf gezet heeft.
 */
export interface Live {
  /** Index van het blok dat nu bezig is; alles ervoor is historie. */
  huidig: number
  blokken: LiveBlok[]
  /** Blokindices die de coach met de hand heeft gezet; blijven staan bij herberekenen. */
  handmatig: number[]
  beschikbaarheid: Record<string, Beschikbaarheid>
}

/** Waar een speler naartoe gesleept wordt. */
export type Doel = { soort: 'goal' } | { soort: 'veld'; i: number } | { soort: 'bank' }

/** Eén verschil tussen twee schema's: speler `speler` stond in blok `blok` op `van`, nu op `naar`. */
export interface Verschil {
  blok: number
  speler: string
  van: string
  naar: string
}
