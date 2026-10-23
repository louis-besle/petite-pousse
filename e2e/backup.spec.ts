import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  addStudent,
  clearDb,
  dismissPrivacy,
  gotoRoute,
  openClass,
  openDossier,
  readDb,
  seedValidation,
} from './helpers'

test.describe('sauvegardes', () => {
  test('exporte, vide puis restaure le dossier avec sa photo', async ({ page }) => {
    await addStudent(page, 'Léa', 'MS')
    await openClass(page)

    const students = await readDb(page, 'students')
    expect(students).toHaveLength(1)
    const studentId = String(students[0]?.id)

    await seedValidation(page, {
      studentId,
      objectiveId: 'lang-vocabulaire-01',
      date: '2026-10-12',
      withPhoto: true,
    })

    await gotoRoute(page, '/settings')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Réglages', exact: true }),
    ).toBeVisible()
    await dismissPrivacy(page)

    const exportButton = page.getByRole('button', {
      name: 'Exporter une sauvegarde',
      exact: true,
    })
    await expect(exportButton).toBeEnabled()

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })
    await exportButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(
      /^carnet-de-reussites-backup-\d{4}-\d{2}-\d{2}\.zip$/,
    )
    const backupPath = await download.path()
    expect(backupPath).not.toBeNull()

    // L'appareil perd tout : les six tables sont vidées, pas la base.
    await clearDb(page)
    expect(await readDb(page, 'students')).toHaveLength(0)
    expect(await readDb(page, 'validations')).toHaveLength(0)
    expect(await readDb(page, 'photos')).toHaveLength(0)

    // Le rechargement complet réamorce les réglages : le panneau redevient actif.
    // (`page.goto` sur la même route à hash ne rechargerait pas le document.)
    await page.reload()
    await expect(page.getByRole('heading', { level: 2, name: 'Sauvegarde' })).toBeVisible()
    await dismissPrivacy(page)

    const importButton = page.getByRole('button', {
      name: 'Importer une sauvegarde',
      exact: true,
    })
    await expect(importButton).toBeEnabled()
    await importButton.click()

    await page
      .locator('input[type="file"]')
      .setInputFiles(backupPath as string)

    const confirm = page.getByRole('dialog', {
      name: 'Restaurer cette sauvegarde ?',
    })
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText('1 élève')
    await expect(confirm).toContainText('1 réussite')
    await expect(confirm).toContainText('1 photo')
    await expect(confirm).toContainText('Toutes les données actuelles seront remplacées.')

    await confirm
      .getByRole('button', { name: 'Restaurer la sauvegarde', exact: true })
      .click()

    await expect(page.getByText('Sauvegarde restaurée.')).toBeVisible()
    await expect(confirm).toBeHidden()

    const restoredStudents = await readDb(page, 'students')
    expect(restoredStudents).toHaveLength(1)
    expect(restoredStudents[0]?.firstName).toBe('Léa')

    const restoredValidations = await readDb(page, 'validations')
    expect(restoredValidations).toHaveLength(1)
    expect(restoredValidations[0]?.date).toBe('2026-10-12')
    expect(restoredValidations[0]?.photoId).toBeTruthy()

    const restoredPhotos = await readDb(page, 'photos')
    expect(restoredPhotos).toHaveLength(1)
    const full = restoredPhotos[0]?.full as { size: number; type: string }
    expect(full.type).toBe('image/jpeg')
    expect(full.size).toBeGreaterThan(0)

    // Le dossier restauré affiche de nouveau la photo.
    await openDossier(page, 'Léa')
    await expect(
      page.getByRole('img', { name: /Photo de la réussite : / }),
    ).toBeVisible()
  })

  test('un ZIP invalide affiche une erreur française et laisse la base intacte', async ({
    page,
  }, testInfo) => {
    await addStudent(page, 'Noah', 'MS')
    await openClass(page)

    const before = await readDb(page, 'students')
    expect(before).toHaveLength(1)

    await gotoRoute(page, '/settings')
    await expect(page.getByRole('heading', { level: 2, name: 'Sauvegarde' })).toBeVisible()
    await dismissPrivacy(page)

    const invalidPath = testInfo.outputPath('invalid.zip')
    writeFileSync(invalidPath, 'not a zip')

    await page.getByRole('button', { name: 'Importer une sauvegarde', exact: true }).click()
    await page.locator('input[type="file"]').setInputFiles(invalidPath)

    // Selon l'endroit où fflate échoue, le message est « pas une sauvegarde » ou
    // « illisible ou endommagé » : les deux sont en français.
    await expect(
      page.getByText(/pas une sauvegarde|illisible ou endommagé/i),
    ).toBeVisible()

    // Aucune feuille de restauration : la base n'a pas bougé.
    await expect(
      page.getByRole('dialog', { name: 'Restaurer cette sauvegarde ?' }),
    ).toHaveCount(0)
    expect(await readDb(page, 'students')).toHaveLength(1)
  })
})
