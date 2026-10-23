import { describe, expect, it } from 'vitest'
import { leesStand, perTeam, resultaat, tegenstander, totaal, type Uitslag } from './uitslagen'

const u = (teamId: string, date: string, voor: number, tegen: number, opponent: string | null = null): Uitslag => ({
  teamId,
  date,
  opponent,
  voor,
  tegen,
})

describe('uitslagen', () => {
  it('resultaat: winst, gelijk, verlies', () => {
    expect(resultaat(7, 3)).toBe('W')
    expect(resultaat(2, 2)).toBe('G')
    expect(resultaat(0, 4)).toBe('V')
  })

  it('totaal telt gespeeld, W/G/V, doelpunten en saldo', () => {
    expect(totaal([u('a', '2026-10-03', 7, 3), u('a', '2026-10-10', 2, 2), u('a', '2026-10-24', 1, 5)])).toEqual({
      gespeeld: 3,
      gewonnen: 1,
      gelijk: 1,
      verloren: 1,
      voor: 10,
      tegen: 10,
      saldo: 0,
    })
    expect(totaal([])).toEqual({ gespeeld: 0, gewonnen: 0, gelijk: 0, verloren: 0, voor: 0, tegen: 0, saldo: 0 })
  })

  it('perTeam geeft elk gevraagd team een totaal, ook zonder uitslagen', () => {
    const r = perTeam([u('a', '2026-10-03', 7, 3), u('b', '2026-10-03', 4, 1), u('x', '2026-10-03', 9, 0)], ['a', 'b', 'c'])
    expect(Object.keys(r)).toEqual(['a', 'b', 'c'])
    expect(r.a.saldo).toBe(4)
    expect(r.b.gewonnen).toBe(1)
    expect(r.c.gespeeld).toBe(0)
  })

  it('leesStand: 7-3, met spaties of een gedachtestreepje; onzin geeft null', () => {
    expect(leesStand('7-3')).toEqual({ voor: 7, tegen: 3 })
    expect(leesStand(' 12 – 0 ')).toEqual({ voor: 12, tegen: 0 })
    expect(leesStand('7:3')).toEqual({ voor: 7, tegen: 3 })
    expect(leesStand('7')).toBeNull()
    expect(leesStand('a-b')).toBeNull()
    expect(leesStand('100-1')).toBeNull()
  })

  it('tegenstander: de naam zonder "(thuis 09:00)", en thuis of uit', () => {
    expect(tegenstander('DOSC O8-2 (uit 08:30)')).toEqual({ naam: 'DOSC O8-2', waar: 'uit' })
    expect(tegenstander("Vliegdorp 't vv O8-2 (thuis 09:00)")).toEqual({ naam: "Vliegdorp 't vv O8-2", waar: 'thuis' })
    expect(tegenstander('SVL O8-1 (uit 08:30, Sportpark Oranjehof)')).toEqual({ naam: 'SVL O8-1', waar: 'uit' })
    expect(tegenstander('Saestum JO8-1')).toEqual({ naam: 'Saestum JO8-1', waar: null })
    expect(tegenstander(null)).toEqual({ naam: 'onbekend', waar: null })
  })
})
