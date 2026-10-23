import { db, wedstrijd } from './helpers/db'
import { E2E_DATUM } from './helpers/env'
import { expect, openWedstrijd, test } from './fixtures'

/** Uitslagen tegen de echte database: goals_voor/goals_tegen, los van het opslaan van de opstelling. */

test('uitslag invullen schrijft goals_voor/goals_tegen; opstelling opslaan laat ze staan', async ({ page }) => {
  await openWedstrijd(page)
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  await openWedstrijd(page, E2E_DATUM, '/wedstrijden')
  await page.getByRole('button', { name: 'Invullen' }).click()
  await page.getByLabel('Uitslag, wij eerst').fill('5-2')
  await page.getByRole('button', { name: 'Bewaar' }).click()
  await expect(page.getByRole('row').filter({ hasText: '5–2' })).toBeVisible()

  let m = (await wedstrijd(E2E_DATUM))!
  expect([m.goals_voor, m.goals_tegen]).toEqual([5, 2])

  // De opstelling opnieuw opslaan (update zonder goals-kolommen) raakt de uitslag niet.
  await openWedstrijd(page)
  await page.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Eva', exact: true, pressed: true }).click()
  await page.getByRole('button', { name: 'Wijzigingen opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()
  m = (await wedstrijd(E2E_DATUM))!
  expect([m.goals_voor, m.goals_tegen]).toEqual([5, 2])

  // In het overzicht (met testvlag staat het sandboxteam erbij).
  await openWedstrijd(page, E2E_DATUM, '/uitslagen')
  await expect(page.getByRole('region', { name: 'Uitslagen E2E' })).toContainText('5–2')
})

test('de database weigert een halve uitslag', async () => {
  await db().from('matches').insert({ team_id: '00000000-0000-4000-8000-0000000000e2', match_date: E2E_DATUM })
  const { error } = await db().from('matches').update({ goals_voor: 3 }).eq('match_date', E2E_DATUM).eq('team_id', '00000000-0000-4000-8000-0000000000e2')
  expect(error?.message).toMatch(/matches_uitslag_compleet/)
})
