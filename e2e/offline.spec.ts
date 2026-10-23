import { expect, test } from '@playwright/test'

/**
 * Vérifie le précache du service worker : une fois l'application chargée en
 * ligne et le worker actif, un rechargement sans réseau doit encore afficher la
 * classe. Ce fichier tourne avec `playwright.offline.config.ts`, contre un build
 * de production servi par `vite preview` (le serveur de dev n'a pas de worker).
 */
test.describe('hors ligne', () => {
  test.afterEach(async ({ context }) => {
    await context.setOffline(false)
  })

  test('l’application se recharge sans réseau après l’activation du service worker', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
    ).toBeVisible()

    // Le bundle de production n'expose jamais la base aux scripts de la page :
    // `window.__carnetDb` est réservé au serveur de développement.
    expect(await page.evaluate(() => '__carnetDb' in window)).toBe(false)

    // `ready` ne se résout qu'une fois le worker actif, précache terminé.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))

    // Un rechargement en ligne suffit à ce que le worker contrôle la page.
    await page.reload()
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 60_000 },
    )

    await context.setOffline(true)
    await page.reload()

    await expect(
      page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Prendre une photo/ }),
    ).toBeVisible()
    await expect(page.getByText('Aucun élève dans la classe')).toBeVisible()
  })
})
