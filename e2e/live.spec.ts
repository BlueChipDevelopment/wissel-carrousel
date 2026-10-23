import { expect, test, type Page } from '@playwright/test'
import { PLEK, markerNamen, sleep, speeltijden } from './helpers/veld'

/**
 * Live aanpassen langs de lijn, in de demo-stand. Elke test begint met een lege browser
 * (dus het seed-team JO8-1 en een nieuwe wedstrijd op de komende zaterdag).
 */

async function openTeam(page: Page) {
  await page.goto('/team/jo8-1')
  await expect(page.getByText('Demo-stand.')).toBeVisible()
  await expect(page.getByRole('img', { name: /Opstelling op het veld/ })).toBeVisible()
  // Webfonts verschuiven de layout nog even na de eerste render; anders slaat een sleep mis.
  await page.evaluate(() => document.fonts.ready)
}

test('slepen vóór de aftrap past de beginopstelling aan: wissel erin, de ander eruit, iedereen op 30', async ({ page }) => {
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

test('keeper naar de bank vóór de aftrap: de wissel achterin keept, het veld blijft staan (ook op een ander blok)', async ({ page }) => {
  await openTeam(page)
  const voor = await markerNamen(page)
  const keeper = voor.veld[0]

  await sleep(page, PLEK.goal, PLEK.bank)

  await expect(page.getByRole('button', { name: `↶ Ongedaan: ${keeper} naar de bank` })).toBeVisible()
  const na = await markerNamen(page)
  expect(na.bank).toContain(keeper)
  expect(na.veld).not.toContain(keeper)
  await expect(page.getByRole('img', { name: /Opstelling op het veld/ })).toBeVisible()

  // Tussen blokken wisselen laat het veld gewoon staan, ook terug naar blok 1.
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

test('een zelf gezet blok krijgt een handje en is weer los te laten', async ({ page }) => {
  await openTeam(page)
  await page.getByRole('tab', { name: /10–15/ }).click()
  const voor = await markerNamen(page)

  await sleep(page, PLEK.bank0, PLEK.verdedigerLinks)

  const tab = page.getByRole('tab', { name: /10–15/ })
  await expect(tab.getByLabel('zelf gezet')).toBeVisible()
  await expect(page.getByRole('tab', { name: /15–20/ }).getByLabel('zelf gezet')).toHaveCount(0)

  await page.getByRole('button', { name: 'zelf gezet · loslaten' }).click()

  await expect(tab.getByLabel('zelf gezet')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '↶ Ongedaan: 10–15 loslaten' })).toBeVisible()
  expect(await markerNamen(page)).toEqual(voor)
})

test('een sleep die nog niet gedeeld is, raakt niet stil kwijt als een andere telefoon net opslaat', async ({ context }) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await openTeam(a)
  await openTeam(b)
  await sleep(a, PLEK.bank0, PLEK.verdedigerLinks)
  await expect(a.getByText('Gedeeld met de andere telefoons.')).toBeVisible()
  await expect(b.getByText('Bijgewerkt vanaf een andere telefoon.')).toBeVisible()

  // A sleept opnieuw; binnen de 400 ms vóór het delen slaat "telefoon B" een nieuwere versie op.
  await sleep(a, PLEK.bank0, PLEK.verdedigerLinks)
  await b.evaluate(() => {
    const key = 'wisselcarrousel.local.v1'
    const s = JSON.parse(localStorage.getItem(key)!)
    s.matches[0] = { ...s.matches[0], opponent: 'Van telefoon B', updatedAt: new Date(Date.now() + 1000).toISOString() }
    localStorage.setItem(key, JSON.stringify(s))
  })

  // A gooit zijn sleep niet weg, maar laat de coach kiezen.
  await expect(a.getByText('Een andere telefoon heeft deze wedstrijd intussen aangepast.')).toBeVisible()
  await expect(a.getByText('Bijgewerkt vanaf een andere telefoon.')).toHaveCount(0)
})

test('verwijderd op een andere telefoon: melding, en een sleep zet hem niet stil terug', async ({ context }) => {
  const a = await context.newPage()
  await openTeam(a)
  await a.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(a.getByText(/^Opgeslagen voor/)).toBeVisible()

  const b = await context.newPage()
  await b.goto('/team/jo8-1/wedstrijden')
  b.once('dialog', (d) => void d.accept())
  await b.getByRole('button', { name: /verwijder/i }).first().click()

  await expect(a.getByText('Deze wedstrijd is op een andere telefoon verwijderd.', { exact: false })).toBeVisible()
  await sleep(a, PLEK.bank0, PLEK.verdedigerLinks)
  await a.waitForTimeout(800)
  const aantal = await a.evaluate(() => JSON.parse(localStorage.getItem('wisselcarrousel.local.v1')!).matches.length)
  expect(aantal).toBe(0)
  await expect(a.getByRole('button', { name: 'Wedstrijd opslaan' })).toBeEnabled()
})
