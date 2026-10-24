import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addStudent, gotoRoute, readDb, seedDraft, seedValidation } from './helpers'

/**
 * Horloge figée au 7 novembre 2026 : l'année amorcée est toujours 2026-2027 et
 * les écrans qui dépendent de la période (bilans) restent déterministes.
 * Seule `Date` est figée, pas les timers.
 */
const FROZEN_NOW = new Date('2026-11-07T10:00:00')

/**
 * Niveaux WCAG 2.2 A et AA. RGAA 4.1 s'appuie sur WCAG 2.1 AA ; les règles
 * 2.2 AA sont incluses en plus pour couvrir les critères ajoutés depuis.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Cible tactile minimale, en pixels CSS (recommandation WCAG 2.5.5). */
const MIN_TARGET = 44

interface Seed {
  studentId: string
  validationId: string
}

async function seed(page: Page): Promise<Seed> {
  await page.clock.setFixedTime(FROZEN_NOW)
  await addStudent(page, 'Léa', 'MS')

  const students = await readDb(page, 'students')
  const studentId = String(students[0]?.id)
  const { validationId } = await seedValidation(page, {
    studentId,
    objectiveId: 'lang-vocabulaire-01',
    date: '2026-10-12',
    withPhoto: true,
  })
  await seedDraft(page, studentId)

  // Évite la notice de confidentialité sur les écrans qui n'en ont pas besoin.
  await page.evaluate(() => localStorage.setItem('privacy-ack', '1'))

  return { studentId, validationId }
}

interface AuditCase {
  label: string
  title: string
  route: (seed: Seed) => string
  ready: (page: Page, seed: Seed) => Promise<void>
}

