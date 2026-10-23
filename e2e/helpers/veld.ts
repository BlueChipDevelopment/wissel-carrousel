import type { Page } from '@playwright/test'

/** Het veldje in de e2e-tests: plekken in de viewBox, slepen en de namen op het veld uitlezen. */

/** viewBox van het veldje in de bewerkbare stand: 300 breed, 425 veld + 78 bank. */
export const VIEW = { w: 300, h: 503 }
export const PLEK = { bank0: [40, 455], verdedigerLinks: [72, 288], goal: [150, 355], bank: [150, 462] } as const

/** Namen van de markers op het veld, in tekenvolgorde (letter, naam, letter, naam, …). */
export async function markerNamen(page: Page): Promise<{ bank: string[]; veld: string[] }> {
  return page.getByRole('img', { name: /Opstelling op het veld/ }).evaluate((svg) => {
    const t = [...svg.querySelectorAll('text')].map((x) => x.textContent ?? '')
    const bank: string[] = []
    const veld: string[] = []
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i] === 'B') bank.push(t[i + 1])
      else if (['K', 'V', 'A', 'M', 'S'].includes(t[i])) veld.push(t[i + 1])
    }
    return { bank, veld }
  })
}

/** Sleept met de muis (pointer events) van de ene viewBox-plek naar de andere. */
export async function sleep(page: Page, van: readonly [number, number], naar: readonly [number, number]) {
  const svg = page.getByRole('img', { name: /Opstelling op het veld/ })
  await svg.scrollIntoViewIfNeeded()
  const box = await svg.boundingBox()
  if (!box) throw new Error('geen veldje')
  const px = (p: readonly [number, number]) => ({ x: box.x + (p[0] / VIEW.w) * box.width, y: box.y + (p[1] / VIEW.h) * box.height })
  const a = px(van)
  const b = px(naar)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 })
  await page.mouse.move(b.x, b.y, { steps: 5 })
  await page.mouse.up()
}

export async function speeltijden(page: Page): Promise<number[]> {
  const chips = page.locator('section:has-text("Speeltijd") .chip')
  const teksten = await chips.allInnerTexts()
  return teksten.map((t) => Number(t.match(/(\d+)'/)?.[1]))
}
