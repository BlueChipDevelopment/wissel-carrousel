import { describe, expect, it } from 'vitest'
import {
  beschikbaar,
  herbereken,
  keepersWerkelijk,
  nieuwLive,
  past,
  samengesteld,
  vanPlan,
  verschillen,
  wisselPlek,
  zetBeschikbaarheid,
  zetHuidig,
  zetOpPlek,
} from './live'
import { blokken, minuten } from './schedule'
import type { Blok, Live, Opstelling } from './types'

const JO8: Opstelling = {
  achter: ['Mees', 'Sara', 'Christopher', 'Floris'],
  voor: ['Ties', 'Julan', 'Guus', 'Adam'],
  wissel: '5min',
  formatie: '1-2-3',
}
const KWART: Opstelling = { ...JO8, wissel: 'kwart' }
const ALLE = [...JO8.achter, ...JO8.voor]

function aanwezig(live: Live, plan: Opstelling, h: number): string[] {
  return [...plan.achter, ...plan.voor].filter((p) => beschikbaar(live, p, h))
}

/** De harde eisen waar elk live-schema aan moet voldoen. */
function controleer(plan: Opstelling, live: Live) {
  const sch = samengesteld(plan, live)
  const dur = sch[0].min
  sch.forEach((b, h) => {
    const a = aanwezig(live, plan, h)
    const veld = [...b.verdedigers, ...b.aanval].filter(Boolean)
    const iedereen = [b.keeper, ...veld, ...b.bank].filter((p): p is string => !!p)
    expect(new Set(iedereen).size, `blok ${h}: dubbele speler`).toBe(iedereen.length)
    expect(iedereen.slice().sort(), `blok ${h}: niet precies de aanwezigen`).toEqual(a.slice().sort())
    expect(b.verdedigers, `blok ${h}`).toHaveLength(2)
    expect(b.aanval, `blok ${h}`).toHaveLength(3)
    expect(b.bank.length, `blok ${h}: bank`).toBe(Math.max(0, a.length - 6))
    if (a.length) expect(b.keeper, `blok ${h}: keeper`).toBeTruthy()
    if (h > 0) for (const p of b.bank) expect(sch[h - 1].bank, `blok ${h}: ${p} zit twee keer`).not.toContain(p)
  })
  return { sch, dur }
}

function spreiding(sch: Blok[], spelers: string[]) {
  const m = minuten(sch, spelers)
  const v = spelers.map((p) => m[p])
  return Math.max(...v) - Math.min(...v)
}

describe('nieuwLive en samengesteld', () => {
  it('begint als het plan', () => {
    const live = nieuwLive(JO8)
    expect(live.huidig).toBe(0)
    expect(samengesteld(JO8, live)).toEqual(blokken(JO8))
    expect(past(JO8, live)).toBe(true)
    expect(past(KWART, live)).toBe(false)
  })
})

describe('herbereken zonder wijzigingen', () => {
  it('levert het plan op (5 minuten)', () => {
    const live = nieuwLive(JO8)
    expect(herbereken(JO8, live, 0).blokken).toEqual(live.blokken)
    expect(herbereken(JO8, live, 3).blokken).toEqual(live.blokken)
  })
  it('levert het plan op (per kwart)', () => {
    const live = nieuwLive(KWART)
    expect(herbereken(KWART, live, 0).blokken).toEqual(live.blokken)
  })
  it('is stabiel met 7 en 9 spelers en met 3 achterin', () => {
    for (const plan of [
      { ...JO8, voor: JO8.voor.slice(0, 3) },
      { ...JO8, voor: [...JO8.voor, 'Noor'] },
      { ...KWART, achter: JO8.achter.slice(0, 3) },
    ]) {
      const live = nieuwLive(plan)
      controleer(plan, live)
      expect(herbereken(plan, live, 0).blokken).toEqual(live.blokken)
      expect(herbereken(plan, live, 5).blokken).toEqual(live.blokken)
    }
  })
})

