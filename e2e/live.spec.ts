import { expect, test, type Page } from '@playwright/test'

/**
 * Live aanpassen langs de lijn, in de demo-stand. Elke test begint met een lege browser
 * (dus het seed-team JO8-1 en een nieuwe wedstrijd op de komende zaterdag).
 */

/** viewBox van het veldje in de bewerkbare stand: 300 breed, 425 veld + 78 bank. */
const VIEW = { w: 300, h: 503 }
const PLEK = { bank0: [40, 455], verdedigerLinks: [72, 288], goal: [150, 355], bank: [150, 462] } as const

async function openTeam(page: Page) {
  await page.goto('/team/jo8-1')
  await expect(page.getByText('Demo-stand.')).toBeVisible()
  await expect(page.getByRole('img', { name: /Opstelling op het veld/ })).toBeVisible()
  // Webfonts verschuiven de layout nog even na de eerste render; anders slaat een sleep mis.
  await page.evaluate(() => document.fonts.ready)
}

/** Namen van de markers op het veld, in tekenvolgorde (letter, naam, letter, naam, …). */
async function markerNamen(page: Page): Promise<{ bank: string[]; veld: string[] }> {
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
async function sleep(page: Page, van: readonly [number, number], naar: readonly [number, number]) {
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

async function speeltijden(page: Page): Promise<number[]> {
  const chips = page.locator('section:has-text("Speeltijd") .chip')
  const teksten = await chips.allInnerTexts()
  return teksten.map((t) => Number(t.match(/(\d+)'/)?.[1]))
}

test('slepen van de bank naar het veld: wissel nu, compensatie later, iedereen op 30', async ({ page }) => {
  await openTeam(page)
  const voor = await markerNamen(page)
  const wissel = voor.bank[0]
  const eruit = voor.veld[1] // eerste verdediger (index 0 is de keeper)

  await sleep(page, PLEK.bank0, PLEK.verdedigerLinks)

  await expect(page.getByRole('button', { name: `↶ Ongedaan: ${wissel} ↔ ${eruit}` })).toBeVisible()
  await expect(page.getByText('Dit verandert')).toBeVisible()
  const na = await markerNamen(page)
  expect(na.veld).toContain(wissel)
  expect(na.bank).toContain(eruit)
  expect(await speeltijden(page)).toEqual(Array(8).fill(30))
  await expect(page.getByText('Gedeeld met de andere telefoons.')).toBeVisible()
})

test('ongedaan maken zet het plan terug', async ({ page }) => {
  await openTeam(page)
  const voor = await markerNamen(page)
  await sleep(page, PLEK.bank0, PLEK.verdedigerLinks)
  await expect(page.getByRole('button', { name: /Ongedaan/ })).toBeVisible()

  await page.getByRole('button', { name: /Ongedaan/ }).click()

  await expect(page.getByRole('button', { name: /Ongedaan/ })).toHaveCount(0)
  expect(await markerNamen(page)).toEqual(voor)
  expect(await speeltijden(page)).toEqual(Array(8).fill(30))
})

test('een uitvaller vanaf blok 3: de rest wordt eerlijk verdeeld', async ({ page }) => {
  await openTeam(page)
  await page.getByText('Wie valt uit of komt later?').click()
  const select = page.locator('select').filter({ has: page.locator('option[value="uit:2"]') }).first()
  const naam = (await select.locator('..').innerText()).split('\n')[0].trim()

  await select.selectOption('uit:2')

  await expect(page.getByRole('button', { name: `↶ Ongedaan: ${naam} valt uit` })).toBeVisible()
  await expect(page.getByText('Dit verandert')).toBeVisible()
  const minuten = await speeltijden(page)
  const uit = Math.min(...minuten)
  const rest = minuten.filter((m) => m !== uit)
  expect(uit).toBeLessThanOrEqual(10) // de uitvaller speelde hooguit blok 1 en 2
  expect(rest).toHaveLength(7)
  expect(Math.max(...rest) - Math.min(...rest)).toBeLessThanOrEqual(5)
  expect(minuten.reduce((a, b) => a + b, 0)).toBe(240)
})

test('keeper naar de bank: goal leeg, maar het veld blijft staan (ook op een ander blok)', async ({ page }) => {
  await openTeam(page)
  const voor = await markerNamen(page)
  const keeper = voor.veld[0]

  await sleep(page, PLEK.goal, PLEK.bank)

  await expect(page.getByRole('button', { name: `↶ Ongedaan: ${keeper} naar de bank` })).toBeVisible()
  const na = await markerNamen(page)
  expect(na.bank).toContain(keeper)
  expect(na.veld).not.toContain(keeper)
  await expect(page.getByRole('img', { name: /Opstelling op het veld/ })).toBeVisible()

  // Tussen blokken wisselen laat het veld gewoon staan, ook terug naar het blok zonder keeper.
  await page.getByRole('tab', { name: /5–10/ }).click()
  await expect(page.getByRole('img', { name: /Opstelling op het veld/ })).toBeVisible()
  await page.getByRole('tab', { name: /0–5/ }).click()
  await expect(page.getByRole('img', { name: /Opstelling op het veld/ })).toBeVisible()
  await expect(page.getByText('Zet minstens één speler achterin')).toHaveCount(0)
})

test('vastgelegde blokken zijn niet meer te bewerken', async ({ page }) => {
  await openTeam(page)
  await page.getByRole('button', { name: 'Volgend blok bezig' }).click()
  await expect(page.getByText('1 blok vastgelegd.')).toBeVisible()

  await page.getByRole('tab', { name: /0–5/ }).click()
  await expect(page.getByText('vastgelegd', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Opstelling op het veld' })).toBeVisible()

  await page.getByRole('tab', { name: /5–10/ }).click()
  await expect(page.getByRole('img', { name: /sleep spelers/ })).toBeVisible()
})

test('twee tabbladen zien dezelfde wedstrijd', async ({ context }) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await openTeam(a)
  await openTeam(b)
  const voor = await markerNamen(a)

  await sleep(a, PLEK.bank0, PLEK.verdedigerLinks)
  await expect(a.getByText('Gedeeld met de andere telefoons.')).toBeVisible()

  await expect(b.getByText('Bijgewerkt vanaf een andere telefoon.')).toBeVisible()
  const opB = await markerNamen(b)
  expect(opB.veld).toContain(voor.bank[0])
  expect(opB.bank).toContain(voor.veld[1])
})
