import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addStudent, gotoRoute, readDb, seedDraft } from './helpers'

/**
 * Horloge figée au 7 novembre 2026 : l'année amorcée est toujours 2026-2027 et
 * les écrans qui dépendent de la période (bilans) restent déterministes.
 * Seule `Date` est figée, pas les timers.
 */
const FROZEN_NOW = new Date('2026-11-07T10:00:00')

/** Cible tactile minimale, en pixels CSS (recommandation WCAG 2.5.5). */
const MIN_TARGET = 44

interface ScreenCase {
  label: string
  route: string
  heading: string | RegExp
  /** Attend les données vivantes de l'écran avant l'analyse axe. */
  ready: (page: Page) => Promise<void>
}

const SCREENS: ScreenCase[] = [
  {
    label: 'classe',
    route: '/',
    heading: /^Bonjour/,
    ready: async (page) => {
      await expect(
        page.getByRole('link', { name: /^Léa, section MS,/ }),
      ).toBeVisible()
    },
  },
  {
    label: 'choix de l’élève',
    route: '/capture',
    heading: 'Pour qui ?',
    ready: async (page) => {
      await expect(
        page.getByRole('button', { name: 'Léa, section MS', exact: true }),
      ).toBeVisible()
    },
  },
  {
    label: 'programme',
    route: '/programme',
    heading: 'Programme',
    ready: async (page) => {
      // Le domaine Langage est ouvert par défaut : ses lignes sont rendues.
      await expect(
        page.getByRole('button', { name: /^Ouvrir l’objectif :/ }).first(),
      ).toBeVisible()
    },
  },
  {
    label: 'bilans',
    route: '/bilans',
    heading: 'Bilans',
    ready: async (page) => {
      await expect(page.getByRole('button', { name: /^Bilan 1/ })).toBeVisible()
    },
  },
  {
    label: 'gestion des élèves',
    route: '/students',
    heading: 'Gérer les élèves',
    ready: async (page) => {
      await expect(
        page.getByRole('button', { name: /^Modifier Léa, section MS,/ }),
      ).toBeVisible()
    },
  },
]

/** Sème une élève et son brouillon de capture, comme un début de parcours réel. */
async function seedClass(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW)
  await addStudent(page, 'Léa', 'MS')

  const students = await readDb(page, 'students')
  const studentId = String(students[0]?.id)
  await seedDraft(page, studentId)
}

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

test.describe('accessibilité', () => {
  for (const screen of SCREENS) {
    test(`écran ${screen.label} sans violation axe grave ou critique`, async ({
      page,
    }) => {
      await seedClass(page)

      await gotoRoute(page, screen.route)
      await expect(
        page.getByRole('heading', { level: 1, name: screen.heading }),
      ).toBeVisible()
      await screen.ready(page)

      const results = await new AxeBuilder({ page }).analyze()
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      )
      const details = blocking.map((violation) => {
        const nodes = violation.nodes
          .map((node) => node.target.join(' '))
          .join(', ')
        return `${violation.id} (${violation.impact}) — ${violation.help} [${nodes}]`
      })

      expect(
        blocking,
        `Violations axe bloquantes :\n${details.join('\n')}`,
      ).toEqual([])
    })
  }

  test('les cibles tactiles de la classe et de la capture font au moins 44 × 44 px', async ({
    page,
  }) => {
    await seedClass(page)

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
