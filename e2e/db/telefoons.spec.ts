import { PLEK, markerNamen, sleep } from '../helpers/veld'
import { db, namen, wedstrijd } from './helpers/db'
import { E2E_DATUM, E2E_DATUM_2, E2E_TEAM } from './helpers/env'
import { expect, openWedstrijd, telefoon, test } from './fixtures'

/**
 * Twee telefoons op dezelfde wedstrijd, via Supabase realtime en de optimistic locking op
 * updated_at. Dit is het deel dat de demo-stand niet kan nabootsen.
 */

async function bewaar(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /^(Wedstrijd|Wijzigingen) opslaan$/ }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()
}

test('een sleep op telefoon A staat via realtime op telefoon B, en in de database', async ({ context }) => {
  const a = await telefoon(context)
  await bewaar(a)
  const b = await telefoon(context)
  const voor = await markerNamen(a)

  await sleep(a, PLEK.bank0, PLEK.verdedigerLinks)
  await expect(a.getByText('Gedeeld met de andere telefoons.')).toBeVisible()

  await expect(b.getByText('Bijgewerkt vanaf een andere telefoon.')).toBeVisible()
  const opB = await markerNamen(b)
  expect(opB.veld).toContain(voor.bank[0])
  expect(opB.bank).toContain(voor.veld[1])

  const m = (await wedstrijd(E2E_DATUM))!
  expect(m.live).not.toBeNull()
})

test('nieuwe wedstrijd op twee telefoons: de tweede krijgt een conflict, niet een stille overschrijving', async ({ context }) => {
  const a = await telefoon(context)
  const b = await telefoon(context)
  await a.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Anna', exact: true, pressed: true }).click()
  await b.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Hanna', exact: true, pressed: true }).click()

  await bewaar(b)
  await a.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(a.getByText('Niet opgeslagen: een andere telefoon was eerder.')).toBeVisible()
  expect(await namen((await wedstrijd(E2E_DATUM))!.afwezig)).toEqual(['Hanna'])

  // Bewust overschrijven kan wel.
  await a.getByRole('button', { name: 'Toch mijn versie opslaan' }).click()
  await expect(a.getByText(/^Opgeslagen voor/)).toBeVisible()
  expect(await namen((await wedstrijd(E2E_DATUM))!.afwezig)).toEqual(['Anna'])
})

test('bestaande wedstrijd: een planwijziging gaat niet over een nieuwere versie heen', async ({ context }) => {
  const a = await telefoon(context)
  await bewaar(a)
  await a.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Anna', exact: true, pressed: true }).click()

  const b = await telefoon(context)
  await b.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Hanna', exact: true, pressed: true }).click()
  await bewaar(b)

  await expect(a.getByText('Een andere telefoon heeft deze wedstrijd intussen aangepast.')).toBeVisible()
  await a.getByRole('button', { name: 'Wijzigingen opslaan' }).click()
  await expect(a.getByText('Niet opgeslagen: een andere telefoon was eerder.')).toBeVisible()
  expect(await namen((await wedstrijd(E2E_DATUM))!.afwezig)).toEqual(['Hanna'])
})

test('verwijderd op een andere telefoon: melding, en een sleep zet hem niet stil terug', async ({ context }) => {
  const a = await telefoon(context)
  await bewaar(a)

  // Telefoon B verwijdert via de pagina Wedstrijden (realtime DELETE met alleen het id).
  const b = await context.newPage()
  await openWedstrijd(b, E2E_DATUM, '/wedstrijden')
  b.once('dialog', (d) => void d.accept())
  await b.getByRole('button', { name: 'Verwijder' }).first().click()
  await expect.poll(() => wedstrijd(E2E_DATUM)).toBeNull()

  await expect(a.getByText(/Deze wedstrijd is op een andere telefoon verwijderd/)).toBeVisible()
  await sleep(a, PLEK.bank0, PLEK.verdedigerLinks)
  await a.waitForTimeout(1000)
  expect(await wedstrijd(E2E_DATUM)).toBeNull()

  // Zelf opslaan zet hem er bewust weer in.
  await a.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(a.getByText(/^Opgeslagen voor/)).toBeVisible()
  expect(await wedstrijd(E2E_DATUM)).not.toBeNull()
})

test('een andere wedstrijd verwijderen raakt de open wedstrijd niet', async ({ context }) => {
  const a = await telefoon(context)
  await bewaar(a)

  // Een tweede wedstrijd op een andere datum, aangemaakt en weer weg via de database. De
  // realtime-DELETE bevat dan alleen een (ander) id.
  const { data, error } = await db()
    .from('matches')
    .insert({ team_id: E2E_TEAM.id, match_date: E2E_DATUM_2 })
    .select('id')
    .single()
  expect(error).toBeNull()
  await db().from('matches').delete().eq('id', data!.id)

  await a.waitForTimeout(1500)
  await expect(a.getByText(/op een andere telefoon verwijderd/)).toHaveCount(0)
  await expect(a.getByRole('button', { name: 'Opgeslagen' })).toBeDisabled()
})
