import { expect, test } from '@playwright/test'
import {
  addStudent,
  dismissPrivacy,
  gotoRoute,
  openClass,
  readDb,
  seedValidation,
  setCurrentSchoolYear,
} from './helpers'

test.describe('passage à l’année suivante', () => {
  test(
    'ouvre la nouvelle année sans perdre l’ancien dossier ni ses réussites',
    async ({ page }) => {
      // Horloge figée au 10 septembre 2027 : la réussite capturée en fin de
      // test doit tomber dans 2027-2028, pas dans l'année réelle de la machine.
      await page.clock.setFixedTime(new Date('2027-09-10T10:00:00'))

      await addStudent(page, 'Léa', 'MS')
      await openClass(page)

      const students = await readDb(page, 'students')
      expect(students).toHaveLength(1)
      const studentId = String(students[0]?.id)

      // Réussite de l'année précédente, au 31 janvier 2027.
      await seedValidation(page, {
        studentId,
        objectiveId: 'lang-vocabulaire-01',
        date: '2027-01-31',
      })

      // Base d'une enseignante qui n'a pas encore basculé : l'année en cours
      // est restée 2026-2027 malgré la rentrée. `ensureSeed` ne l'a jamais
      // avancée automatiquement.
      await setCurrentSchoolYear(page, '2026-2027')

      await gotoRoute(page, '/settings')
      await expect(
        page.getByRole('heading', { level: 1, name: 'Réglages', exact: true }),
      ).toBeVisible()
      await dismissPrivacy(page)

      const yearCard = page.getByRole('region', { name: 'Année scolaire' })
      await expect(yearCard.getByText('2026-2027', { exact: true })).toBeVisible()

      await page
        .getByRole('button', { name: 'Passer à l’année suivante', exact: true })
        .click()

      const confirm = page.getByRole('dialog', {
        name: 'Passer à l’année suivante ?',
      })
      await expect(confirm).toBeVisible()
      await expect(confirm).toContainText('Aucune réussite ne sera supprimée.')
      await expect(confirm).toContainText('2027-2028')

      await confirm.getByRole('button', { name: 'Ouvrir 2027-2028', exact: true }).click()

      await expect(page.getByText('Année 2027-2028 ouverte.')).toBeVisible()
      await expect(confirm).toBeHidden()
      await expect(yearCard.getByText('2027-2028', { exact: true })).toBeVisible()

      // L'ancien dossier est intact : la réussite de 2026-2027 est toujours là.
      await gotoRoute(page, `/students/${studentId}`)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Léa', exact: true }),
      ).toBeVisible()

      const yearSelect = page.getByRole('combobox', { name: 'Année scolaire' })
      await yearSelect.selectOption('2026-2027')
      await expect(
        page.getByText('MS · 1 réussite en 2026-2027', { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /Comprendre, mémoriser/ }),
      ).toBeVisible()

      // L'ancien bilan est toujours calculé pour 2026-2027.
      await gotoRoute(page, '/bilans')
      await expect(
        page.getByRole('heading', { level: 1, name: 'Bilans', exact: true }),
      ).toBeVisible()

      const bilanYearSelect = page.getByRole('combobox', { name: 'Année scolaire' })
      await expect(
        bilanYearSelect.locator('option[value="2026-2027"]'),
      ).toHaveCount(1)
      await bilanYearSelect.selectOption('2026-2027')
      await expect(
        page.getByRole('button', { name: /^Bilan 1/ }),
      ).toContainText('1 réussite')

      // Nouvelle réussite capturée le 10 septembre 2027 : elle va dans la
      // nouvelle année, sans toucher aux lignes existantes.
      await openClass(page)
      await page.getByRole('button', { name: /Prendre une photo/ }).click()
      await page.getByRole('button', { name: 'Léa, section MS', exact: true }).click()
      await expect(
        page.getByRole('group', { name: /^Élève Léa, section MS$/ }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Valider sans photo', exact: true }).click()

      await expect(
        page.getByRole('heading', { level: 1, name: /Choisir l.objectif/ }),
      ).toBeVisible()
      await page
        .getByLabel('Rechercher un objectif', { exact: true })
        .fill('Comparer des quantités')
      const card = page
        .getByRole('listitem')
        .getByRole('button', { name: /Comparer des quantités/ })
      await expect(card).toHaveCount(1)
      await card.click()
      await page.getByRole('button', { name: /Valider la réussite/ }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: /C.est noté/ }),
      ).toBeVisible()

      const validations = await readDb(page, 'validations')
      expect(validations).toHaveLength(2)

      const fresh = validations.find((validation) => validation.date === '2027-09-10')
      expect(fresh).toBeDefined()
      expect(fresh?.schoolYearId).toBe('2027-2028')
      expect(fresh?.objectiveId).toBe('maths-nombres-05')

      const older = validations.find((validation) => validation.date === '2027-01-31')
      expect(older).toBeDefined()
      expect(older?.schoolYearId).toBe('2026-2027')

      // Aucune table n'a perdu de ligne : un élève, deux réussites, deux années.
      expect(await readDb(page, 'students')).toHaveLength(1)
      expect(await readDb(page, 'photos')).toHaveLength(0)
      expect(await readDb(page, 'schoolYears')).toHaveLength(2)

      // La nouvelle réussite est bien visible dans le dossier de l'année en cours.
      await page.getByRole('button', { name: 'Voir le dossier de Léa' }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Léa', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByText('MS · 1 réussite cette année', { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /Comparer des quantités/ }),
      ).toBeVisible()
    },
  )
})
