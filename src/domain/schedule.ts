/**
 * Het rekenhart van de wisselcarrousel. Puur TypeScript, 100% testbaar.
 *
 * Uitgangspunten (docs/requirements.md):
 *  - 6 tegen 6: keeper + 2 verdedigers + 3 voorin. Wedstrijd = 4 kwarten van 10 min.
 *  - Twee vaste linies per wedstrijd: `achter` (keeper komt hieruit, elk kwart een andere)
 *    en `voor`. Wie erin komt neemt de plek over van wie eruit gaat; de rest blijft staan.
 *  - In de 5-minutenstand met 4 achterin zit niemand op de bank in het blokje direct vóór
 *    of ná zijn keepersbeurt (anders sta je 15 minuten achter elkaar stil), zit niemand
 *    twee blokjes achter elkaar, en komt iedereen op 30 minuten uit.
 */
import type { Blok, Formatie, Opstelling, Wissel, WisselStand } from './types'

export const KWART_MIN = 10
export const AANTAL_KWARTEN = 4

/**
 * Bankblokken achterin in de 5-minutenstand bij precies 4 spelers achterin.
 * BANK4[blok] = index in `achter[]` (keepervolgorde) van wie dat blokje op de bank zit.
 * Blokken: 0-5, 5-10, ... 35-40. Zie schedule.test.ts voor de eigenschappen die deze
 * verdeling garandeert; hij is met de hand afgeleid en de test bewaakt hem.
 */
export const BANK4 = [2, 3, 2, 0, 3, 1, 0, 1] as const

export interface PositieNamen {
  achter: string[]
  voor: string[]
}

export function positieNamen(formatie: Formatie): PositieNamen {
  return {
    achter: ['verdediger links', 'verdediger rechts'],
    voor:
      formatie === '1-2-1-2'
        ? ['middenvelder', 'spits links', 'spits rechts']
        : ['linksvoor', 'spits', 'rechtsvoor'],
  }
}

/** Houdt spelers op hun plek: alleen de vrijgekomen plekken worden opnieuw gevuld. */
export function vulSlots(vorig: (string | null)[], nieuw: string[]): string[] {
  const res: (string | null)[] = new Array(nieuw.length).fill(null)
  for (let i = 0; i < nieuw.length; i++) {
    const p = vorig[i]
    res[i] = p && nieuw.includes(p) ? p : null
  }
  const wacht = nieuw.filter((p) => !res.includes(p))
  for (let j = 0; j < res.length && wacht.length; j++) {
    if (!res[j]) res[j] = wacht.shift() ?? null
  }
  return res.map((p) => p ?? '')
}

/**
 * Levert de speelblokken: 4 kwarten van 10 min, of 8 blokjes van 5 min.
 * Werkt ook met 7 of 9 spelers; dan zijn de bankbeurten niet meer precies gelijk.
 */
export function blokken(opstelling: Opstelling): Blok[] {
  const achter = opstelling.achter
  const voor = opstelling.voor
  const B = achter.length
  const F = voor.length
  const backBench = Math.max(0, B - 3)
  const frontBench = Math.max(0, F - 3)
  const vijf = opstelling.wissel === '5min'
  const n = vijf ? 8 : 4
  const dur = vijf ? 5 : KWART_MIN

  const out: Blok[] = []
  let vorigeAchter: string[] = []
  let vorigeVoor: string[] = []

  for (let h = 0; h < n; h++) {
    const q = vijf ? Math.floor(h / 2) : h
    const helft = vijf ? h % 2 : 0
    const keeper = B ? achter[q % B] : null

    let bBench: string[] = []
    if (backBench > 0) {
      if (vijf && B === 4) {
        bBench = [achter[BANK4[h]]]
      } else {
        for (let i = 1; i <= backBench; i++) bBench.push(achter[(((q - i) % B) + B) % B])
      }
    }
    const verdedigers = achter.filter((p) => p !== keeper && !bBench.includes(p))

    const fBench: string[] = []
    for (let j = 0; j < frontBench; j++) {
      fBench.push(voor[((((h - 1) * frontBench + j) % F) + F) % F])
    }
    const aanval = voor.filter((p) => !fBench.includes(p))

    vorigeAchter = vulSlots(vorigeAchter, verdedigers)
    vorigeVoor = vulSlots(vorigeVoor, aanval)

    out.push({
      kwart: q,
      helft,
      van: h * dur,
      tot: (h + 1) * dur,
      min: dur,
      keeper,
      verdedigers: [...vorigeAchter],
      aanval: [...vorigeVoor],
      bank: [...bBench, ...fBench],
    })
  }
  return out
}

/** Speelminuten per speler over de hele wedstrijd. */
export function minuten(sch: Blok[], spelers: string[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const p of spelers) m[p] = 0
  for (const k of sch) {
    for (const p of [k.keeper, ...k.verdedigers, ...k.aanval]) {
      if (p) m[p] = (m[p] ?? 0) + k.min
    }
  }
  return m
}

/** Startminuten van de bankbeurten van een speler. */
export function bankTijden(sch: Blok[], speler: string): number[] {
  return sch.filter((b) => b.bank.includes(speler)).map((b) => b.van)
}

/** Waar staat een speler in dit blok? */
export function plekVan(blok: Blok, speler: string, formatie: Formatie): string {
  const namen = positieNamen(formatie)
  if (blok.keeper === speler) return 'goal'
  const i = blok.verdedigers.indexOf(speler)
  if (i >= 0) return namen.achter[i] ?? 'verdediger'
  const j = blok.aanval.indexOf(speler)
  if (j >= 0) return namen.voor[j] ?? 'voorin'
  return 'bank'
}

