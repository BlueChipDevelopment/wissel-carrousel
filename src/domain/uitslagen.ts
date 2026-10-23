/**
 * Uitslagen: voor het eigen overzicht van de JO8-teams (geen officiële stand). Puur: de
 * stand per wedstrijd komt uit matches.goals_voor/goals_tegen, de rest wordt hier geteld.
 */

export interface Uitslag {
  teamId: string
  /** YYYY-MM-DD */
  date: string
  opponent: string | null
  voor: number
  tegen: number
}

export type Resultaat = 'W' | 'G' | 'V'

export interface Totaal {
  gespeeld: number
  gewonnen: number
  gelijk: number
  verloren: number
  voor: number
  tegen: number
  saldo: number
}

export function resultaat(voor: number, tegen: number): Resultaat {
  return voor > tegen ? 'W' : voor === tegen ? 'G' : 'V'
}

export function totaal(uitslagen: Uitslag[]): Totaal {
  const t: Totaal = { gespeeld: 0, gewonnen: 0, gelijk: 0, verloren: 0, voor: 0, tegen: 0, saldo: 0 }
  for (const u of uitslagen) {
    const r = resultaat(u.voor, u.tegen)
    t.gespeeld++
    if (r === 'W') t.gewonnen++
    else if (r === 'G') t.gelijk++
    else t.verloren++
    t.voor += u.voor
    t.tegen += u.tegen
  }
  t.saldo = t.voor - t.tegen
  return t
}

/** Totaal per team, in de volgorde van `teamIds`; uitslagen van andere teams tellen niet mee. */
export function perTeam(uitslagen: Uitslag[], teamIds: string[]): Record<string, Totaal> {
  return Object.fromEntries(teamIds.map((id) => [id, totaal(uitslagen.filter((u) => u.teamId === id))]))
}

/** "7-3", "7 – 3" of "7:3" → doelpunten voor en tegen; iets anders → null. */
export function leesStand(s: string): { voor: number; tegen: number } | null {
  const m = /^\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\s*$/.exec(s)
  return m ? { voor: Number(m[1]), tegen: Number(m[2]) } : null
}

/** "DOSC O8-2 (uit 08:30)" → naam en thuis/uit; zo staat het programma in `opponent`. */
export function tegenstander(opponent: string | null): { naam: string; waar: 'thuis' | 'uit' | null } {
  if (!opponent?.trim()) return { naam: 'onbekend', waar: null }
  const m = /^(.*?)\s*\((thuis|uit)\b[^)]*\)\s*$/.exec(opponent)
  return m ? { naam: m[1], waar: m[2] as 'thuis' | 'uit' } : { naam: opponent.trim(), waar: null }
}
