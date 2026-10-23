import { db, historie, namen, wedstrijd } from './helpers/db'
import { E2E_DATUM } from './helpers/env'
import { expect, openWedstrijd, test } from './fixtures'

/** Opslaan tegen de echte database: wat er staat, en wat de historie-trigger ervan maakt. */

test('opslaan schrijft opstelling, keepers en tegenstander, en één historierij', async ({ page }) => {
  await openWedstrijd(page)
  await page.getByRole('button', { name: /wijzig/ }).first().click()
  await page.getByLabel('Tegenstander (optioneel)').fill('Testclub O8-1 (thuis 09:00)')
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  const m = await wedstrijd(E2E_DATUM)
  expect(m).not.toBeNull()
  expect(await namen(m!.achter)).toEqual(['Anna', 'Bram', 'Cas', 'Dirk'])
  expect(await namen(m!.voor)).toEqual(['Eva', 'Finn', 'Gijs', 'Hanna'])
  expect(await namen(m!.keepers)).toEqual(['Anna', 'Bram', 'Cas', 'Dirk'])
  expect(m!.keepers_vast).toBe(false)
  expect(m!.opponent).toBe('Testclub O8-1 (thuis 09:00)')
  expect((await historie(E2E_DATUM)).map((h) => h.actie)).toEqual(['insert'])

  // Na herladen staat hetzelfde er weer (geen "Wijzigingen opslaan").
  await page.reload()
  await expect(page.getByRole('button', { name: 'Opgeslagen' })).toBeDisabled()
})

test('afwezig zetten komt in afwezig en haalt de speler uit de linies', async ({ page }) => {
  await openWedstrijd(page)
  await page.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Eva', pressed: true }).click()
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  const m = (await wedstrijd(E2E_DATUM))!
  expect(await namen(m.afwezig)).toEqual(['Eva'])
  expect(await namen([...m.achter, ...m.voor])).not.toContain('Eva')
})

test('historie: een opslag zonder echte wijziging levert geen nieuwe rij op', async ({ page }) => {
  await openWedstrijd(page)
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()
  const m = (await wedstrijd(E2E_DATUM))!

  // Alleen updated_at verandert (zoals een stille opslag zonder wijziging).
  await db().from('matches').update({ updated_at: new Date(Date.now() + 1000).toISOString() }).eq('id', m.id)
  expect(await historie(E2E_DATUM)).toHaveLength(1)

  await db().from('matches').update({ opponent: 'Echt gewijzigd' }).eq('id', m.id)
  expect((await historie(E2E_DATUM)).map((h) => h.actie)).toEqual(['insert', 'update'])
})