/**
 * Wie gaat er voor wie het veld in, van blok i-1 naar blok i.
 * De wisselspeler komt altijd terug in zijn eigen linie, dus die koppelen we aan elkaar.
 */
export function wisselParen(sch: Blok[], i: number, opstelling: Opstelling): Wissel[] {
  if (i < 1 || i >= sch.length) return []
  const nu = sch[i]
  const v = sch[i - 1]
  const paren: Wissel[] = []

  if (nu.keeper !== v.keeper && nu.keeper) {
    paren.push({ plek: 'goal', erin: nu.keeper, eruit: v.keeper, keeper: true })
    if (v.keeper) {
      const oud = plekVan(nu, v.keeper, opstelling.formatie)
      if (oud !== 'bank') paren.push({ plek: oud, erin: v.keeper, eruit: null, vanGoal: true })
    }
  }

  const achterin = (p: string) => opstelling.achter.includes(p)
  const erin = v.bank.filter((p) => !nu.bank.includes(p))
  const eruit = nu.bank.filter((p) => !v.bank.includes(p))

  for (const p of erin) {
    let uit: string | null = null
    const j = eruit.findIndex((x) => achterin(x) === achterin(p))
    if (j >= 0) uit = eruit.splice(j, 1)[0]
    else if (eruit.length) uit = eruit.shift() ?? null
    paren.push({ plek: plekVan(nu, p, opstelling.formatie), erin: p, eruit: uit })
  }
  return paren
}

/**
 * Verdeelt de aanwezige spelers in twee linies. Wie het minst gekeept heeft gaat
 * achterin, met een beetje toeval bij gelijke stand. `keeperbeurten` is een teller
 * per speler-id (ontbrekend = 0).
 */
export function hussel(
  aanwezig: string[],
  keeperbeurten: Record<string, number>,
  random: () => number = Math.random,
): Pick<Opstelling, 'achter' | 'voor'> {
  const pool = aanwezig
    .map((p) => ({ p, k: keeperbeurten[p] ?? 0, r: random() }))
    .sort((a, b) => a.k - b.k || a.r - b.r)
    .map((x) => x.p)
  const half = Math.min(4, Math.ceil(pool.length / 2))
  return { achter: pool.slice(0, half), voor: pool.slice(half) }
}

/** Standaardverdeling voor een lijst spelers: eerste (max) 4 achterin, rest voorin. */
export function standaardVerdeling(spelers: string[]): Pick<Opstelling, 'achter' | 'voor'> {
  const n = Math.max(1, Math.min(4, spelers.length - 3))
  return { achter: spelers.slice(0, n), voor: spelers.slice(n) }
}

/** De keepers van deze wedstrijd, in kwartvolgorde. */
export function keepers(opstelling: Opstelling): string[] {
  return opstelling.achter.slice(0, AANTAL_KWARTEN)
}

/** Waarschuwing voor de coach als de bezetting niet klopt, anders null. */
export function waarschuwing(opstelling: Opstelling): string | null {
  const n = opstelling.achter.length + opstelling.voor.length
  if (n < 6) return `Met ${n} spelers krijg je geen 6 tegen 6 rond — je hebt er minstens 6 nodig.`
  if (opstelling.achter.length < 3)
    return `Achterin staan er maar ${opstelling.achter.length}. Schuif er eentje naar achteren, anders mist er een verdediger.`
  if (opstelling.voor.length < 3)
    return `Voorin staan er maar ${opstelling.voor.length}. Schuif er eentje naar voren, anders mist er een aanvaller.`
  if (n !== 8)
    return `${n} spelers: de bankbeurten zijn dan niet meer precies gelijk. Kijk bij de speelminuten wie er tekort komt.`
  if (opstelling.wissel === '5min' && opstelling.achter.length !== 4)
    return `Met ${opstelling.achter.length} spelers achterin valt de keepercarrousel weg; de bank achterin loopt dan per kwart.`
  return null
}

export const WISSEL_STANDEN: { value: WisselStand; label: string; hint: string }[] = [
  {
    value: '5min',
    label: 'Elke 5 minuten — 2 × 5 min bank',
    hint: 'Niemand zit langer dan 5 minuten stil, en achterin grenst geen bankbeurt aan een keepersbeurt.',
  },
  {
    value: 'kwart',
    label: 'Per kwart — 1 × 10 min bank',
    hint: 'Rustiger langs de lijn: twee wisselmomenten minder per kwart, maar wel 10 minuten stilzitten.',
  },
]

export const FORMATIES: { value: Formatie; label: string }[] = [
  { value: '1-2-3', label: '1-2-3 — keeper, 2 achter, 3 voor' },
  { value: '1-2-1-2', label: '1-2-1-2 — met een middenvelder' },
]

/**
 * Keeperbeurten per speler uit eerder opgeslagen opstellingen: van elke wedstrijd tellen
 * de eerste vier van `achter` (de keepers van kwart 1 t/m 4). Geef alleen gespeelde
 * wedstrijden mee (datum <= vandaag).
 */
export function keeperTally(achterLijsten: string[][]): Record<string, number> {
  const t: Record<string, number> = {}
  for (const achter of achterLijsten) {
    for (const p of achter.slice(0, AANTAL_KWARTEN)) t[p] = (t[p] ?? 0) + 1
  }
  return t
}
