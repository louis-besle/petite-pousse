import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective } from '@/domain/types'
import { sharePdf } from '@/lib/share'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { generateBilanPdf } from './pdf'

vi.mock('@/lib/share', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/share')>()
  return { ...actual, sharePdf: vi.fn(async () => 'downloaded' as const) }
})

vi.mock('./pdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdf')>()
  return {
    ...actual,
    loadPdfFonts: vi.fn(async () => ({
      regular: new Uint8Array(),
      bold: new Uint8Array(),
      display: new Uint8Array(),
    })),
    generateBilanPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
  }
})

const sharePdfMock = vi.mocked(sharePdf)
const generatePdfMock = vi.mocked(generateBilanPdf)

function objective(id: string): Objective {
  const found = referential.objectives.find((candidate) => candidate.id === id)
  if (found === undefined) {
    throw new Error(`Objectif de test introuvable : ${id}`)
  }
  return found
}

async function setUp(
  options: { lastNameInitial?: string } = {},
): Promise<{ studentId: string; objectiveLabel: string }> {
  const year = makeSchoolYear()
  await db.schoolYears.put(year)
  await updateSettings({
    currentSchoolYearId: year.id,
    schoolName: 'École des Lilas',
    className: 'MS A',
    teacherName: 'Mme Martin',
  })

  const student = makeStudent({
    firstName: 'Léa',
    lastNameInitial: options.lastNameInitial ?? 'M',
  })
  await db.students.add(student)

  const target = objective('lang-vocabulaire-01')
  await createValidation({
    studentId: student.id,
    objective: target,
    ageBand: 'from4',
    date: '2026-10-12',
    referentialVersion: REFERENTIAL_VERSION,
  })

  return { studentId: student.id, objectiveLabel: target.label }
}

beforeEach(async () => {
  await ensureSeed()
  sharePdfMock.mockClear()
  generatePdfMock.mockClear()
})

describe('BilanPreviewScreen', () => {
  it('affiche l’aperçu A4 de l’élève pour la période demandée', async () => {
    const { studentId, objectiveLabel } = await setUp()

    renderApp({ route: `/bilans/${studentId}?period=1&year=2026-2027` })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Bilan des réussites')).toBeInTheDocument()
    expect(screen.getByText(objectiveLabel)).toBeInTheDocument()
    expect(screen.getByText('Signature des parents')).toBeInTheDocument()
    expect(screen.queryByText('Page 1 / 1')).not.toBeInTheDocument()
    expect(
      screen.getByText('Pagination exacte calculée dans le PDF'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Le PDF est généré directement/)).toBeInTheDocument()
    expect(screen.queryByText(/Enregistrer en PDF/)).not.toBeInTheDocument()
    expect(screen.getByText('Bilan 1')).toBeInTheDocument()
    expect(screen.getByText(/12 oct\./)).toBeInTheDocument()
  })

  it('résout l’année effective pour une URL directe sans paramètre year', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-07T12:00:00'))

    try {
      await ensureSeed()
      await db.schoolYears.put(
        makeSchoolYear({
          id: '2027-2028',
          start: '2027-09-01',
          period1End: '2028-01-31',
          period2End: '2028-06-30',
        }),
      )
      await updateSettings({ currentSchoolYearId: '2027-2028' })

      const student = makeStudent({ firstName: 'Léa' })
      await db.students.add(student)
      const target = objective('lang-vocabulaire-01')
      await createValidation({
        studentId: student.id,
        objective: target,
        ageBand: 'from4',
        date: '2026-11-07',
        referentialVersion: REFERENTIAL_VERSION,
      })

      // URL directe : ni lien élève ni paramètre `year`.
      renderApp({ route: `/bilans/${student.id}` })

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' }),
      ).toBeInTheDocument()
      expect(await screen.findByText(target.label)).toBeInTheDocument()
      expect(screen.getByText(/Bilan 1 · 2026-2027/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignore une initiale de nom vide dans l’aperçu', async () => {
    const { studentId } = await setUp({ lastNameInitial: '' })

    renderApp({ route: `/bilans/${studentId}?period=1&year=2026-2027` })

    await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' })
    expect(screen.getByText('Léa')).toBeInTheDocument()
    expect(screen.queryByText('Léa .')).not.toBeInTheDocument()
  })

  it('bascule de période en mettant à jour la requête', async () => {
    const { studentId } = await setUp()
    const user = userEvent.setup()
    const { router } = renderApp({
      route: `/bilans/${studentId}?period=1&year=2026-2027`,
    })

    await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' })
    await user.click(screen.getByRole('button', { name: 'Changer de période' }))

    await waitFor(() =>
      expect(router.state.location.search).toBe('?period=2&year=2026-2027'),
    )
    expect(screen.getByText('Bilan 2')).toBeInTheDocument()
    expect(screen.getByText('Aucune réussite sur cette période.')).toBeInTheDocument()
  })

  it('retombe proprement sur la période 1 et l’année courante pour des paramètres invalides', async () => {
    const { studentId, objectiveLabel } = await setUp()

    renderApp({ route: `/bilans/${studentId}?period=9&year=1999-2000` })

    await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' })
    expect(screen.getByText('Bilan 1')).toBeInTheDocument()
    expect(await screen.findByText(objectiveLabel)).toBeInTheDocument()
  })

  it('propose un retour aux bilans quand l’élève est introuvable', async () => {
    await setUp()

    renderApp({ route: '/bilans/inconnu?period=1' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Élève introuvable' }),
    ).toBeInTheDocument()

    const links = screen.getAllByRole('link', { name: 'Retour aux bilans' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/bilans')
    }
  })

  it('génère le PDF puis le partage avec un nom de fichier normalisé', async () => {
    const { studentId } = await setUp()
    const user = userEvent.setup()

    renderApp({ route: `/bilans/${studentId}?period=1&year=2026-2027` })
    await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' })

    await user.click(screen.getByRole('button', { name: 'Imprimer / PDF' }))

    expect(await screen.findByText('PDF téléchargé.')).toBeInTheDocument()
    expect(generatePdfMock).toHaveBeenCalledTimes(1)
    expect(sharePdfMock).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'bilan-lea-m-1-2026-2027.pdf',
    )
  })
})
