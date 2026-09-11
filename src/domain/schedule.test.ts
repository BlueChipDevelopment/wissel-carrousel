import { describe, expect, it } from 'vitest'
import {
  BANK4,
  bankTijden,
  blokken,
  hussel,
  keepers,
  plekVan,
  positieNamen,
  minuten,
  standaardVerdeling,
  toggleAanwezig,
  vulSlots,
  waarschuwing,
  wisselParen,
} from './schedule'
import type { Opstelling } from './types'

const JO8: Opstelling = {
  achter: ['Mees', 'Sara', 'Christopher', 'Floris'],
  voor: ['Ties', 'Julan', 'Guus', 'Adam'],
  wissel: '5min',
  formatie: '1-2-3',
}
const ALLE = [...JO8.achter, ...JO8.voor]

describe('blokken — 5 minuten, 8 spelers', () => {
  const sch = blokken(JO8)

  it('levert 8 blokken van 5 minuten', () => {
    expect(sch).toHaveLength(8)
    expect(sch.map((b) => b.min)).toEqual(Array(8).fill(5))
    expect(sch[7].tot).toBe(40)
  })

  it('zet elk blok precies 6 spelers op het veld en 2 op de bank', () => {
    for (const b of sch) {
      expect(b.keeper).toBeTruthy()
      expect(b.verdedigers).toHaveLength(2)
      expect(b.aanval).toHaveLength(3)
      expect(b.bank).toHaveLength(2)
      const iedereen = [b.keeper, ...b.verdedigers, ...b.aanval, ...b.bank]
      expect(new Set(iedereen).size).toBe(8)
    }
  })

  it('geeft iedereen precies 30 minuten', () => {
    const m = minuten(sch, ALLE)
    for (const p of ALLE) expect(m[p]).toBe(30)
  })

  it('laat de keeper per kwart rouleren in de volgorde van achter[]', () => {
    expect(keepers(JO8)).toEqual(['Mees', 'Sara', 'Christopher', 'Floris'])
    expect(sch.map((b) => b.keeper)).toEqual([
      'Mees', 'Mees', 'Sara', 'Sara', 'Christopher', 'Christopher', 'Floris', 'Floris',
    ])
  })

  it('zet achterin niemand op de bank direct vóór of ná zijn keepersbeurt', () => {
    JO8.achter.forEach((p, kq) => {
      const keeperBlokken = new Set([2 * kq, 2 * kq + 1])
      const bank = sch.map((b, i) => (b.bank.includes(p) ? i : -1)).filter((i) => i >= 0)
      for (const i of bank) {
        expect(keeperBlokken.has(i)).toBe(false)
        expect(keeperBlokken.has(i - 1)).toBe(false)
        expect(keeperBlokken.has(i + 1)).toBe(false)
      }
    })
  })

  it('laat niemand twee blokken achter elkaar op de bank zitten', () => {
    for (let i = 1; i < sch.length; i++) {
      for (const p of sch[i].bank) expect(sch[i - 1].bank).not.toContain(p)
    }
  })

  it('begint met de laatste van elke linie op de bank', () => {
    expect(sch[0].bank).toEqual(['Christopher', 'Adam'])
    expect(bankTijden(sch, 'Adam')).toEqual([0, 20])
  })

  it('BANK4 laat elke achterspeler precies twee keer zitten', () => {
    const teller = [0, 0, 0, 0]
    for (const i of BANK4) teller[i]++
    expect(teller).toEqual([2, 2, 2, 2])
  })
})

describe('blokken — per kwart', () => {
  const sch = blokken({ ...JO8, wissel: 'kwart' })

  it('levert 4 kwarten van 10 minuten met iedereen op 30', () => {
    expect(sch).toHaveLength(4)
    const m = minuten(sch, ALLE)
    for (const p of ALLE) expect(m[p]).toBe(30)
  })

  it('zet de vorige keeper het kwart erna op de bank (de carrousel)', () => {
    expect(sch.map((b) => b.bank[0])).toEqual(['Floris', 'Mees', 'Sara', 'Christopher'])
  })
})

describe('vaste plekken', () => {
  it('laat spelers staan waar ze stonden; alleen de vrijgekomen plek wordt gevuld', () => {
    expect(vulSlots(['A', 'B', 'C'], ['A', 'D', 'C'])).toEqual(['A', 'D', 'C'])
    expect(vulSlots([], ['X', 'Y'])).toEqual(['X', 'Y'])
    expect(vulSlots(['A', 'B'], ['C', 'D'])).toEqual(['C', 'D'])
  })

  it('wisselt voorin altijd één-op-één op dezelfde plek', () => {
    const sch = blokken(JO8)
    for (let i = 1; i < sch.length; i++) {
      const verschil = sch[i].aanval.filter((p, idx) => sch[i - 1].aanval[idx] !== p)
      expect(verschil).toHaveLength(1)
    }
  })
})

