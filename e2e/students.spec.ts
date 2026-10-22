import { expect, test } from '@playwright/test'
import { addStudent, captureWithPhoto, gotoRoute, openDossier } from './helpers'

test.describe('gestion des élèves', () => {
  test('ajout, modification puis suppression en cascade avec la réussite et sa photo', async ({
    page,
  }) => {
    await addStudent(page, 'Zoé', 'MS')
    await captureWithPhoto(page, 'Zoé', 'Chanter en exprimant')

    // Modification du prénom et de la section depuis la liste.
    await gotoRoute(page, '/students')
    const row = page.getByRole('button', { name: 'Modifier Zoé', exact: true })
    await expect(row).toBeVisible()
    await expect(row).toContainText('1 réussite')
    await row.click()

    const editDialog = page.getByRole('dialog', { name: 'Modifier Zoé' })
    await expect(editDialog).toBeVisible()
    await editDialog.getByLabel('Prénom', { exact: true }).fill('Zoéa')
    await editDialog
      .getByRole('group', { name: 'Section', exact: true })
      .getByRole('button', { name: 'GS', exact: true })
      .click()
    await editDialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()

    await expect(page.getByText('Modifications enregistrées.')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Modifier Zoéa', exact: true }),
    ).toContainText('1 réussite')

    await gotoRoute(page, '/')
    await expect(
      page.getByRole('link', {
        name: 'Zoéa, section GS, 1 réussite',
        exact: true,
      }),
    ).toBeVisible()

    // Suppression : la confirmation annonce la réussite et la photo.
    await gotoRoute(page, '/students')
    await page.getByRole('button', { name: 'Supprimer Zoéa', exact: true }).click()

    const confirm = page.getByRole('dialog', { name: 'Supprimer Zoéa ?' })
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText('1 réussite et 1 photo')
    await confirm.getByRole('button', { name: 'Supprimer définitivement' }).click()

    await expect(page.getByText('Élève supprimé.')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Modifier Zoéa', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByText('0 élève', { exact: true })).toBeVisible()

    // Aucun fantôme : la classe est vide et la réussite a disparu avec l'élève.
    await gotoRoute(page, '/')
    await expect(page.getByText('Aucun élève dans la classe')).toBeVisible()
    await expect(page.getByRole('link', { name: /Zoéa/ })).toHaveCount(0)
  })

  test('annuler la suppression conserve l’élève et sa réussite', async ({ page }) => {
    await addStudent(page, 'Lina', 'MS')
    await captureWithPhoto(page, 'Lina', 'Chanter en exprimant')

    await gotoRoute(page, '/students')
    await page.getByRole('button', { name: 'Supprimer Lina', exact: true }).click()

    const confirm = page.getByRole('dialog', { name: 'Supprimer Lina ?' })
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText('1 réussite et 1 photo')
    await confirm.getByRole('button', { name: 'Annuler', exact: true }).click()

    await expect(confirm).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Modifier Lina', exact: true }),
    ).toContainText('1 réussite')
    await expect(page.getByText('1 élève', { exact: true })).toBeVisible()

    await openDossier(page, 'Lina')
    await expect(
      page.getByRole('button', { name: /Chanter en exprimant/ }),
    ).toHaveCount(1)
    await expect(
      page.getByRole('img', { name: /Photo de la réussite : Chanter en exprimant/ }),
    ).toBeVisible()
  })
})
