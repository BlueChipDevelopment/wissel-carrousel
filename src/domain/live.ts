/**
 * Live aanpassen tijdens de wedstrijd. Puur TypeScript, naast schedule.ts.
 *
 * Het plan (`Opstelling` → `blokken()`) blijft het anker. `Live` legt vast wat er echt gebeurt:
 * blokken vóór `huidig` zijn historie, de coach kan het huidige en komende blokken zelf zetten
 * (`handmatig`), en spelers kunnen uitvallen of later komen (`beschikbaarheid`).
 *
 * `herbereken()` bepaalt de niet-handmatige blokken vanaf een index opnieuw:
 *  1. keeper per kwart: binnen een kwart blijft de keeper; een nieuw kwart krijgt de eerste
 *     uit `achter` die nog niet gekeept heeft, anders wie het minst gekeept heeft;
 *  2. bank per blok: het plan, minus wie er niet is; te veel → wie het minst gespeeld heeft
 *     gaat spelen, te weinig → wie het meest gespeeld heeft gaat zitten;
 *  3. eerlijk maken: zolang iemand meer dan één blok voorligt op een ander, ruilen ze in het
 *     eerste blok waar dat kan zonder dat iemand twee blokken achter elkaar zit of (in de
 *     5-minutenstand) vlak vóór of ná zijn keepersbeurt;
 *  4. plekken: wie erin komt neemt de plek over van wie eruit gaat (`vulSlots`), over de
 *     linies heen als het moet.
 * Zonder wijzigingen komt daar bij 8 spelers precies het plan uit (zie live.test.ts).
 */
import { AANTAL_KWARTEN, blokken, positieNamen } from './schedule'
import type { Beschikbaarheid, Blok, Doel, Formatie, Live, LiveBlok, Opstelling, Verschil } from './types'

const VERDEDIGERS = 2
const AANVALLERS = 3
const VELD = VERDEDIGERS + AANVALLERS

function vul(l: string[], n: number): string[] {
  const out = l.slice(0, n)
  while (out.length < n) out.push('')
  return out
}

function naarLiveBlok(b: Pick<Blok, 'keeper' | 'verdedigers' | 'aanval' | 'bank'>): LiveBlok {
  return {
    keeper: b.keeper,
    verdedigers: vul(b.verdedigers, VERDEDIGERS),
    aanval: vul(b.aanval, AANVALLERS),
    bank: [...b.bank],
  }
}

/** De vijf veldplekken op een rij: [links, rechts, voorin…]. */
function veldPlekken(b: LiveBlok): string[] {
  return [...vul(b.verdedigers, VERDEDIGERS), ...vul(b.aanval, AANVALLERS)]
}

function metVeld(b: LiveBlok, veld: string[]): LiveBlok {
  return { ...b, verdedigers: veld.slice(0, VERDEDIGERS), aanval: veld.slice(VERDEDIGERS, VELD) }
}

function opVeld(b: LiveBlok, p: string): boolean {
  return b.keeper === p || b.verdedigers.includes(p) || b.aanval.includes(p)
}

function iedereenIn(b: LiveBlok): string[] {
  return [b.keeper, ...b.verdedigers, ...b.aanval, ...b.bank].filter((p): p is string => !!p)
}

/** Eerste live-stand voor een plan: het plan zelf, eerlijk gemaakt (telt alleen bij 7 of 9). */
export function nieuwLive(plan: Opstelling, huidig = 0): Live {
  const ruw: Live = {
    huidig,
    blokken: blokken(plan).map(naarLiveBlok),
    handmatig: [],
    beschikbaarheid: {},
  }
  return herbereken(plan, ruw, 0)
}

/** Hoort deze live-stand bij dit plan (zelfde aantal blokken)? Anders opnieuw beginnen. */
export function past(plan: Opstelling, live: Live): boolean {
  return live.blokken.length === (plan.wissel === '5min' ? 8 : 4)
}

export function beschikbaar(live: Live, speler: string, h: number): boolean {
  const b = live.beschikbaarheid[speler]
  if (!b) return true
  if (b.vanaf !== undefined && h < b.vanaf) return false
  if (b.tot !== undefined && h >= b.tot) return false
  return true
}

/** Het plan (tijden, kwarten) met de werkelijke bezetting erin — voor alle bestaande componenten. */
export function samengesteld(plan: Opstelling, live: Live): Blok[] {
  return blokken(plan).map((b, i) => {
    const l = live.blokken[i]
    return l ? { ...b, keeper: l.keeper, verdedigers: [...l.verdedigers], aanval: [...l.aanval], bank: [...l.bank] } : b
  })
}

