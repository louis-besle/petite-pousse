import { defineConfig } from '@playwright/test'

/**
 * Configuration E2E de Petite pousse.
 *
 * Le projet `chromium` couvre toute la suite sauf le smoke WebKit, au format
 * téléphone (390 × 844). Le projet `webkit` rejoue uniquement `webkit.spec.ts`,
 * le navigateur de Safari sur iPhone et iPad, cible principale de l'application.
 * `a11y.spec.ts` reste réservé à Chromium pour ne pas doubler la durée du
 * contrôle.
 *
 * `offline.spec.ts` est exclu de cette configuration : il exige un build de
 * production et tourne via `playwright.offline.config.ts`
 * (`npm run test:e2e:offline`).
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: [/offline\.spec\.ts/, /webkit\.spec\.ts/],
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
    {
      // Safari iOS/iPadOS : le testIgnore global exclut `webkit.spec.ts` du
      // projet Chromium, ce projet le réintègre seul.
      name: 'webkit',
      testMatch: /webkit\.spec\.ts/,
      testIgnore: [],
      use: {
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