describe('wisselParen', () => {
  const sch = blokken(JO8)

  it('is leeg bij de start', () => {
    expect(wisselParen(sch, 0, JO8)).toEqual([])
  })

  it('koppelt de wissel aan iemand uit dezelfde linie', () => {
    const paren = wisselParen(sch, 1, JO8)
    expect(paren).toEqual([
      { plek: 'verdediger rechts', erin: 'Christopher', eruit: 'Floris' },
      { plek: 'linksvoor', erin: 'Adam', eruit: 'Ties' },
    ])
  })

  it('beschrijft een keeperswissel als aparte regel', () => {
    const paren = wisselParen(sch, 2, JO8)
    expect(paren[0]).toMatchObject({ plek: 'goal', erin: 'Sara', keeper: true })
    expect(paren.some((x) => x.vanGoal && x.erin === 'Mees')).toBe(true)
  })
})

describe('andere bezettingen', () => {
  it('7 spelers: rekent door en waarschuwt', () => {
    const o: Opstelling = { ...JO8, achter: JO8.achter, voor: JO8.voor.slice(0, 3) }
    const sch = blokken(o)
    for (const b of sch) expect([b.keeper, ...b.verdedigers, ...b.aanval]).toHaveLength(6)
    expect(waarschuwing(o)).toMatch(/7 spelers/)
  })

  it('9 spelers: twee wissels voorin', () => {
    const o: Opstelling = { ...JO8, voor: [...JO8.voor, 'Noah'] }
    const sch = blokken(o)
    for (const b of sch) {
      expect(b.aanval).toHaveLength(3)
      expect(b.bank).toHaveLength(3)
    }
  })

  it('6 spelers: niemand op de bank, geen waarschuwing over 6 tegen 6', () => {
    const o: Opstelling = { ...JO8, achter: JO8.achter.slice(0, 3), voor: JO8.voor.slice(0, 3) }
    const sch = blokken(o)
    for (const b of sch) expect(b.bank).toHaveLength(0)
    expect(waarschuwing(o)).toMatch(/6 spelers/)
  })

  it('geen waarschuwing bij de standaard 4/4', () => {
    expect(waarschuwing(JO8)).toBeNull()
  })
})

describe('hussel en verdeling', () => {
  it('zet wie het minst gekeept heeft achterin', () => {
    const r = hussel(ALLE, { Mees: 2, Sara: 2, Christopher: 1, Floris: 1 }, () => 0.5)
    expect(r.achter).toHaveLength(4)
    expect(r.achter).toEqual(expect.arrayContaining(['Ties', 'Julan', 'Guus', 'Adam']))
    expect(r.voor).toEqual(expect.arrayContaining(['Mees', 'Sara', 'Christopher', 'Floris']))
  })

  it('standaardverdeling: 4 achter bij 8, 4 achter bij 7, 3 achter bij 6', () => {
    expect(standaardVerdeling(ALLE).achter).toHaveLength(4)
    expect(standaardVerdeling(ALLE.slice(0, 7)).achter).toHaveLength(4)
    expect(standaardVerdeling(ALLE.slice(0, 6)).achter).toHaveLength(3)
  })
})

describe('formaties', () => {
  it('geven drie plekken voorin, elk met een eigen naam', () => {
    for (const f of ['1-2-3', '1-2-1-2', '1-2-2-1'] as const) {
      const namen = positieNamen(f)
      expect(namen.achter).toHaveLength(2)
      expect(namen.voor).toHaveLength(3)
      expect(new Set(namen.voor).size).toBe(3)
    }
    expect(positieNamen('1-2-2-1').voor).toEqual(['middenvelder links', 'middenvelder rechts', 'spits'])
  })

  it('veranderen het wisselschema niet', () => {
    const a = blokken(JO8)
    const b = blokken({ ...JO8, formatie: '1-2-2-1' })
    expect(b).toEqual(a)
  })
})

describe('toggleAanwezig', () => {
  it('haalt een speler uit zijn linie en zet hem terug in de kortste, achteraan', () => {
    const weg = toggleAanwezig(JO8, [], 'Sara')
    expect(weg.achter).toEqual(['Mees', 'Christopher', 'Floris'])
    expect(weg.voor).toEqual(JO8.voor)
    expect(weg.afwezig).toEqual(['Sara'])
    const terug = toggleAanwezig(weg, weg.afwezig, 'Sara')
    expect(terug.achter).toEqual(['Mees', 'Christopher', 'Floris', 'Sara'])
    expect(terug.afwezig).toEqual([])
  })
})

