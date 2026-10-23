import { expect, test } from '@playwright/test'

/** Uitslag invullen op de pagina Wedstrijden en terugzien in het overzicht van alle JO8-teams. */

const vandaag = () => new Date().toISOString().slice(0, 10)

test('uitslag invullen, wijzigen en terugzien bij Uitslagen', async ({ page }) => {
  await page.goto(`/team/jo8-1?datum=${vandaag()}`)
  await expect(page.getByText('Demo-stand.')).toBeVisible()
  await page.getByRole('button', { name: 'Wedstrijd opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  await page.getByRole('link', { name: 'Wedstrijden & keeperbeurten' }).click()
  await page.getByRole('button', { name: 'Invullen' }).click()
  const veld = page.getByLabel('Uitslag, wij eerst')

  // Onzin wordt niet opgeslagen.
  await veld.fill('7')
  await page.getByRole('button', { name: 'Bewaar' }).click()
  await expect(page.getByText('Typ de stand als 7-3, wij eerst.')).toBeVisible()

  await veld.fill('7-3')
  await page.getByRole('button', { name: 'Bewaar' }).click()
  const rij = page.getByRole('row').filter({ hasText: '7–3' })
  await expect(rij.getByLabel('gewonnen')).toBeVisible()

  // Opnieuw de opstelling opslaan laat de uitslag staan.
  await page.getByRole('link', { name: 'Opstelling' }).click()
  await page.getByRole('region', { name: 'Wie is er?' }).getByRole('button', { name: 'Adam', pressed: true }).click()
  await page.getByRole('button', { name: 'Wijzigingen opslaan' }).click()
  await expect(page.getByText(/^Opgeslagen voor/)).toBeVisible()

  await page.getByRole('link', { name: 'Uitslagen' }).click()
  const alle = page.getByRole('region', { name: 'Alle JO8-teams' })
  await expect(alle).toContainText('1gespeeld')
  await expect(alle).toContainText('1gewonnen')
  await expect(alle).toContainText('+4doelsaldo')
  await expect(page.getByRole('row').filter({ hasText: 'JO8-1' })).toContainText('+4')
  await expect(page.getByRole('region', { name: 'Uitslagen JO8-1' })).toContainText('7–3')
  await expect(page.getByRole('region', { name: 'Uitslagen JO8-2' })).toContainText('Nog geen uitslagen.')
})
