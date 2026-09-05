/**
 * Datums zijn overal `YYYY-MM-DD` (Postgres DATE). Nooit `new Date('YYYY-MM-DD')` gebruiken:
 * dat is UTC-middernacht en geeft in Nederland 's nachts een verkeerde dag.
 */

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Eerstvolgende zaterdag (vandaag als het zaterdag is). */
export function nextSaturdayISO(): string {
  const d = new Date()
  const diff = (6 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

/** Korte weergave met weekdag, bijv. "za 18 okt". */
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