describe('beschikbaarheid', () => {
  it('leest het venster [vanaf, tot)', () => {
    const live: Live = { ...nieuwLive(JO8), beschikbaarheid: { Mees: { tot: 3 }, Noor: { vanaf: 2 } } }
    expect(beschikbaar(live, 'Mees', 2)).toBe(true)
    expect(beschikbaar(live, 'Mees', 3)).toBe(false)
    expect(beschikbaar(live, 'Noor', 1)).toBe(false)
    expect(beschikbaar(live, 'Noor', 2)).toBe(true)
    expect(beschikbaar(live, 'Sara', 7)).toBe(true)
  })

  it('speler valt uit vanaf blok 3: rest eerlijk, historie ongemoeid', () => {
    const start = zetHuidig(nieuwLive(JO8), 3)
    const live = zetBeschikbaarheid(JO8, start, 'Guus', { tot: 3 })
    const { sch, dur } = controleer(JO8, live)
    expect(live.blokken.slice(0, 3)).toEqual(start.blokken.slice(0, 3))
    for (let h = 3; h < 8; h++) expect(sch[h].bank).not.toContain('Guus')
    expect(spreiding(sch, ALLE.filter((p) => p !== 'Guus'))).toBeLessThanOrEqual(dur)
  })

  it('de keeper van kwart 3 valt uit: iemand anders achterin keept, niemand dubbel', () => {
    const start = zetHuidig(nieuwLive(JO8), 2)
    const live = zetBeschikbaarheid(JO8, start, 'Christopher', { tot: 2 })
    const { sch } = controleer(JO8, live)
    // Met drie achterin over moet er iemand twee keer: de eerste in de keepervolgorde.
    expect(keepersWerkelijk(sch)).toEqual(['Mees', 'Sara', 'Floris', 'Mees'])
  })

  it('7 spelers vanaf de start: de bank wisselt over de linies heen, iedereen op 30 of 35', () => {
    const plan = { ...JO8, voor: JO8.voor.slice(0, 3) }
    const live = nieuwLive(plan)
    const { sch, dur } = controleer(plan, live)
    const spelers = [...plan.achter, ...plan.voor]
    expect(spreiding(sch, spelers)).toBeLessThanOrEqual(dur)
    const m = minuten(sch, spelers)
    expect(Object.values(m).reduce((a, b) => a + b, 0)).toBe(240)
  })

  it('uitvaller per kwart-stand: rest blijft binnen één blok van elkaar', () => {
    const start = zetHuidig(nieuwLive(KWART), 1)
    const live = zetBeschikbaarheid(KWART, start, 'Adam', { tot: 1 })
    const { sch, dur } = controleer(KWART, live)
    expect(spreiding(sch, ALLE.filter((p) => p !== 'Adam'))).toBeLessThanOrEqual(dur)
  })

  it('speler komt later (vanaf blok 2): speelt mee, de rest zit vaker', () => {
    const plan = { ...JO8, voor: [...JO8.voor, 'Noor'] }
    const start = zetHuidig(nieuwLive(plan), 0)
    const zonder = zetBeschikbaarheid(plan, start, 'Noor', { tot: 0 })
    const live = zetBeschikbaarheid(plan, { ...zonder, huidig: 2 }, 'Noor', { vanaf: 2 })
    const { sch } = controleer(plan, live)
    expect(minuten(sch, ['Noor']).Noor).toBeGreaterThanOrEqual(20)
    for (const h of [0, 1]) {
      expect([...sch[h].verdedigers, ...sch[h].aanval, ...sch[h].bank, sch[h].keeper]).not.toContain('Noor')
    }
  })

  it('weer beschikbaar maken herstelt het plan', () => {
    const start = nieuwLive(JO8)
    const uit = zetBeschikbaarheid(JO8, start, 'Guus', { tot: 2 })
    expect(uit.blokken).not.toEqual(start.blokken)
    const terug = zetBeschikbaarheid(JO8, uit, 'Guus', {})
    expect(terug.blokken).toEqual(start.blokken)
    expect(terug.beschikbaarheid.Guus).toBeUndefined()
  })
})

