import { expect, test } from '@playwright/test'
import { addStudent } from './helpers'

test.describe('programme', () => {
  test('filtrer par niveau puis rechercher un objectif met la liste à jour', async ({
    page,
  }) => {
    await addStudent(page, 'Lina', 'PS')

    await page.getByRole('link', { name: 'Programme', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Programme' })).toBeVisible()

    const levelGroup = page.getByRole('group', { name: 'Filtrer par niveau' })
    await page.getByLabel('Rechercher un objectif', { exact: true }).fill('syllabes')

    const scander = page.getByRole('button', {
      name: /^Ouvrir l.objectif : Scander les syllabes/,
    })
    const manipuler = page.getByRole('button', {
      name: /^Ouvrir l.objectif : Manipuler les syllabes/,
    })

    await expect(scander).toBeVisible()
    await expect(manipuler).toBeVisible()

    // PS ne garde que les objectifs de la tranche « avant 4 ans ».
    await levelGroup.getByRole('button', { name: 'PS', exact: true }).click()

    await expect(manipuler).toHaveCount(0)
    await expect(scander).toBeVisible()
  })

  test('valider plusieurs élèves d’affilée met à jour le compteur et désactive les élèves déjà validés', async ({
    page,
  }) => {
    await addStudent(page, 'Noah', 'MS')
    await addStudent(page, 'Mila', 'MS')

    await page.getByRole('link', { name: 'Programme', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Programme' })).toBeVisible()

    await page.getByLabel('Rechercher un objectif', { exact: true }).fill('lettres capitales')

    const objectiveRow = page.getByRole('button', {
      name: /^Ouvrir l.objectif : Tracer des lettres capitales/,
    })
    await expect(objectiveRow).toBeVisible()
    await objectiveRow.click()

    const sheet = page.getByRole('dialog', { name: 'Tracer des lettres capitales.' })
    await expect(sheet).toBeVisible()
    await expect(
      sheet.getByText(/Aucun élève n.a encore validé cet objectif/),
    ).toBeVisible()

    const rowItem = page.getByRole('listitem').filter({ has: objectiveRow })
    const progress = rowItem.getByRole('progressbar')

    await sheet.getByRole('button', { name: 'Noah, section MS', exact: true }).click()

    await expect(page.getByText('Réussite ajoutée à Noah.')).toBeVisible()
    // La fiche reste ouverte : on enchaîne sur Mila.
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Déjà validé par 1 élève')).toBeVisible()
    await expect(
      sheet.getByRole('button', { name: 'Noah, section MS, déjà validé', exact: true }),
    ).toBeDisabled()
    await expect(rowItem.getByText('1 élève', { exact: true })).toBeVisible()
    await expect(progress).toHaveAttribute('aria-valuenow', '1')
    await expect(progress).toHaveAttribute('aria-valuemax', '2')

    await sheet.getByRole('button', { name: 'Mila, section MS', exact: true }).click()

    await expect(page.getByText('Réussite ajoutée à Mila.')).toBeVisible()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Déjà validé par 2 élèves')).toBeVisible()

    await expect(rowItem.getByText('2 élèves', { exact: true })).toBeVisible()
    await expect(progress).toHaveAttribute('aria-valuenow', '2')

    await sheet.getByRole('button', { name: 'Terminer' }).click()
    await expect(sheet).toBeHidden()
  })
})
