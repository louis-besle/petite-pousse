import { defineConfig } from '@playwright/test'

/**
 * Configuration E2E du carnet de réussites.
 *
 * Un seul projet Chromium, au format téléphone (390 × 844) : les navigateurs
 * WebKit et Firefox ne sont pas installés sur la machine de développement.
 * `offline.spec.ts` est exclu de cette configuration : il exige un build de
 * production et tourne via `playwright.offline.config.ts`
 * (`npm run test:e2e:offline`).
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
  // En CI, le rapport HTML alimente l'artefact d'échec ; en local, la liste
  // reste seule pour ne pas écrire de dossier de rapport à chaque exécution.
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
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
