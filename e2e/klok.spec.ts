import { expect, test } from '@playwright/test'

/**
 * De wedstrijdklok laat het kwart-geluid (public/kwart.mp3) meelopen, zodat het piepje ook
 * klinkt met het scherm op slot. Start speelt af vanaf de klokstand, Pauze en Reset stoppen.
 */
test('Start speelt het kwart-geluid af, Pauze en Reset stoppen het', async ({ page }) => {
  await page.goto('/team/jo8-1')
  const geluid = page.getByTestId('kwart-geluid')
  await expect(geluid).toHaveJSProperty('paused', true)

  await page.getByRole('button', { name: 'Start' }).click()
  await expect(geluid).toHaveJSProperty('paused', false)
  await expect.poll(() => geluid.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0.2)
  await expect(page.getByText(/scherm op slot/)).toBeVisible()

  await page.getByRole('button', { name: 'Pauze' }).click()
  await expect(geluid).toHaveJSProperty('paused', true)
  const stand = await geluid.evaluate((el: HTMLAudioElement) => el.currentTime)

  // Verder gaan hervat op de klokstand, niet vanaf nul.
  await page.getByRole('button', { name: 'Verder' }).click()
  await expect(geluid).toHaveJSProperty('paused', false)
  expect(await geluid.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThanOrEqual(stand - 0.1)

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(geluid).toHaveJSProperty('paused', true)
  await expect(page.getByText('00:00')).toBeVisible()
})

test('het kwart-geluid duurt precies tien minuten', async ({ page }) => {
  await page.goto('/team/jo8-1')
  const geluid = page.getByTestId('kwart-geluid')
  await expect.poll(() => geluid.evaluate((el: HTMLAudioElement) => el.duration)).toBeGreaterThan(599)
  expect(await geluid.evaluate((el: HTMLAudioElement) => el.duration)).toBeLessThan(601)
})
