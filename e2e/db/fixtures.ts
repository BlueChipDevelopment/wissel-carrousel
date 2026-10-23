import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { resetSandbox } from './helpers/db'
import { E2E_DATUM, E2E_TEAM } from './helpers/env'

/**
 * Elke test begint met een leeg sandboxteam (geen wedstrijden, alleen de vaste spelers), en
 * elke pagina zet de testvlag zodat het sandboxteam in de app zichtbaar is.
 */
export const test = base.extend<{ sandbox: void }>({
  sandbox: [
    async ({}, use) => {
      await resetSandbox()
      await use()
    },
    { auto: true },
  ],
  context: async ({ context }, use) => {
    await zetTestvlag(context)
    await use(context)
  },
})

export async function zetTestvlag(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => localStorage.setItem('wisselcarrousel.testteams', '1'))
}

/** Opent de wedstrijd van het sandboxteam op een datum en wacht tot het veldje staat. */
export async function openWedstrijd(page: Page, datum = E2E_DATUM, pad = ''): Promise<void> {
  await page.goto(`/team/${E2E_TEAM.slug}${pad}?datum=${datum}`)
  await expect(page.getByRole('heading', { name: /Wisselcarrousel E2E/i })).toBeVisible()
  await expect(page.getByText('Demo-stand.')).toHaveCount(0)
  if (!pad) {
    await expect(page.getByRole('img', { name: /Opstelling op het veld/ })).toBeVisible()
    // Webfonts verschuiven de layout nog even na de eerste render; anders slaat een sleep mis.
    await page.evaluate(() => document.fonts.ready)
  }
}

/** Nieuwe "telefoon": eigen tabblad in dezelfde context (testvlag staat er al op). */
export async function telefoon(context: BrowserContext, datum = E2E_DATUM): Promise<Page> {
  const page = await context.newPage()
  await openWedstrijd(page, datum)
  return page
}

export { expect }
export type { Page }
