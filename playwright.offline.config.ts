import { defineConfig } from '@playwright/test'

/**
 * Configuration E2E du mode hors ligne.
 *
 * Le service worker n'existe que dans un build de production : ce parcours
 * lance `vite build` puis `vite preview` sur un port dédié, séparé du serveur
 * de dev utilisé par la suite principale.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /offline\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
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
    // `--strictPort` : un 4174 déjà pris doit échouer franchement au lieu de
    // servir silencieusement le port suivant.
    command: 'npm run build && npm run preview -- --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 240_000,
  },
})
