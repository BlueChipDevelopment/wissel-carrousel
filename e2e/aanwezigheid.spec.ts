import { expect, test } from '@playwright/test'

/** Wie is er? staat direct onder de wedstrijdkop; tijdens de wedstrijd krimpt het tot één regel. */
test('afwezig zetten vóór de aftrap, samengevat zodra de wedstrijd loopt', async ({ page }) => {
  await page.goto('/team/jo8-1')
  const paneel = page.getByRole('region', { name: 'Wie is er?' })
  await expect(paneel).toContainText('8 van 8 erbij')

  // Het paneel staat boven het veldje.
  const paneelBox = await paneel.boundingBox()
  const veldBox = await page.getByRole('img', { name: /Opstelling op het veld/ }).boundingBox()
  expect(paneelBox!.y).toBeLessThan(veldBox!.y)

  await paneel.getByRole('button', { name: 'Adam', pressed: true }).click()
  await expect(paneel).toContainText('7 van 8 erbij')
  await expect(paneel).toContainText('afwezig: Adam')
  await expect(page.getByRole('button', { name: /opslaan/ })).toBeEnabled()

  // Wedstrijd loopt: alleen de samenvatting, namen achter "wijzig".
  await page.getByRole('button', { name: 'Volgend blok bezig' }).click()
  await expect(paneel.getByRole('button', { name: 'Adam' })).toHaveCount(0)
  await paneel.getByRole('button', { name: 'wijzig' }).click()
  await paneel.getByRole('button', { name: 'Adam', pressed: false }).click()
  await expect(paneel).toContainText('8 van 8 erbij')
})

test('vrije wissels: keepers vast, de rest zonder linies, iedereen op 30', async ({ page }) => {
  await page.goto('/team/jo8-1')
  await expect(page.getByText('Demo-stand.')).toBeVisible()
  await page.getByLabel('Bankbeurten').selectOption('vrij')
  await expect(page.getByText('Keepers — volgorde = wie wanneer keept')).toBeVisible()
  await expect(page.getByText('De rest — volgorde = opstelling bij de start')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hussel de keepers' })).toBeVisible()
  const chips = page.locator('section:has-text("Speeltijd") .chip')
  const minuten = (await chips.allInnerTexts()).map((t) => Number(t.match(/(\d+)'/)?.[1]))
  expect(minuten).toEqual(Array(8).fill(30))
})

/** Een speler die er na het opslaan bij komt (gastspeler, nieuw kind) staat eerst op afwezig. */
test('nieuwe speler bij een al opgeslagen wedstrijd: eerst afwezig, aantikken en hij speelt mee', async ({ page }) => {
  await page.goto('/team/jo8-1')
  await expect(page.getByText('Demo-stand.')).toBeVisible()
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  await page.getByRole('link', { name: 'Spelers' }).click()
  await page.getByPlaceholder('Nieuwe speler (voornaam)').fill('Gast')
  await page.getByRole('button', { name: 'Toevoegen' }).click()
  await expect(page.getByText('Gast', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Opstelling' }).click()
  const paneel = page.getByRole('region', { name: 'Wie is er?' })
  await expect(paneel).toContainText('8 van 9 erbij')
  await expect(paneel).toContainText('afwezig: Gast')

  await paneel.getByRole('button', { name: 'Gast', pressed: false }).click()
  await expect(paneel).toContainText('9 van 9 erbij')
  await expect(page.locator('section:has-text("Speeltijd") .chip').filter({ hasText: 'Gast' })).toHaveCount(1)
})