describe('blokken — vrij (keepers vast, bank over iedereen)', () => {
  const VRIJ: Opstelling = { ...JO8, wissel: 'vrij' }
  const sch = blokken(VRIJ)

  it('levert 8 blokken van 5 minuten met iedereen op 30', () => {
    expect(sch).toHaveLength(8)
    const m = minuten(sch, ALLE)
    for (const p of ALLE) expect(m[p], p).toBe(30)
    for (const b of sch) {
      expect([b.keeper, ...b.verdedigers, ...b.aanval]).toHaveLength(6)
      expect(b.bank).toHaveLength(2)
    }
  })

  it('laat de keepers rouleren zoals gepland', () => {
    expect(sch.map((b) => b.keeper)).toEqual(['Mees', 'Mees', 'Sara', 'Sara', 'Christopher', 'Christopher', 'Floris', 'Floris'])
  })

  it('zet de bank ook voor de rest niet twee blokken achter elkaar, en keepers niet naast hun beurt', () => {
    sch.forEach((b, h) => {
      if (h > 0) for (const p of b.bank) expect(sch[h - 1].bank, `blok ${h}: ${p}`).not.toContain(p)
      for (const p of b.bank) {
        if (h > 0) expect(sch[h - 1].keeper, `blok ${h}: ${p} zit na zijn keeperbeurt`).not.toBe(p)
        if (h < 7) expect(sch[h + 1].keeper, `blok ${h}: ${p} zit vóór zijn keeperbeurt`).not.toBe(p)
      }
    })
  })

  it('laat iedereen één keer per helft zitten, en wisselt over de linies heen', () => {
    for (const p of ALLE) {
      const beurten = bankTijden(sch, p)
      expect(beurten, p).toHaveLength(2)
      expect(beurten[0], p).toBeLessThan(20)
      expect(beurten[1], p).toBeGreaterThanOrEqual(20)
    }
    // Iemand uit de "rest" staat ergens als verdediger: de linies zijn los.
    expect(sch.some((b) => b.verdedigers.some((p) => VRIJ.voor.includes(p)))).toBe(true)
  })

  it('houdt spelers op hun plek: wie erin komt neemt de plek van wie eruit gaat', () => {
    for (let h = 1; h < 8; h++) {
      const v = [...sch[h - 1].verdedigers, ...sch[h - 1].aanval]
      const n = [...sch[h].verdedigers, ...sch[h].aanval]
      v.forEach((p, i) => {
        if (n.includes(p)) expect(n[i], `blok ${h}: ${p}`).toBe(p)
      })
    }
  })

  it('rekent 7 en 9 spelers door zonder dubbele bankbeurten', () => {
    for (const o of [{ ...VRIJ, voor: VRIJ.voor.slice(0, 3) }, { ...VRIJ, voor: [...VRIJ.voor, 'Noah'] }]) {
      const s = blokken(o)
      const alle = [...o.achter, ...o.voor]
      for (const b of s) {
        expect([b.keeper, ...b.verdedigers, ...b.aanval].filter(Boolean)).toHaveLength(6)
        expect(b.bank).toHaveLength(alle.length - 6)
      }
      s.forEach((b, h) => {
        if (h > 0) for (const p of b.bank) expect(s[h - 1].bank).not.toContain(p)
      })
      expect(waarschuwing(o)).toMatch(/spelers/)
    }
  })

  it('waarschuwt bij een ander aantal keepers dan 4, niet over verdedigers', () => {
    expect(waarschuwing(VRIJ)).toBeNull()
    expect(waarschuwing({ ...VRIJ, achter: VRIJ.achter.slice(0, 3), voor: [...VRIJ.voor, 'Floris'] })).toMatch(/keepers/)
    expect(waarschuwing({ ...VRIJ, achter: VRIJ.achter.slice(0, 2), voor: [...VRIJ.voor, 'Christopher', 'Floris'] })).not.toMatch(/verdediger/)
  })

  it('wisselParen koppelt de wissel aan wie zijn plek afstaat (binnen een kwart)', () => {
    for (const h of [1, 3, 5, 7]) {
      const paren = wisselParen(sch, h, VRIJ)
      for (const x of paren) {
        if (x.keeper || x.vanGoal) continue
        expect(x.eruit, `blok ${h}: ${x.erin}`).toBeTruthy()
        expect(plekVan(sch[h - 1], x.eruit!, VRIJ.formatie)).toBe(x.plek)
      }
    }
  })
})
