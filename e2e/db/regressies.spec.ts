import { db, namen, wedstrijd } from './helpers/db'
import { E2E_DATUM, E2E_TEAM } from './helpers/env'
import { expect, openWedstrijd, test } from './fixtures'

/** Bugs die er echt in hebben gezeten, tegen de echte database, zodat ze niet terugkomen. */

test('gastspeler toegevoegd na het opslaan: eerst afwezig, aantikken en hij speelt mee', async ({ page }) => {
  // Oktober 2026: de wedstrijden stonden al vooruit opgeslagen; een nieuwe speler stond dan
  // als "erbij" maar kwam niet in het schema.
  await openWedstrijd(page)
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  await page.getByRole('link', { name: 'Spelers' }).click()
  await page.getByPlaceholder('Nieuwe speler (voornaam)').fill('Gast')
  await page.getByRole('button', { name: 'Toevoegen' }).click()
  await expect(page.getByText('Gast', { exact: true })).toBeVisible()

  // Terug naar dezelfde (2019-)wedstrijd; de link "Opstelling" opent de eerstvolgende zaterdag.
  await openWedstrijd(page)
  const paneel = page.getByRole('region', { name: 'Wie is er?' })
  await expect(paneel).toContainText('8 van 9 erbij')
  await paneel.getByRole('button', { name: 'Gast', pressed: false }).click()
  await expect(paneel).toContainText('9 van 9 erbij')
  await page.getByRole('button', { name: 'Wijzigingen opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  const m = (await wedstrijd(E2E_DATUM))!
  expect(await namen([...m.achter, ...m.voor])).toContain('Gast')
  expect(m.afwezig).toHaveLength(0)
})

test('het sandboxteam is onzichtbaar voor coaches (zonder testvlag)', async ({ browser }) => {
  const context = await browser.newContext() // geen testvlag
  const page = await context.newPage()
  await page.goto('/')
  const teams = page.getByRole('navigation', { name: 'Team kiezen' })
  await expect(teams.getByRole('link', { name: 'JO8-1' })).toBeVisible()
  await expect(teams.getByRole('link', { name: E2E_TEAM.name, exact: true })).toHaveCount(0)
  await context.close()
})

test('vangrail: het sandboxteam staat als is_test in de database', async () => {
  const { data } = await db().from('teams').select('is_test').eq('id', E2E_TEAM.id).single()
  expect(data?.is_test).toBe(true)
})