describe('handmatige wissel', () => {
  it('bank ↔ veld in het huidige blok: de rest compenseert en iedereen blijft op 30', () => {
    const start = zetHuidig(nieuwLive(JO8), 2)
    // Blok 2 (10-15): plan zet Christopher en Julan op de bank. Coach zet Julan erin voor Guus.
    const live = wisselPlek(JO8, start, 2, 'Julan', 'Guus')
    const { sch } = controleer(JO8, live)
    expect(sch[2].bank).toEqual(['Christopher', 'Guus'])
    expect(sch[2].aanval).toContain('Julan')
    expect(live.handmatig).toEqual([2])
    const m = minuten(sch, ALLE)
    for (const p of ALLE) expect(m[p], p).toBe(30)
    // Alleen blokken vanaf 2 veranderen, en de compensatie is één ruil (bank ↔ veld);
    // dat Julan en Guus daarna van plek gewisseld zijn hoort bij "wie erin komt neemt de plek over".
    const v = verschillen(samengesteld(JO8, start), sch, JO8.formatie)
    expect(v.every((x) => x.blok >= 2)).toBe(true)
    const bankwissels = v.filter((x) => x.blok > 2 && (x.van === 'bank' || x.naar === 'bank'))
    expect(bankwissels).toHaveLength(2)
  })

  it('veld ↔ veld ruilt plekken zonder de bank te raken', () => {
    const start = nieuwLive(JO8)
    const live = wisselPlek(JO8, start, 0, 'Sara', 'Ties')
    expect(live.blokken[0].verdedigers[0]).toBe('Ties')
    expect(live.blokken[0].aanval[0]).toBe('Sara')
    expect(live.blokken[0].bank).toEqual(start.blokken[0].bank)
    controleer(JO8, live)
  })

  it('iemand anders op goal: keeper blijft de rest van het kwart, daarna schuift de volgorde door', () => {
    const start = zetHuidig(nieuwLive(JO8), 2)
    const live = wisselPlek(JO8, start, 2, 'Floris', 'Sara')
    const { sch } = controleer(JO8, live)
    expect(sch[2].keeper).toBe('Floris')
    expect(sch[3].keeper).toBe('Floris')
    expect(keepersWerkelijk(sch)).toEqual(['Mees', 'Floris', 'Sara', 'Christopher'])
  })

  it('handmatig blok blijft staan bij een latere herberekening', () => {
    const start = zetHuidig(nieuwLive(JO8), 1)
    const a = wisselPlek(JO8, start, 4, 'Adam', 'Ties')
    const b = zetBeschikbaarheid(JO8, a, 'Mees', { tot: 6 })
    expect(b.blokken[4]).toEqual(a.blokken[4])
    expect(b.handmatig).toContain(4)
    controleer(JO8, b)
  })

  it('handmatig blok vervalt als er een speler uit wegvalt', () => {
    const start = zetHuidig(nieuwLive(JO8), 1)
    const a = wisselPlek(JO8, start, 4, 'Adam', 'Ties')
    const b = zetBeschikbaarheid(JO8, a, 'Adam', { tot: 3 })
    expect(b.handmatig).not.toContain(4)
    controleer(JO8, b)
  })

  it('zetOpPlek: van de bank naar een lege plek', () => {
    const plan = { ...JO8, voor: JO8.voor.slice(0, 1) } // 5 spelers: één plek voorin blijft leeg
    const start = nieuwLive(plan)
    const leeg = start.blokken[0].aanval.indexOf('')
    expect(leeg).toBeGreaterThanOrEqual(0)
    const opBank = zetOpPlek(plan, start, 0, 'Ties', { soort: 'bank' })
    expect(opBank.blokken[0].bank).toEqual(['Ties'])
    const live = zetOpPlek(plan, opBank, 0, 'Ties', { soort: 'veld', i: 2 + leeg })
    expect(live.blokken[0].aanval[leeg]).toBe('Ties')
    expect(live.blokken[0].bank).toEqual([])
    expect([...live.blokken[0].verdedigers, ...live.blokken[0].aanval].filter((p) => p === 'Ties')).toHaveLength(1)
  })

  it('zetOpPlek naar de bank', () => {
    const start = nieuwLive(JO8)
    const live = zetOpPlek(JO8, start, 0, 'Ties', { soort: 'bank' })
    expect(live.blokken[0].bank).toContain('Ties')
    expect(live.blokken[0].aanval).toEqual(['', 'Julan', 'Guus'])
  })
})

describe('vanPlan', () => {
  it('neemt een gewijzigd plan over vanaf het huidige blok', () => {
    const start = zetHuidig(nieuwLive(JO8), 4)
    const plan2: Opstelling = { ...JO8, formatie: '1-2-1-2', voor: ['Adam', 'Ties', 'Julan', 'Guus'] }
    const live = vanPlan(plan2, start)
    expect(live.blokken.slice(0, 4)).toEqual(start.blokken.slice(0, 4))
    const { sch, dur } = controleer(plan2, live)
    expect(spreiding(sch, ALLE)).toBeLessThanOrEqual(dur)
    // De nieuwe formatie geldt alleen voor de plekken, niet voor wie er speelt.
    expect(sch[4].aanval).toHaveLength(3)
  })
})

describe('tellen uit de werkelijkheid', () => {
  it('keepersWerkelijk: één per kwart, of twee bij een keeperswissel halverwege', () => {
    expect(keepersWerkelijk(blokken(JO8))).toEqual(JO8.achter)
    expect(keepersWerkelijk(blokken(KWART))).toEqual(JO8.achter)
    const live = wisselPlek(JO8, zetHuidig(nieuwLive(JO8), 3), 3, 'Floris', 'Sara')
    expect(keepersWerkelijk(samengesteld(JO8, live))).toEqual(['Mees', 'Sara', 'Floris', 'Christopher', 'Sara'])
  })

  it('verschillen beschrijft wie van plek verandert', () => {
    const start = nieuwLive(JO8)
    const live = wisselPlek(JO8, start, 0, 'Christopher', 'Sara')
    const v = verschillen(samengesteld(JO8, start), samengesteld(JO8, live), JO8.formatie)
    expect(v).toContainEqual({ blok: 0, speler: 'Christopher', van: 'bank', naar: 'verdediger links' })
    expect(v).toContainEqual({ blok: 0, speler: 'Sara', van: 'verdediger links', naar: 'bank' })
  })
})
