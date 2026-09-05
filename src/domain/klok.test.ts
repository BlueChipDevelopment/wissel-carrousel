import { describe, expect, it } from 'vitest'
import { KWART_MS, WISSEL_MS, blokVanKlok, nieuweKlok, pauzeer, reset, signalen, start, verstreken, volgendKwart } from './klok'

const MIN = 60_000

describe('klok — starten, pauzeren, hervatten', () => {
  it('begint stilstaand op kwart 1 met 0 verstreken', () => {
    const k = nieuweKlok()
    expect(k.kwart).toBe(0)
    expect(k.loopt).toBe(false)
    expect(verstreken(k, 12_345)).toBe(0)
  })

  it('telt door vanaf het moment van starten', () => {
    const k = start(nieuweKlok(), 1000)
    expect(k.loopt).toBe(true)
    expect(verstreken(k, 1000 + 3 * MIN)).toBe(3 * MIN)
  })

  it('bevriest bij pauzeren en telt na hervatten verder', () => {
    let k = start(nieuweKlok(), 0)
    k = pauzeer(k, 2 * MIN)
    expect(k.loopt).toBe(false)
    expect(verstreken(k, 9 * MIN)).toBe(2 * MIN)
    k = start(k, 10 * MIN)
    expect(verstreken(k, 11 * MIN)).toBe(3 * MIN)
  })

  it('starten van een lopende klok verandert niets', () => {
    const k = start(nieuweKlok(), 0)
    expect(start(k, 5 * MIN)).toEqual(k)
  })

  it('stopt bij 10 minuten: verstreken loopt niet voorbij het kwart', () => {
    const k = start(nieuweKlok(), 0)
    expect(verstreken(k, 14 * MIN)).toBe(KWART_MS)
  })

  it('reset zet het kwart terug op 0 verstreken en stilstaand', () => {
    const k = reset(start(volgendKwart(nieuweKlok()), 0))
    expect(k.kwart).toBe(1)
    expect(k.loopt).toBe(false)
    expect(verstreken(k, 99 * MIN)).toBe(0)
  })

  it('volgendKwart gaat naar het volgende kwart op 0, en niet voorbij kwart 4', () => {
    let k = nieuweKlok()
    for (let i = 1; i <= 3; i++) {
      k = volgendKwart(start(k, 0))
      expect(k.kwart).toBe(i)
      expect(k.loopt).toBe(false)
      expect(verstreken(k, 5 * MIN)).toBe(0)
    }
    expect(volgendKwart(k).kwart).toBe(3)
  })
})

describe('blokVanKlok', () => {
  it('5-minutenstand: blok = kwart × 2, plus 1 na de 5-minutengrens', () => {
    let k = start(nieuweKlok(), 0)
    expect(blokVanKlok(k, 0, true)).toBe(0)
    expect(blokVanKlok(k, WISSEL_MS - 1, true)).toBe(0)
    expect(blokVanKlok(k, WISSEL_MS, true)).toBe(1)
    k = start(volgendKwart(k), 0)
    k = { ...k, kwart: 2 }
    expect(blokVanKlok(k, 0, true)).toBe(4)
    expect(blokVanKlok(k, 7 * MIN, true)).toBe(5)
  })

  it('kwartstand: blok = kwart', () => {
    const k = start({ ...nieuweKlok(), kwart: 3 }, 0)
    expect(blokVanKlok(k, 7 * MIN, false)).toBe(3)
  })
})

describe('signalen', () => {
  it('geeft "wissel" precies bij het passeren van 5 minuten', () => {
    expect(signalen(WISSEL_MS - 1, WISSEL_MS)).toEqual(['wissel'])
    expect(signalen(WISSEL_MS, WISSEL_MS + 500)).toEqual([])
    expect(signalen(0, 500)).toEqual([])
  })

  it('geeft "einde" bij het bereiken van 10 minuten', () => {
    expect(signalen(KWART_MS - 1, KWART_MS)).toEqual(['einde'])
    expect(signalen(KWART_MS, KWART_MS)).toEqual([])
  })

  it('geeft beide als een grote sprong beide grenzen passeert (scherm was uit)', () => {
    expect(signalen(4 * MIN, KWART_MS)).toEqual(['wissel', 'einde'])
  })
})
