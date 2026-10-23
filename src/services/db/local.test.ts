import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLocalSource } from './local'
import { ConflictError, type MatchInput } from './types'

const TEAM = '00000000-0000-4000-8000-000000000001'

// Geen jsdom in de unit-tests: een minimale localStorage in het geheugen volstaat.
beforeAll(() => {
  const data = new Map<string, string>()
  const stub = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true })
})

function input(extra: Partial<MatchInput> = {}): MatchInput {
  return {
    teamId: TEAM,
    date: '2026-09-12',
    opponent: 'SVMM',
    wissel: '5min',
    formatie: '1-2-3',
    achter: ['a', 'b', 'c', 'd'],
    voor: ['e', 'f', 'g', 'h'],
    afwezig: [],
    keepers: ['a', 'b', 'c', 'd'],
    keepersVast: false,
    live: null,
    notes: null,
    ...extra,
  }
}

describe('demo-opslag: samenvoegen tussen telefoons', () => {
  beforeEach(() => localStorage.clear())

  it('slaat op als de verwachte versie klopt', async () => {
    const db = createLocalSource()
    const eerste = await db.saveMatch(input())
    const tweede = await db.saveMatch(input({ opponent: 'Aurora' }), eerste.updatedAt)
    expect(tweede.opponent).toBe('Aurora')
    expect(tweede.id).toBe(eerste.id)
  })

  it('weigert als een andere telefoon intussen heeft opgeslagen', async () => {
    const db = createLocalSource()
    const eerste = await db.saveMatch(input())
    await new Promise((r) => setTimeout(r, 2))
    const ander = await db.saveMatch(input({ opponent: 'Van de andere telefoon' }))
    const poging = db.saveMatch(input({ opponent: 'Oud' }), eerste.updatedAt)
    await expect(poging).rejects.toBeInstanceOf(ConflictError)
    await poging.catch((e: ConflictError) => expect(e.huidig.opponent).toBe(ander.opponent))
    expect((await db.getMatch(TEAM, '2026-09-12'))?.opponent).toBe('Van de andere telefoon')
  })

  it('zonder verwachte versie overschrijft hij gewoon', async () => {
    const db = createLocalSource()
    await db.saveMatch(input())
    const m = await db.saveMatch(input({ opponent: 'Toch mijn versie' }))
    expect(m.opponent).toBe('Toch mijn versie')
  })
})

describe('demo-opslag: keepers vastzetten', () => {
  beforeEach(() => localStorage.clear())

  it('zet de keepers vast en laat ze weer los', async () => {
    const db = createLocalSource()
    const m = await db.saveMatch(input())
    const vast = await db.zetKeepers(m.id, ['f', 'a', 'b', 'c'], true)
    expect(vast.keepers).toEqual(['f', 'a', 'b', 'c'])
    expect(vast.keepersVast).toBe(true)
    const los = await db.zetKeepers(m.id, ['a', 'b', 'c', 'd'], false)
    expect(los.keepersVast).toBe(false)
    expect((await db.getMatch(TEAM, '2026-09-12'))?.keepers).toEqual(['a', 'b', 'c', 'd'])
  })

  it('oude opslag zonder keepersVast leest als niet vastgezet', async () => {
    localStorage.setItem(
      'wisselcarrousel.local.v1',
      JSON.stringify({ players: [], matches: [{ ...input(), id: 'x', updatedAt: '2026-09-01T00:00:00Z', keepersVast: undefined }] }),
    )
    const db = createLocalSource()
    expect((await db.getMatch(TEAM, '2026-09-12'))?.keepersVast).toBe(false)
  })
})

describe('demo-opslag: uitslagen', () => {
  beforeEach(() => localStorage.clear())

  it('uitslag invullen, blijft staan bij het opslaan van de opstelling, en weer weghalen', async () => {
    const db = createLocalSource()
    const m = await db.saveMatch(input())
    expect(m.goalsVoor).toBeNull()
    await db.zetUitslag(m.id, { voor: 7, tegen: 3 })
    const opnieuw = await db.saveMatch(input({ opponent: 'SVMM O8-1' }))
    expect([opnieuw.goalsVoor, opnieuw.goalsTegen]).toEqual([7, 3])
    expect(await db.listUitslagen()).toEqual([{ teamId: TEAM, date: '2026-09-12', opponent: 'SVMM O8-1', voor: 7, tegen: 3 }])

    await db.zetUitslag(m.id, null)
    expect(await db.listUitslagen()).toEqual([])
  })
})