export function zetHuidig(live: Live, h: number): Live {
  return { ...live, huidig: Math.max(0, Math.min(live.blokken.length - 1, h)) }
}

/**
 * Bepaalt de blokken vanaf `vanaf` opnieuw (behalve de handmatige), uitgaande van het plan en
 * van wat er in de blokken ervoor al gespeeld is.
 */
export function herbereken(plan: Opstelling, live: Live, vanaf: number): Live {
  const n = live.blokken.length
  if (!n) return live
  const perKwart = plan.wissel === '5min' ? 2 : 1
  const dur = perKwart === 2 ? 5 : 10
  const spelers = [...plan.achter, ...plan.voor]
  const volgorde = (p: string) => spelers.indexOf(p)
  const start = Math.max(0, Math.min(vanaf, n))
  const planBlokken = blokken(plan).map(naarLiveBlok)
  const aanw = Array.from({ length: n }, (_, h) => spelers.filter((p) => beschikbaar(live, p, h)))
  const out = live.blokken.map((b, h) => (h < start ? naarLiveBlok(b) : naarLiveBlok(planBlokken[h] ?? b)))
  const handmatig = new Set(live.handmatig.filter((h) => h >= 0 && h < n))

  // Handmatige blokken blijven staan, tenzij de bezetting niet meer klopt met wie er is.
  for (const h of handmatig) {
    if (h < start) continue
    const in_ = iedereenIn(live.blokken[h]).sort()
    if (in_.join('|') !== aanw[h].slice().sort().join('|')) handmatig.delete(h)
    else out[h] = naarLiveBlok(live.blokken[h])
  }

  const keeperBlokken = (p: string, tot: number) => out.slice(0, tot).filter((b) => b.keeper === p).length
  /** Verwachte speelminuten: wat er tot blok h gespeeld is plus wat het plan daarna nog geeft. */
  const verwacht = (p: string, h: number) => {
    let m = 0
    for (let j = 0; j < n; j++) {
      const b = j < h || handmatig.has(j) ? out[j] : planBlokken[j]
      if (b && aanw[j].includes(p) && opVeld(b, p)) m += dur
    }
    return m
  }

  // 1: keeper per blok, op volgorde zodat de historie meetelt.
  for (let h = start; h < n; h++) {
    if (handmatig.has(h)) continue
    const a = aanw[h]
    const vorige = h > 0 ? out[h - 1].keeper : null
    let k: string | null = null
    if (h % perKwart !== 0 && vorige && a.includes(vorige)) k = vorige
    else {
      const achterin = plan.achter.filter((p) => a.includes(p))
      const pool = achterin.length ? achterin : a
      const nog = pool.filter((p) => keeperBlokken(p, h) === 0)
      k =
        nog[0] ??
        pool.slice().sort((x, y) => keeperBlokken(x, h) - keeperBlokken(y, h) || volgorde(x) - volgorde(y))[0] ??
        null
    }
    out[h] = { ...out[h], keeper: k }
  }

  /** Mag deze speler in blok h op de bank zonder koud te worden? (Bank ernaast telt alleen als die al vaststaat.) */
  const magZitten = (p: string, h: number, ookVolgende: boolean) =>
    !(h > 0 && out[h - 1].bank.includes(p)) &&
    !(ookVolgende && h < n - 1 && out[h + 1].bank.includes(p)) &&
    (perKwart === 1 || (!(h > 0 && out[h - 1].keeper === p) && !(h < n - 1 && out[h + 1].keeper === p)))

  // 2: bank per blok: het plan, minus wie er niet is of koud zou worden; dan bijvullen of inkorten.
  for (let h = start; h < n; h++) {
    if (handmatig.has(h)) continue
    const a = aanw[h]
    const k = out[h].keeper
    const need = Math.max(0, a.length - (VELD + 1))
    const bank = out[h].bank.filter((p) => a.includes(p) && p !== k && magZitten(p, h, false))
    while (bank.length > need) {
      const p = bank.slice().sort((x, y) => verwacht(x, h) - verwacht(y, h) || volgorde(x) - volgorde(y))[0]
      bank.splice(bank.indexOf(p), 1)
    }
    while (bank.length < need) {
      const vrij = a.filter((p) => p !== k && !bank.includes(p))
      const mag = vrij.filter((p) => magZitten(p, h, false))
      const pool = mag.length ? mag : vrij
      if (!pool.length) break
      bank.push(pool.slice().sort((x, y) => verwacht(y, h) - verwacht(x, h) || volgorde(x) - volgorde(y))[0])
    }
    const veld = a.filter((p) => p !== k && !bank.includes(p))
    out[h] = { keeper: k, verdedigers: veld, aanval: [], bank }
  }

  // 3: eerlijk maken met zo min mogelijk ruilen.
  const doetMee = spelers.filter((p) => aanw.some((a) => a.includes(p)))
  for (let ronde = 0; ronde < 64; ronde++) {
    const m: Record<string, number> = {}
    for (const p of doetMee) m[p] = 0
    for (const b of out) for (const p of iedereenIn(b)) if (opVeld(b, p)) m[p] = (m[p] ?? 0) + dur
    const aflopend = doetMee.slice().sort((x, y) => m[y] - m[x] || volgorde(x) - volgorde(y))
    let geruild = false
    buiten: for (const x of aflopend) {
      for (const y of aflopend.slice().reverse()) {
        if (m[x] - m[y] <= dur) break
        for (let h = start; h < n; h++) {
          if (handmatig.has(h)) continue
          const b = out[h]
          if (!b.bank.includes(y) || b.keeper === x || !opVeld(b, x) || !magZitten(x, h, true)) continue
          b.bank = b.bank.map((p) => (p === y ? x : p))
          b.verdedigers = b.verdedigers.map((p) => (p === x ? y : p))
          b.aanval = b.aanval.map((p) => (p === x ? y : p))
          geruild = true
          break buiten
        }
      }
    }
    if (!geruild) break
  }

  // 4: vaste plekken, doorgeschoven vanaf het laatste vastgelegde blok.
  let vorig = start > 0 ? veldPlekken(out[start - 1]) : vul([], VELD)
  for (let h = start; h < n; h++) {
    if (handmatig.has(h)) {
      vorig = veldPlekken(out[h])
      continue
    }
    const b = out[h]
    const veldSpelers = spelers.filter((p) => p !== b.keeper && opVeld(b, p))
    const plekken = vulVeld(vorig, veldSpelers, (p) => plan.achter.includes(p))
    out[h] = metVeld(b, plekken)
    vorig = plekken
  }

  return { ...live, blokken: out, handmatig: [...handmatig].sort((a, b) => a - b) }
}

