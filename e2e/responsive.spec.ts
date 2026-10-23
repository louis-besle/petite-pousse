import { expect, test, type Locator, type Page } from '@playwright/test'
import { addStudent, openClass } from './helpers'

/** Nombre de pistes réellement posées par la grille, lu sur le rendu. */
async function columnCount(grid: Locator): Promise<number> {
  const template = await grid.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )

  return template.trim().split(/\s+/).filter(Boolean).length
}

async function assertNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))

  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth)
}

test.describe('responsive de la grille de classe', () => {
  test('deux colonnes sur téléphone, quatre sur iPad, sans débordement', async ({
    page,
  }) => {
    await addStudent(page, 'Léa', 'MS')
    await addStudent(page, 'Noah', 'PS')
    await addStudent(page, 'Zoé', 'GS')
    await addStudent(page, 'Tom', 'MS')
    await openClass(page)

    // La grille est le `ul` qui porte les liens vers les dossiers, jamais une
    // classe CSS hachée par le bundler.
    const grid = page
      .locator('ul')
      .filter({ has: page.locator('a[href*="/students/"]') })
    await expect(grid.getByRole('listitem')).toHaveCount(4)

    // Téléphone (390 × 844, viewport de la configuration).
    await expect.poll(() => columnCount(grid)).toBe(2)
    await assertNoHorizontalOverflow(page)

    // iPad portrait : la feuille de style passe à quatre colonnes dès 1000 px.
    await page.setViewportSize({ width: 1024, height: 1366 })
    await expect.poll(() => columnCount(grid)).toBe(4)
    await assertNoHorizontalOverflow(page)
  })
})
