import { expect, test, type Page } from '@playwright/test'

/** Keepers achteraf corrigeren en het samenvoegen tussen twee telefoons, in de demo-stand. */

const vandaag = () => new Date().toISOString().slice(0, 10)

/** Opent de wedstrijdkop, zet de datum op vandaag en slaat op: dan telt de wedstrijd mee. */
async function slaWedstrijdVanVandaagOp(page: Page) {
  await page.goto('/team/jo8-1')
  await expect(page.getByText('Demo-stand.')).toBeVisible()
  await page.getByRole('button', { name: /wijzig/ }).first().click()
  await page.getByLabel('Wedstrijddatum').fill(vandaag())
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()
}

test('keepers corrigeren op de pagina Wedstrijden', async ({ page }) => {
  await slaWedstrijdVanVandaagOp(page)
  await page.goto('/team/jo8-1/wedstrijden')

  const rij = page.getByRole('row').filter({ hasText: 'Corrigeer' })
  await expect(rij).toHaveCount(1)
  await rij.getByRole('button', { name: 'Corrigeer' }).click()
  for (const [q, naam] of ['Julan', 'Adam', 'Guus', 'Christopher'].entries()) {
    await page.getByLabel(`Kwart ${q + 1}`).selectOption({ label: naam })
  }
  await page.getByRole('button', { name: 'Keepers opslaan' }).click()

  await expect(rij).toContainText('Julan · Adam · Guus · Christopher')
  await expect(rij).toContainText('gecorrigeerd')
  /** De teller naast een naam in het blok Keeperbeurten. */
  const teller = (naam: string) => page.getByText(naam, { exact: true }).locator('..').locator('b')
  await expect(teller('Julan')).toContainText('1×')
  await expect(teller('Floris')).toContainText('0×')

  // Blijft staan na opnieuw laden, en is weer los te laten.
  await page.reload()
  await expect(rij).toContainText('gecorrigeerd')
  await rij.getByRole('button', { name: 'Terug naar geteld' }).click()
  await expect(rij).not.toContainText('gecorrigeerd')
  await expect(teller('Julan')).toContainText('0×')
})

test('twee telefoons: de eerste opslag wint, overschrijven alleen bewust', async ({ context }) => {
  const a = await context.newPage()
  await slaWedstrijdVanVandaagOp(a)

  // Telefoon A wijzigt het plan, maar slaat nog niet op.
  const paneelA = a.getByRole('region', { name: 'Wie is er?' })
  await paneelA.getByRole('button', { name: 'Adam', pressed: true }).click()
  await expect(a.getByRole('button', { name: 'Wijzigingen opslaan' })).toBeEnabled()

  // Telefoon B slaat intussen iets anders op.
  const b = await context.newPage()
  await b.goto(`/team/jo8-1?datum=${vandaag()}`)
  await expect(b.getByText('Demo-stand.')).toBeVisible()
  await b.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Sara', pressed: true }).click()
  await b.getByRole('button', { name: 'Wijzigingen opslaan' }).click()
  await expect(b.getByText(/^Opgeslagen voor/)).toBeVisible()

  // A ziet de melding; opslaan gaat er niet stilletjes overheen.
  await expect(a.getByText('Een andere telefoon heeft deze wedstrijd intussen aangepast.')).toBeVisible()
  await a.getByRole('button', { name: 'Wijzigingen opslaan' }).click()
  await expect(a.getByText('Niet opgeslagen: een andere telefoon was eerder.')).toBeVisible()
  await expect(a.getByText('Een andere telefoon heeft deze wedstrijd intussen aangepast.')).toBeVisible()

  // Bewust overschrijven kan wel.
  await a.getByRole('button', { name: 'Toch mijn versie opslaan' }).click()
  await expect(a.getByText(/^Opgeslagen voor/)).toBeVisible()
  await b.reload()
  await expect(b.getByRole('region', { name: 'Wie is er?' })).toContainText('afwezig: Adam')
})

test('twee telefoons met een nieuwe wedstrijd: ook dan gaat de tweede er niet stilletjes overheen', async ({ context }) => {
  const a = await context.newPage()
  await a.goto(`/team/jo8-1?datum=${vandaag()}`)
  await expect(a.getByText('Demo-stand.')).toBeVisible()
  await a.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Adam', pressed: true }).click()

  const b = await context.newPage()
  await b.goto(`/team/jo8-1?datum=${vandaag()}`)
  await expect(b.getByText('Demo-stand.')).toBeVisible()
  await b.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Sara', pressed: true }).click()
  await b.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(b.getByText(/^Opgeslagen voor/)).toBeVisible()

  await a.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(a.getByText('Niet opgeslagen: een andere telefoon was eerder.')).toBeVisible()
  await b.reload()
  await expect(b.getByRole('region', { name: 'Wie is er?' })).toContainText('afwezig: Sara')
})
