import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  addStudent,
  gotoRoute,
  openClass,
  readDb,
  seedValidation,
  waitForActiveNavColors,
} from './helpers'

/**
 * Contrôle de non-régression WebKit — Safari sur iPhone et iPad.
 *
 * L'application est d'abord destinée à être utilisée sur un appareil Apple :
 * ce fichier rejoue donc les parcours critiques dans le moteur de Safari, au
 * format iPhone 13 (390 × 844, tactile). Il ne remplace pas `a11y.spec.ts`,
 * qui reste la référence Chromium, ni les tests avec lecteur d'écran réels
 * décrits dans `docs/accessibility/PROTOCOLE-LECTEURS-ECRAN.md`.
 */

/** Horloge figée au 7 novembre 2026 : année 2026-2027 et bilan 1 déterministes. */
const FROZEN_NOW = new Date('2026-11-07T10:00:00')

/** Niveaux WCAG 2.2 A et AA, comme dans `a11y.spec.ts`. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Élève et réussite communs aux scénarios. */
interface Seed {
  studentId: string
}

async function seed(page: Page): Promise<Seed> {
  await page.clock.setFixedTime(FROZEN_NOW)
  await addStudent(page, 'Léa', 'MS')
  await openClass(page)

  const students = await readDb(page, 'students')
  const studentId = String(students[0]?.id)

  await seedValidation(page, {
    studentId,
    objectiveId: 'lang-vocabulaire-01',
    date: '2026-10-12',
  })

  return { studentId }
}

/** Échoue en listant chaque violation, pour que le rapport CI soit actionnable. */
async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  // Axe peut surprendre une animation ou une transition en cours et calculer
  // un contraste transitoire qui n'existe pas à l'état stable. On force le
  // rendu « mouvement réduit », puis on attend les couleurs finales de
  // l'onglet actif avant le scan.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await waitForActiveNavColors(page)

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const details = results.violations.map((violation) => {
    const nodes = violation.nodes.map((node) => node.target.join(' ')).join(', ')
    return `${violation.id} (${violation.impact}) — ${violation.help} [${nodes}]`
  })

  expect(
    results.violations,
    `Violations WCAG sur « ${label} » :\n${details.join('\n')}`,
  ).toEqual([])
}