const AUDIT_CASES: AuditCase[] = [
  {
    label: 'classe',
    title: 'La classe · Petite pousse',
    route: () => '/',
    ready: async (page) => {
      await expect(
        page.getByRole('link', { name: /^Léa, section MS,/ }),
      ).toBeVisible()
    },
  },
  {
    label: 'choix de l’élève',
    title: 'Nouvelle réussite · Petite pousse',
    route: () => '/capture',
    ready: async (page) => {
      await expect(
        page.getByRole('button', { name: 'Léa, section MS', exact: true }),
      ).toBeVisible()
    },
  },
  {
    label: 'capture — photo',
    title: 'Nouvelle réussite · Petite pousse',
    route: ({ studentId }) => `/capture/${studentId}/photo`,
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Nouvelle réussite' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /^(Prendre la photo|Choisir l’objectif)$/ }),
      ).toBeVisible()
    },
  },
  {
    label: 'capture — objectif',
    title: 'Choisir l’objectif · Petite pousse',
    route: () => '/capture/objective',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: "Choisir l'objectif" }),
      ).toBeVisible()
    },
  },
  {
    label: 'dossier',
    title: 'Dossier de l’élève · Petite pousse',
    route: ({ studentId }) => `/students/${studentId}`,
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Léa' }),
      ).toBeVisible()
      await expect(page.getByText('Comprendre, mémoriser')).toBeVisible()
    },
  },
  {
    label: 'gestion des élèves',
    title: 'Gérer les élèves · Petite pousse',
    route: () => '/students',
    ready: async (page) => {
      await expect(
        page.getByRole('button', { name: /^Modifier Léa, section MS,/ }),
      ).toBeVisible()
    },
  },
  {
    label: 'programme',
    title: 'Programme · Petite pousse',
    route: () => '/programme',
    ready: async (page) => {
      await expect(
        page.getByRole('button', { name: /^Ouvrir l’objectif :/ }).first(),
      ).toBeVisible()
    },
  },
  {
    label: 'bilans',
    title: 'Bilans · Petite pousse',
    route: () => '/bilans',
    ready: async (page) => {
      await expect(page.getByRole('button', { name: /^Bilan 1/ })).toBeVisible()
    },
  },
  {
    label: 'aperçu bilan',
    title: 'Aperçu du bilan · Petite pousse',
    route: ({ studentId }) =>
      `/bilans/${studentId}?period=1&year=2026-2027`,
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Bilan de Léa' }),
      ).toBeVisible()
      await expect(page.getByText('Bilan des réussites')).toBeVisible()
    },
  },
  {
    label: 'réglages',
    title: 'Réglages · Petite pousse',
    route: () => '/settings',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Réglages' }),
      ).toBeVisible()
    },
  },
  {
    label: 'succès',
    title: 'Réussite enregistrée · Petite pousse',
    route: ({ validationId }) => `/success/${validationId}`,
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: "C'est noté !" }),
      ).toBeVisible()
    },
  },
  {
    label: 'page introuvable',
    title: 'Page introuvable · Petite pousse',
    route: () => '/inconnu',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Page introuvable' }),
      ).toBeVisible()
    },
  },
  {
    label: 'fiche objectif',
    title: 'Programme · Petite pousse',
    route: () => '/programme',
    ready: async (page) => {
      await page
        .getByRole('button', { name: /^Ouvrir l’objectif :/ })
        .first()
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    label: 'fiche réussite',
    title: 'Dossier de l’élève · Petite pousse',
    route: ({ studentId }) => `/students/${studentId}`,
    ready: async (page) => {
      await page.locator('main ul li button').first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    label: 'formulaire élève',
    title: 'Gérer les élèves · Petite pousse',
    route: () => '/students',
    ready: async (page) => {
      await page.getByRole('button', { name: 'Ajouter un élève' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    label: 'confirmation de suppression',
    title: 'Gérer les élèves · Petite pousse',
    route: () => '/students',
    ready: async (page) => {
      await page.getByRole('button', { name: 'Supprimer Léa' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    label: 'dates de bilan',
    title: 'Bilans · Petite pousse',
    route: () => '/bilans',
    ready: async (page) => {
      await page
        .getByRole('button', { name: 'Modifier la date de changement' })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    label: 'notice de confidentialité',
    title: 'Réglages · Petite pousse',
    route: () => '/settings',
    ready: async (page) => {
      await page.getByRole('button', { name: 'Relire la notice' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    label: 'sauvegarde chiffrée',
    title: 'Réglages · Petite pousse',
    route: () => '/settings',
    ready: async (page) => {
      await page
        .getByRole('checkbox', { name: 'Protéger par un mot de passe' })
        .check()
      await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible()
    },
  },
]

/** Repart du corps du document, comme à l'arrivée sur une page. */
async function resetFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })
}

async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const details = results.violations.map((violation) => {
    const nodes = violation.nodes
      .map((node) => node.target.join(' '))
      .join(', ')
    return `${violation.id} (${violation.impact}) — ${violation.help} [${nodes}]`
  })

  expect(
    results.violations,
    `Violations WCAG sur « ${label} » :\n${details.join('\n')}`,
  ).toEqual([])
}

test.describe('conformité WCAG 2.1/2.2 AA', () => {
  for (const auditCase of AUDIT_CASES) {
    test(`écran « ${auditCase.label} » sans violation axe`, async ({ page }) => {
      const seeded = await seed(page)
      await gotoRoute(page, auditCase.route(seeded))
      await auditCase.ready(page, seeded)

      await expect(page).toHaveTitle(auditCase.title)
      await expectNoAxeViolations(page, auditCase.label)
    })
  }
})

test.describe('navigation au clavier et focus', () => {
  test('le lien d’évitement mène au contenu principal', async ({ page }) => {
    await seed(page)
    await gotoRoute(page, '/')
    await resetFocus(page)

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: /contenu principal/i })
    await expect(skipLink).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  test('une feuille piège le focus, se ferme avec Échap et le rend au déclencheur', async ({
    page,
  }) => {
    await seed(page)
    await gotoRoute(page, '/programme')

    const trigger = page
      .getByRole('button', { name: /^Ouvrir l’objectif :/ })
      .first()
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeFocused()

    await page.keyboard.press('Tab')
    const focusables = dialog.locator(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    await expect(focusables.first()).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(focusables.last()).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('le focus visible reste dessiné sur les liens et boutons', async ({
    page,
  }) => {
    await seed(page)
    await gotoRoute(page, '/')
    await resetFocus(page)

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: /contenu principal/i })
    await expect(skipLink).toBeFocused()

    const outline = await skipLink.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
      }
    })
    expect(outline.style).not.toBe('none')
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2)
  })
})

test.describe('reflow, mouvement et cibles tactiles', () => {
  test('aucun débordement horizontal à 320 px de large', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    const seeded = await seed(page)

    const routes = [
      '/',
      '/capture',
      `/capture/${seeded.studentId}/photo`,
      '/capture/objective',
      `/students/${seeded.studentId}`,
      '/students',
      '/programme',
      '/bilans',
      `/bilans/${seeded.studentId}?period=1&year=2026-2027`,
      '/settings',
      '/inconnu',
    ]

    for (const route of routes) {
      await gotoRoute(page, route)
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(
        overflow,
        `Débordement horizontal de ${overflow} px sur ${route}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  test('le contenu reste lisible avec des espacements de texte augmentés', async ({
    page,
  }) => {
    await seed(page)
    await gotoRoute(page, '/programme')

    await page.addStyleTag({
      content: `
        * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p {
          margin-bottom: 2em !important;
        }
      `,
    })

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Programme' }),
    ).toBeVisible()
  })

  test('le contenu et la navigation restent compréhensibles sans CSS', async ({
    page,
  }) => {
    await seed(page)
    await gotoRoute(page, '/')

    await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        sheet.disabled = true
      }
    })

    await expect(
      page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /^Léa, section MS,/ }),
    ).toBeVisible()
  })

  test('la mise en page tient en orientation paysage', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 320 })
    await seed(page)
    await gotoRoute(page, '/')

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(
      page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
    ).toBeVisible()
  })

  test('les animations sont neutralisées avec prefers-reduced-motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(page)
    await gotoRoute(page, '/programme')

    await page
      .getByRole('button', { name: /^Ouvrir l’objectif :/ })
      .first()
      .click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const durations = await dialog.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        animation: style.animationDuration,
        transition: style.transitionDuration,
      }
    })

    for (const duration of [durations.animation, durations.transition]) {
      expect(parseFloat(duration)).toBeLessThanOrEqual(0.01)
    }
  })

  test('les cibles tactiles de la classe et de la capture font au moins 44 × 44 px', async ({
    page,
  }) => {
    await seed(page)

    await gotoRoute(page, '/')
    await expect(
      page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /^Léa, section MS,/ }),
    ).toBeVisible()

    const classTargets = await visibleTouchTargets(page)
    expect(classTargets.length).toBeGreaterThan(0)
    expect(
      tooSmall(classTargets),
      'Cibles tactiles trop petites sur la classe',
    ).toEqual([])

    await gotoRoute(page, '/capture')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Léa, section MS', exact: true }),
    ).toBeVisible()

    const captureTargets = await visibleTouchTargets(page)
    expect(captureTargets.length).toBeGreaterThan(0)
    expect(
      tooSmall(captureTargets),
      'Cibles tactiles trop petites sur la capture',
    ).toEqual([])
  })
})

interface TouchTarget {
  tag: string
  name: string
  width: number
  height: number
}

/**
 * Boîtes rendues des contrôles réellement visibles dans le viewport. Un
 * élément hors écran (lien d'évitement replié) ou de taille nulle est ignoré ;
 * un `input[type=hidden]` n'est jamais une cible tactile.
 */
async function visibleTouchTargets(page: Page): Promise<TouchTarget[]> {
  return page.locator('button, a, input').evaluateAll((elements) =>
    elements.flatMap((element) => {
      if (element instanceof HTMLInputElement && element.type === 'hidden') {
        return []
      }

      const rect = element.getBoundingClientRect()
      const intersectsViewport =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight

      if (!intersectsViewport) return []

      const label =
        element.getAttribute('aria-label') ??
        element.textContent?.trim().slice(0, 60) ??
        ''

      return [
        {
          tag: element.tagName.toLowerCase(),
          name: label === '' ? '(sans libellé)' : label,
          width: rect.width,
          height: rect.height,
        },
      ]
    }),
  )
}

/** Décrit les cibles trop petites pour que l'échec soit actionnable. */
function tooSmall(targets: TouchTarget[]): string[] {
  return targets
    .filter(
      (target) => target.width < MIN_TARGET || target.height < MIN_TARGET,
    )
    .map(
      (target) =>
        `${target.tag} « ${target.name} » : ${target.width.toFixed(1)} × ${target.height.toFixed(1)} px`,
    )
}