/**
 * Als `vulSlots`, maar op een vast aantal plekken: wie blijft houdt zijn plek; wie erin komt
 * neemt bij voorkeur een vrije plek in de eigen linie (achterin → verdediger), anders de
 * eerste vrije plek.
 */
function vulVeld(vorig: string[], nieuw: string[], achterin: (p: string) => boolean): string[] {
  const out = vul([], VELD)
  const wacht = nieuw.slice(0, VELD)
  for (let i = 0; i < VELD; i++) {
    const p = vorig[i]
    if (p && wacht.includes(p)) {
      out[i] = p
      wacht.splice(wacht.indexOf(p), 1)
    }
  }
  const vrij = () => out.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0)
  while (wacht.length && vrij().length) {
    const p = wacht[0]
    const eigen = vrij().find((i) => (i < VERDEDIGERS) === achterin(p))
    out[eigen ?? vrij()[0]] = p
    wacht.shift()
  }
  return out
}

/** Het plan is gewijzigd terwijl de wedstrijd loopt: neem het over vanaf het huidige blok. */
export function vanPlan(plan: Opstelling, live: Live): Live {
  return herbereken(plan, live, live.huidig)
}

/** Speler valt uit of komt later: nieuw venster (leeg object = hele wedstrijd), rest herberekend. */
export function zetBeschikbaarheid(plan: Opstelling, live: Live, speler: string, b: Beschikbaarheid): Live {
  const oud = live.beschikbaarheid[speler]
  const beschikbaarheid = { ...live.beschikbaarheid }
  const leeg = b.vanaf === undefined && b.tot === undefined
  if (leeg) delete beschikbaarheid[speler]
  else beschikbaarheid[speler] = { ...(b.vanaf !== undefined ? { vanaf: b.vanaf } : {}), ...(b.tot !== undefined ? { tot: b.tot } : {}) }
  const grenzen = [b.vanaf, b.tot, oud?.vanaf, oud?.tot].filter((x): x is number => x !== undefined)
  const vanaf = Math.max(live.huidig, grenzen.length ? Math.min(...grenzen) : live.huidig)
  return herbereken(plan, { ...live, beschikbaarheid }, vanaf)
}

type Locatie = { soort: 'goal' } | { soort: 'veld'; i: number } | { soort: 'bank'; i: number } | null

function locatie(b: LiveBlok, p: string): Locatie {
  if (b.keeper === p) return { soort: 'goal' }
  const v = veldPlekken(b).indexOf(p)
  if (v >= 0) return { soort: 'veld', i: v }
  const k = b.bank.indexOf(p)
  if (k >= 0) return { soort: 'bank', i: k }
  return null
}

