import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { addStudent, gotoRoute, openClass, readDb, seedValidation } from './helpers'

test.describe('bilans', () => {
  test(
    'compte, déplace et imprime un bilan A4',
    // La génération pdf-lib (fontes embarquées) et l'extraction pdf.js sont
    // lentes sur une machine chargée : marge généreuse volontaire.
    async ({ page }) => {
      test.setTimeout(180_000)

      // Date figée au 7 novembre 2026 : la période par défaut est le bilan 1 et
      // l'année courante amorcée est 2026-2027, indépendamment du calendrier de
      // la machine. Seule `Date` est figée, pas les timers.
      await page.clock.setFixedTime(new Date('2026-11-07T10:00:00'))

      // Le PDF doit toujours prendre la branche téléchargement : on retire Web
      // Share pour que le test ne dépende pas du navigateur hôte.
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'canShare', {
          configurable: true,
          value: undefined,
        })
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: undefined,
        })
      })

      await addStudent(page, 'Léa', 'MS')
      await openClass(page)

      const students = await readDb(page, 'students')
      expect(students).toHaveLength(1)
      const studentId = String(students[0]?.id)

      await seedValidation(page, {
        studentId,
        objectiveId: 'lang-vocabulaire-01',
        date: '2027-01-31',
      })
      await seedValidation(page, {
        studentId,
        objectiveId: 'lang-vocabulaire-02',
        date: '2027-02-01',
      })

      await gotoRoute(page, '/bilans')
      await expect(
        page.getByRole('heading', { level: 1, name: 'Bilans', exact: true }),
      ).toBeVisible()

      const period1 = page.getByRole('button', { name: /^Bilan 1/ })
      const period2 = page.getByRole('button', { name: /^Bilan 2/ })
      await expect(period1).toBeVisible()
      // Année amorcée et période par défaut, sans dépendre de la date réelle.
      await expect(
        page.getByRole('combobox', { name: 'Année scolaire' }),
      ).toHaveValue('2026-2027')
      await expect(period1).toHaveAttribute('aria-pressed', 'true')
      await expect(period2).toHaveAttribute('aria-pressed', 'false')
      await expect(period1).toContainText('1 réussite')
      await expect(period2).toContainText('1 réussite')

      // Date de changement déplacée au 15 janvier : le 31 janvier bascule du
      // bilan 1 vers le bilan 2.
      await page
        .getByRole('button', { name: 'Modifier la date de changement', exact: true })
        .click()
      const dialog = page.getByRole('dialog', {
        name: 'Modifier la date de changement',
      })
      await expect(dialog).toBeVisible()

      const input = dialog.getByLabel('Date de changement de semestre', {
        exact: true,
      })
      await expect(input).toHaveValue('2027-01-31')
      await input.fill('2027-01-15')

      await expect(
        dialog.getByText('1 réussite change de bilan', { exact: true }),
      ).toBeVisible()

      await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
      await expect(page.getByText('Date de changement enregistrée.')).toBeVisible()
      await expect(dialog).toBeHidden()

      await expect(period1).toContainText('0 réussite')
      await expect(period2).toContainText('2 réussites')

      // Bilan 2 sélectionné : la feuille contient les deux réussites.
      await period2.click()
      await expect(period2).toHaveAttribute('aria-pressed', 'true')

      const row = page.getByRole('link', {
        name: 'Léa, section MS, 2 réussites pour le bilan 2',
        exact: true,
      })
      await expect(row).toBeVisible()
      await row.click()

      await expect(
        page.getByRole('heading', { level: 1, name: 'Bilan de Léa', exact: true }),
      ).toBeVisible()
      const sheet = page.getByRole('article', {
        name: 'Aperçu de la feuille A4 de Léa',
      })
      await expect(sheet).toBeVisible()
      await expect(sheet).toContainText('Bilan 2 · 2026-2027')
      await expect(sheet).toContainText('2 réussites')

      const downloadPromise = page.waitForEvent('download', { timeout: 120_000 })
      await page.getByRole('button', { name: 'Imprimer / PDF', exact: true }).click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toBe('bilan-lea-2-2026-2027.pdf')

      const filePath = await download.path()
      expect(filePath).not.toBeNull()
      const bytes = readFileSync(filePath as string)

      // pdf.js sans worker ni eval : même environnement déterministe que les
      // tests unitaires du PDF.
      const task = getDocument({
        data: new Uint8Array(bytes),
        useWorkerFetch: false,
        isEvalSupported: false,
      } as Parameters<typeof getDocument>[0])

      try {
        const document = await task.promise
        expect(document.numPages).toBe(1)

        const pdfPage = await document.getPage(1)
        const viewport = pdfPage.getViewport({ scale: 1 })
        expect(viewport.width).toBeCloseTo(595.28, 0)
        expect(viewport.height).toBeCloseTo(841.89, 0)
        expect(Math.abs(viewport.width - 595.28)).toBeLessThanOrEqual(1)
        expect(Math.abs(viewport.height - 841.89)).toBeLessThanOrEqual(1)

        const content = await pdfPage.getTextContent()
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()

        expect(text).toContain('Bilan des réussites')
        expect(text).toContain('Léa')
        expect(text).toContain('Page 1 / 1')
      } finally {
        await task.destroy()
      }
    },
  )

  test('génère le lot de bilans de la classe en un ZIP', async ({ page }) => {
    test.setTimeout(180_000)

    // Même horloge figée que le scénario individuel : période 1 par défaut.
    await page.clock.setFixedTime(new Date('2026-11-07T10:00:00'))

    await addStudent(page, 'Léa', 'MS')
    await addStudent(page, 'Adam', 'PS')
    await openClass(page)

    const students = await readDb(page, 'students')
    expect(students).toHaveLength(2)
    const lea = students.find((student) => student.firstName === 'Léa')
    expect(lea).toBeDefined()

    // Une seule réussite : Adam doit tout de même produire un PDF.
    await seedValidation(page, {
      studentId: String(lea?.id),
      objectiveId: 'lang-vocabulaire-01',
      date: '2026-10-12',
    })

    await gotoRoute(page, '/bilans')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Bilans', exact: true }),
    ).toBeVisible()

    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 })
    await page
      .getByRole('button', { name: 'Générer les 2 bilans (ZIP)', exact: true })
      .click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('bilans-1-2026-2027.zip')

    const filePath = await download.path()
    expect(filePath).not.toBeNull()
    const entries = unzipSync(new Uint8Array(readFileSync(filePath as string)))

    // Deux entrées PDF, une par élève, y compris celui sans réussite.
    expect(Object.keys(entries).sort()).toEqual([
      'bilan-adam-1-2026-2027.pdf',
      'bilan-lea-1-2026-2027.pdf',
    ])

    for (const bytes of Object.values(entries)) {
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
      expect(bytes.byteLength).toBeGreaterThan(1_000)
    }
  })
})
