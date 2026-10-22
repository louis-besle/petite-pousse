import { expect, test } from '@playwright/test'
import {
  PHOTO_FIXTURE,
  addStudent,
  captureWithPhoto,
  gotoRoute,
  openDossier,
} from './helpers'

test.describe('capture', () => {
  test('parcours photo complet, du choix de l’élève au dossier', async ({ page }) => {
    await addStudent(page, 'Léa', 'MS')

    await captureWithPhoto(page, 'Léa', 'lettres capitales')

    await expect(
      page.getByRole('heading', { level: 1, name: /C.est noté/ }),
    ).toBeVisible()
    await expect(page.getByText('Tracer des lettres capitales.', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Voir le dossier de Léa' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Léa' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Tracer des lettres capitales/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('img', {
        name: /Photo de la réussite : Tracer des lettres capitales/,
      }),
    ).toBeVisible()
    await expect(page.getByText('Observation en classe')).toHaveCount(0)

    await page.getByRole('button', { name: 'Retour', exact: true }).click()

    await expect(
      page.getByRole('link', {
        name: 'Léa, section MS, 1 réussite',
        exact: true,
      }),
    ).toBeVisible()
  })

  test('le brouillon et la photo survivent à un rechargement', async ({ page }) => {
    await addStudent(page, 'Noah', 'MS')

    await gotoRoute(page, '/')
    await page.getByRole('button', { name: /Prendre une photo/ }).click()
    await page.getByRole('button', { name: 'Noah, section MS', exact: true }).click()

    const recap = page.getByRole('group', { name: /^Élève Noah, section MS$/ })
    await expect(recap).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE)
    await expect(
      page.getByRole('img', { name: 'Photo de réussite de Noah' }),
    ).toHaveAttribute('src', /^blob:/)
    await expect(page.getByRole('button', { name: /Choisir l.objectif/ })).toBeVisible()

    await page.reload()

    await expect(
      page.getByRole('group', { name: /^Élève Noah, section MS$/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('img', { name: 'Photo de réussite de Noah' }),
    ).toHaveAttribute('src', /^blob:/)
    await expect(page.getByRole('button', { name: /Choisir l.objectif/ })).toBeVisible()
    await expect(page.getByText('Photo prise', { exact: true })).toBeVisible()
  })

  test('validation sans photo : mention « Observation en classe »', async ({ page }) => {
    await addStudent(page, 'Mila', 'MS')

    await gotoRoute(page, '/')
    await page.getByRole('button', { name: /Prendre une photo/ }).click()
    await page.getByRole('button', { name: 'Mila, section MS', exact: true }).click()
    await expect(
      page.getByRole('group', { name: /^Élève Mila, section MS$/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Valider sans photo', exact: true }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: /Choisir l.objectif/ }),
    ).toBeVisible()
    await expect(page.getByText('Validation sans photo', { exact: true })).toBeVisible()

    await page.getByLabel('Rechercher un objectif', { exact: true }).fill('Comparer des quantités')
    await page
      .getByRole('listitem')
      .getByRole('button', { name: /Comparer des quantités/ })
      .click()
    await page.getByRole('button', { name: /Valider la réussite/ }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: /C.est noté/ }),
    ).toBeVisible()
    await expect(page.getByText(/sans photo/)).toBeVisible()

    await page.getByRole('button', { name: 'Voir le dossier de Mila' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mila' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Comparer des quantités/ }),
    ).toBeVisible()
    await expect(page.getByText('Observation en classe', { exact: true })).toBeVisible()
    await expect(page.getByText('sans photo', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('img', { name: /Photo de la réussite/ }),
    ).toHaveCount(0)
  })

  test('un objectif déjà validé est désactivé et ne crée pas de doublon', async ({ page }) => {
    await addStudent(page, 'Tom', 'MS')

    await captureWithPhoto(page, 'Tom', 'Scander les syllabes')

    await page.getByRole('button', { name: 'Retour à la classe' }).click()
    await expect(
      page.getByRole('link', {
        name: 'Tom, section MS, 1 réussite',
        exact: true,
      }),
    ).toBeVisible()

    // Deuxième capture, sans photo : le même objectif doit être indisponible.
    await page.getByRole('button', { name: /Prendre une photo/ }).click()
    await page.getByRole('button', { name: 'Tom, section MS', exact: true }).click()
    await expect(
      page.getByRole('group', { name: /^Élève Tom, section MS$/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Valider sans photo', exact: true }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: /Choisir l.objectif/ }),
    ).toBeVisible()
    await page.getByLabel('Rechercher un objectif', { exact: true }).fill('Scander les syllabes')

    const done = page
      .getByRole('listitem')
      .getByRole('button', { name: /Scander les syllabes/ })
    await expect(done).toBeDisabled()
    await expect(done).toContainText('Déjà validé')

    await openDossier(page, 'Tom')
    await expect(page.getByText('1 réussite', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Scander les syllabes/ }),
    ).toHaveCount(1)
  })
})