/**
 * Zet `speler` in blok `h` op `doel`. Staat daar al iemand, dan ruilen ze van plek. Het blok
 * wordt handmatig; de blokken erna worden herberekend.
 */
export function zetOpPlek(plan: Opstelling, live: Live, h: number, speler: string, doel: Doel): Live {
  const bron = live.blokken[h]
  if (!bron) return live
  const van = locatie(bron, speler)
  if (!van) return live
  const b: LiveBlok = { ...bron, bank: [...bron.bank] }
  const veld = veldPlekken(b)

  const haalWeg = (p: string) => {
    if (b.keeper === p) b.keeper = null
    const i = veld.indexOf(p)
    if (i >= 0) veld[i] = ''
    b.bank = b.bank.filter((x) => x !== p)
  }
  const zet = (p: string, l: Locatie) => {
    if (!l) return
    if (l.soort === 'goal') b.keeper = p
    else if (l.soort === 'veld') veld[l.i] = p
    else b.bank.splice(Math.min(l.i, b.bank.length), 0, p)
  }

  let ander: string | null = null
  if (doel.soort === 'goal') ander = b.keeper
  else if (doel.soort === 'veld') ander = veld[doel.i] || null
  if (ander === speler) return live
  if (doel.soort === 'bank' && van.soort === 'bank') return live

  haalWeg(speler)
  if (ander) haalWeg(ander)
  zet(speler, doel.soort === 'bank' ? { soort: 'bank', i: b.bank.length } : doel)
  if (ander) zet(ander, van)

  const blokkenNieuw = live.blokken.map((x, i) => (i === h ? metVeld(b, veld) : x))
  const handmatig = live.handmatig.includes(h) ? live.handmatig : [...live.handmatig, h].sort((a, c) => a - c)
  return herbereken(plan, { ...live, blokken: blokkenNieuw, handmatig }, h + 1)
}

/** Twee spelers in blok `h` van plek laten ruilen (bank ↔ veld, veld ↔ veld, of met de keeper). */
export function wisselPlek(plan: Opstelling, live: Live, h: number, a: string, b: string): Live {
  const blok = live.blokken[h]
  if (!blok) return live
  const doel = locatie(blok, b)
  if (!doel) return live
  return zetOpPlek(plan, live, h, a, doel.soort === 'bank' ? { soort: 'bank' } : doel)
}

/** Waar staat een speler in dit blok, in woorden — of 'afwezig'. */
export function plekOf(blok: Pick<Blok, 'keeper' | 'verdedigers' | 'aanval' | 'bank'>, speler: string, formatie: Formatie): string {
  const namen = positieNamen(formatie)
  if (blok.keeper === speler) return 'goal'
  const i = blok.verdedigers.indexOf(speler)
  if (i >= 0) return namen.achter[i] ?? 'verdediger'
  const j = blok.aanval.indexOf(speler)
  if (j >= 0) return namen.voor[j] ?? 'voorin'
  if (blok.bank.includes(speler)) return 'bank'
  return 'afwezig'
}

/** Wie staat in `nieuw` ergens anders dan in `oud`? Per blok, in blokvolgorde. */
export function verschillen(oud: Blok[], nieuw: Blok[], formatie: Formatie): Verschil[] {
  const out: Verschil[] = []
  const n = Math.max(oud.length, nieuw.length)
  for (let h = 0; h < n; h++) {
    const a = oud[h]
    const b = nieuw[h]
    if (!a || !b) continue
    const spelers = [...new Set([...iedereenIn(a), ...iedereenIn(b)])]
    for (const p of spelers) {
      const van = plekOf(a, p, formatie)
      const naar = plekOf(b, p, formatie)
      if (van !== naar) out.push({ blok: h, speler: p, van, naar })
    }
  }
  return out
}

/** Keepers van een opgeslagen wedstrijd: de werkelijke als die er zijn, anders de eerste vier van het plan. */
export function keepersVan(m: { keepers: string[]; achter: string[] }): string[] {
  return m.keepers.length ? m.keepers : m.achter.slice(0, AANTAL_KWARTEN)
}

/** Keepers zoals echt gespeeld: per kwart elke (onderscheiden) keeper één beurt. */
export function keepersWerkelijk(sch: Blok[]): string[] {
  const out: string[] = []
  for (let q = 0; q < AANTAL_KWARTEN; q++) {
    const gezien = new Set<string>()
    for (const b of sch) {
      if (b.kwart !== q || !b.keeper || gezien.has(b.keeper)) continue
      gezien.add(b.keeper)
      out.push(b.keeper)
    }
  }
  return out
}