test.describe('WebKit — parcours iPhone', () => {
  test('l’application se charge avec le bon titre et la bonne langue', async ({
    page,
  }) => {
    await seed(page)

    await expect(page).toHaveTitle('La classe · Petite pousse')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(
      page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
    ).toBeVisible()
  })

  test('la classe affiche l’élève et le changement de route place le focus sur le contenu', async ({
    page,
  }) => {
    await seed(page)

    const card = page.getByRole('link', { name: /^Léa, section MS,/ })
    await expect(card).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Prendre une photo/ }),
    ).toBeVisible()

    // Le dossier s'ouvre au doigt, sans double défilement horizontal.
    await card.click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Léa', exact: true }),
    ).toBeVisible()
    await expect(page).toHaveTitle('Dossier de l’élève · Petite pousse')

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)

    // Retour par la navigation : le focus suit le nouvel écran.
    await page.getByRole('link', { name: 'Classe', exact: true }).click()
    await expect(page.locator('#main')).toBeFocused()
    await expect(page).toHaveTitle('La classe · Petite pousse')
  })

  test('filtrer le programme par niveau met la liste à jour', async ({ page }) => {
    await page.clock.setFixedTime(FROZEN_NOW)
    await addStudent(page, 'Lina', 'PS')

    await page.getByRole('link', { name: 'Programme', exact: true }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Programme' }),
    ).toBeVisible()

    await page
      .getByLabel('Rechercher un objectif', { exact: true })
      .fill('syllabes')

    const scander = page.getByRole('button', {
      name: /^Ouvrir l.objectif : Scander les syllabes/,
    })
    const manipuler = page.getByRole('button', {
      name: /^Ouvrir l.objectif : Manipuler les syllabes/,
    })
    await expect(scander).toBeVisible()
    await expect(manipuler).toBeVisible()

    // PS ne garde que la tranche « avant 4 ans ».
    await page
      .getByRole('group', { name: 'Filtrer par niveau' })
      .getByRole('button', { name: 'PS', exact: true })
      .click()

    await expect(manipuler).toHaveCount(0)
    await expect(scander).toBeVisible()
  })

  test('une validation de capture aboutit à l’écran de succès', async ({ page }) => {
    await page.clock.setFixedTime(FROZEN_NOW)
    await addStudent(page, 'Léa', 'MS')

    // Parcours sans photo : l'enregistrement d'un Blob de photo dans IndexedDB
    // échoue dans le WebKit embarqué de Playwright sous Windows
    // (« Error preparing Blob/File data to be stored in object store »).
    // Le parcours photo reste couvert par le protocole manuel.
    await gotoRoute(page, '/')
    await expect(
      page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: /Prendre une photo/ }).click()
    await page
      .getByRole('button', { name: 'Léa, section MS', exact: true })
      .click()
    await expect(
      page.getByRole('group', { name: /^Élève Léa, section MS$/ }),
    ).toBeVisible()

    await page
      .getByRole('button', { name: 'Valider sans photo', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: /Choisir l.objectif/ }),
    ).toBeVisible()
    await expect(page.getByText('Validation sans photo', { exact: true })).toBeVisible()

    await page
      .getByLabel('Rechercher un objectif', { exact: true })
      .fill('lettres capitales')
    const card = page
      .getByRole('listitem')
      .getByRole('button', { name: /Tracer des lettres capitales/ })
    await expect(card).toHaveCount(1)
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: /Valider la réussite/ }).click()

    await expect(page).toHaveTitle('Réussite enregistrée · Petite pousse')
    await expect(
      page.getByRole('heading', { level: 1, name: /C.est noté/ }),
    ).toBeVisible()
    await expect(
      page.getByText('Tracer des lettres capitales.', { exact: true }),
    ).toBeVisible()
  })

  test('l’aperçu HTML du bilan est complet et désigné comme la version accessible', async ({
    page,
  }) => {
    const { studentId } = await seed(page)

    await gotoRoute(page, `/bilans/${studentId}?period=1&year=2026-2027`)

    await expect(
      page.getByRole('heading', { level: 1, name: 'Bilan de Léa', exact: true }),
    ).toBeVisible()
    await expect(page).toHaveTitle('Aperçu du bilan · Petite pousse')

    const sheet = page.getByRole('article', {
      name: 'Aperçu de la feuille A4 de Léa',
    })
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('Bilan des réussites')
    await expect(sheet).toContainText('Bilan 1 · 2026-2027')

    // L'aperçu HTML est annoncé à l'écran comme la version accessible du PDF.
    await expect(
      page.getByText(/L’aperçu à l’écran est la version accessible/),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Imprimer / PDF', exact: true }),
    ).toBeVisible()
  })

  test('les écrans principaux ne présentent aucune violation axe', async ({
    page,
  }) => {
    const { studentId } = await seed(page)

    const cases = [
      {
        label: 'classe',
        route: '/',
        title: 'La classe · Petite pousse',
        ready: async () => {
          await expect(
            page.getByRole('link', { name: /^Léa, section MS,/ }),
          ).toBeVisible()
        },
      },
      {
        label: 'programme',
        route: '/programme',
        title: 'Programme · Petite pousse',
        ready: async () => {
          await expect(
            page.getByRole('button', { name: /^Ouvrir l’objectif :/ }).first(),
          ).toBeVisible()
        },
      },
      {
        label: 'dossier',
        route: `/students/${studentId}`,
        title: 'Dossier de l’élève · Petite pousse',
        ready: async () => {
          await expect(
            page.getByRole('heading', { level: 1, name: 'Léa' }),
          ).toBeVisible()
        },
      },
      {
        label: 'bilans',
        route: '/bilans',
        title: 'Bilans · Petite pousse',
        ready: async () => {
          await expect(
            page.getByRole('button', { name: /^Bilan 1/ }),
          ).toBeVisible()
        },
      },
    ]

    for (const auditCase of cases) {
      await gotoRoute(page, auditCase.route)
      await auditCase.ready()
      await expect(page).toHaveTitle(auditCase.title)
      await expectNoAxeViolations(page, auditCase.label)
    }
  })
})
