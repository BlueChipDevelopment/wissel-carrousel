import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests tegen de echte Supabase (uit .env.local), in het sandboxteam "E2E"
 * (is_test = true). Vangt wat de demo-stand niet kan: realtime tussen telefoons, de
 * optimistic locking van Postgres, RLS, triggers. Controles lezen de database zelf.
 * `npm run test:e2e:db` — zie docs/testing.md.
 */
export default defineConfig({
  testDir: './e2e/db',
  globalSetup: './e2e/db/global-setup.ts',
  globalTeardown: './e2e/db/global-teardown.ts',
  // Eén gedeeld sandboxteam en één database: niet parallel.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5198',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'telefoon', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } }],
  webServer: {
    // Zonder lege env-variabelen: Vite leest .env.local en praat dus met Supabase.
    command: 'npx vite --port 5198 --strictPort',
    url: 'http://localhost:5198',
    reuseExistingServer: !process.env.CI,
  },
})
