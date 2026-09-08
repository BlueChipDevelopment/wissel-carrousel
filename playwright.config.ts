import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests in de demo-stand (localStorage, seed-teams), dus zonder Supabase.
 * De webServer start Vite met lege Supabase-variabelen; die winnen van .env.local.
 * `npm run test:e2e` — headless; `npm run test:e2e -- --ui` voor de UI-modus.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5197',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 900 } } },
    { name: 'telefoon', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npx vite --port 5197 --strictPort',
    url: 'http://localhost:5197',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
