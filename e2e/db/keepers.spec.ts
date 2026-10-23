import { db, namen, wedstrijd } from './helpers/db'
import { E2E_DATUM, E2E_SPELERS, E2E_TEAM } from './helpers/env'
import { expect, openWedstrijd, test } from './fixtures'

/** Keepers achteraf corrigeren op de pagina Wedstrijden, gecontroleerd in de database. */

const id = (naam: string) => E2E_SPELERS.find((p) => p.name === naam)!.id

test('corrigeren zet keepers_vast; terug naar geteld leidt ze weer af', async ({ page }) => {
  await db()
    .from('matches')
    .insert({
      team_id: E2E_TEAM.id,
      match_date: E2E_DATUM,
      achter: ['Anna', 'Bram', 'Cas', 'Dirk'].map(id),
      voor: ['Eva', 'Finn', 'Gijs', 'Hanna'].map(id),
      keepers: ['Anna', 'Bram', 'Cas', 'Dirk'].map(id),
    })
  await openWedstrijd(page, E2E_DATUM, '/wedstrijden')

  const rij = page.getByRole('row').filter({ hasText: 'Corrigeer' })
  await rij.getByRole('button', { name: 'Corrigeer' }).click()
  for (const [q, naam] of ['Eva', 'Bram', 'Cas', 'Dirk'].entries()) {
    await page.getByLabel(`Kwart ${q + 1}`).selectOption({ label: naam })
  }
  await page.getByRole('button', { name: 'Keepers opslaan' }).click()
  await expect(rij).toContainText('gecorrigeerd')

  let m = (await wedstrijd(E2E_DATUM))!
  expect(m.keepers_vast).toBe(true)
  expect(await namen(m.keepers)).toEqual(['Eva', 'Bram', 'Cas', 'Dirk'])

  await rij.getByRole('button', { name: 'Terug naar geteld' }).click()
  await expect(rij).not.toContainText('gecorrigeerd')
  m = (await wedstrijd(E2E_DATUM))!
  expect(m.keepers_vast).toBe(false)
  expect(await namen(m.keepers)).toEqual(['Anna', 'Bram', 'Cas', 'Dirk'])
})

test('keeperswissel halverwege een kwart: het corrigeerscherm schuift de latere kwarten niet op', async ({ page }) => {
  // Kwart 2 had twee keepers (Bram, daarna Dirk); daarna keept Bram nog kwart 4.
  await db()
    .from('matches')
    .insert({
      team_id: E2E_TEAM.id,
      match_date: E2E_DATUM,
      achter: ['Anna', 'Bram', 'Cas', 'Dirk'].map(id),
      voor: ['Eva', 'Finn', 'Gijs', 'Hanna'].map(id),
      keepers: ['Anna', 'Bram', 'Dirk', 'Cas', 'Bram'].map(id),
    })
  await openWedstrijd(page, E2E_DATUM, '/wedstrijden')
  await page.getByRole('row').filter({ hasText: 'Corrigeer' }).getByRole('button', { name: 'Corrigeer' }).click()

  // Zonder live-stand komt het plan terug: per kwart wie het begon, niet keepers[q].
  const gekozen = await Promise.all([1, 2, 3, 4].map((q) => page.getByLabel(`Kwart ${q}`).evaluate((s: HTMLSelectElement) => s.selectedOptions[0]?.text)))
  expect(gekozen).toEqual(['Anna', 'Bram', 'Cas', 'Dirk'])
})
