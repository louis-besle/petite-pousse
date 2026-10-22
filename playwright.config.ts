import { defineConfig } from '@playwright/test'

/**
 * Configuration E2E du carnet de réussites.
 *
 * Un seul projet Chromium, au format téléphone (390 × 844) : les navigateurs
 * WebKit et Firefox ne sont pas installés sur la machine de développement.
 * `offline.spec.ts` est ignoré tant que son parcours n'est pas écrit.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: /offline\.spec\.ts/,
  outputDir: 'test-results',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
