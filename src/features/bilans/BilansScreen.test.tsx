import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective, SchoolYear, Section } from '@/domain/types'
import { downloadBlob } from '@/lib/share'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { generateBilanBundle, type BatchBilanBundle } from './batch'

vi.mock('@/lib/share', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/share')>()
  return { ...actual, downloadBlob: vi.fn() }
})

vi.mock('./batch', () => ({
  generateBilanBundle: vi.fn(),
}))

const downloadBlobMock = vi.mocked(downloadBlob)
const generateBundleMock = vi.mocked(generateBilanBundle)

function objective(id: string): Objective {
  const found = referential.objectives.find((candidate) => candidate.id === id)
  if (found === undefined) {
    throw new Error(`Objectif de test introuvable : ${id}`)
  }
  return found
}

async function addStudent(firstName: string, section: Section = 'MS') {
  const student = makeStudent({ firstName, section })
  await db.students.add(student)
  return student
}

async function addValidation(studentId: string, objectiveId: string, date: string) {
  const found = objective(objectiveId)
  return createValidation({
    studentId,
    objective: found,
    ageBand: found.ageBands[0],
    date,
    referentialVersion: REFERENTIAL_VERSION,
  })
}

/** Année 2026-2027 posée explicitement, indépendamment de la date du jour. */
async function setUpYear(overrides: Partial<SchoolYear> = {}): Promise<SchoolYear> {
  const year = makeSchoolYear(overrides)
  await db.schoolYears.put(year)
  await updateSettings({ currentSchoolYearId: year.id })
  return year
}

function periodCard(period: 1 | 2): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Bilan ${period}`) })
}

function studentRow(firstName: string): HTMLElement {
  return screen.getByRole('link', { name: new RegExp(`^${firstName}`) })
}

async function openCutoverEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Modifier la date de changement' }),
  )
  const dialog = await screen.findByRole('dialog', {
    name: 'Modifier la date de changement',
  })
  const input = within(dialog).getByLabelText('Date de changement de semestre')

  return { dialog, input }
}

async function saveCutover(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
): Promise<void> {
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
}

beforeEach(async () => {
  await ensureSeed()
  downloadBlobMock.mockClear()
  generateBundleMock.mockReset()
})

describe('BilansScreen', () => {
  it('compte une validation au 31 janvier dans le bilan 1 et une au 1er février dans le bilan 2', async () => {
    await setUpYear()
    const lea = await addStudent('Léa')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2027-01-31')
    await addValidation(lea.id, 'lang-vocabulaire-02', '2027-02-01')

    const user = userEvent.setup()
    renderApp({ route: '/bilans' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bilans' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Deux fois par an, une feuille A4 par élève'),
    ).toBeInTheDocument()

    await screen.findByRole('button', { name: /^Bilan 1/ })
    expect(within(periodCard(1)).getByText('1 réussite')).toBeInTheDocument()
    expect(within(periodCard(2)).getByText('1 réussite')).toBeInTheDocument()

    // Les cartes sont des boutons sélectionnables, une seule pressée.
    await user.click(periodCard(1))
    expect(periodCard(1)).toHaveAttribute('aria-pressed', 'true')
    expect(periodCard(2)).toHaveAttribute('aria-pressed', 'false')

    expect(within(studentRow('Léa')).getByText('MS · 1 réussite')).toBeInTheDocument()
    expect(studentRow('Léa')).toHaveAttribute(
      'href',
      `/bilans/${lea.id}?period=1&year=2026-2027`,
    )

    await user.click(periodCard(2))
    await waitFor(() =>
      expect(periodCard(2)).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(within(studentRow('Léa')).getByText('MS · 1 réussite')).toBeInTheDocument()
    expect(studentRow('Léa')).toHaveAttribute(
      'href',
      `/bilans/${lea.id}?period=2&year=2026-2027`,
    )
  })

  it('restaure la période et l’année depuis l’URL', async () => {
    await setUpYear()
    const lea = await addStudent('Léa')
    await addValidation(lea.id, 'lang-vocabulaire-02', '2027-02-01')

    renderApp({ route: '/bilans?period=2&year=2026-2027' })

    await screen.findByRole('button', { name: /^Bilan 2/ })
    expect(periodCard(2)).toHaveAttribute('aria-pressed', 'true')
    expect(periodCard(1)).toHaveAttribute('aria-pressed', 'false')
    expect(studentRow('Léa')).toHaveAttribute(
      'href',
      `/bilans/${lea.id}?period=2&year=2026-2027`,
    )
  })

  it('conserve le bilan 2 après le retour depuis un aperçu', async () => {
    await setUpYear()
    const lea = await addStudent('Léa')
    const user = userEvent.setup()

    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 2/ })

    await user.click(periodCard(2))
    await waitFor(() =>
      expect(periodCard(2)).toHaveAttribute('aria-pressed', 'true'),
    )
    await user.click(studentRow('Léa'))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Retour aux bilans' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bilans' }),
    ).toBeInTheDocument()
    await screen.findByRole('button', { name: /^Bilan 2/ })
    expect(periodCard(2)).toHaveAttribute('aria-pressed', 'true')
    expect(studentRow('Léa')).toHaveAttribute(
      'href',
      `/bilans/${lea.id}?period=2&year=2026-2027`,
    )
  })

  it('conserve le bilan 2 avec le retour arrière du navigateur', async () => {
    await setUpYear()
    await addStudent('Léa')
    const user = userEvent.setup()

    const { router } = renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 2/ })

    await user.click(periodCard(2))
    await waitFor(() =>
      expect(periodCard(2)).toHaveAttribute('aria-pressed', 'true'),
    )
    await user.click(studentRow('Léa'))
    await screen.findByRole('heading', { level: 1, name: 'Bilan de Léa' })

    await act(async () => {
      await router.navigate(-1)
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bilans' }),
    ).toBeInTheDocument()
    await screen.findByRole('button', { name: /^Bilan 2/ })
    expect(periodCard(2)).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.search).toBe('?period=2&year=2026-2027')
  })

  it('choisit l’année de la date du jour quand les réglages sont en avance', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-07T12:00:00'))

    try {
      // L'amorçage du test a tourné à l'heure réelle : on rejoue l'année du jour.
      await ensureSeed()
      await setUpYear({
        id: '2027-2028',
        start: '2027-09-01',
        period1End: '2028-01-31',
        period2End: '2028-06-30',
      })
      const lea = await addStudent('Léa')
      await addValidation(lea.id, 'lang-vocabulaire-01', '2026-11-07')

      renderApp({ route: '/bilans' })
      await screen.findByRole('button', { name: /^Bilan 1/ })

      expect(screen.getByRole('combobox', { name: 'Année scolaire' })).toHaveValue(
        '2026-2027',
      )
      expect(within(periodCard(1)).getByText('1 réussite')).toBeInTheDocument()
      expect(within(periodCard(1)).queryByText('Passé')).not.toBeInTheDocument()
      expect(within(studentRow('Léa')).getByText('MS · 1 réussite')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('déplace une réussite vers le bilan 2 en changeant la date au 15 janvier', async () => {
    await setUpYear()
    const lea = await addStudent('Léa')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2027-01-31')
    await addValidation(lea.id, 'lang-vocabulaire-02', '2027-02-01')

    const user = userEvent.setup()
    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    const { dialog, input } = await openCutoverEditor(user)
    expect(input).toHaveValue('2027-01-31')
    // La date n'a pas changé : aucun récapitulatif de déplacement.
    expect(
      within(dialog).queryByText(/réussite.*de bilan/),
    ).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: '2027-01-15' } })
    expect(within(dialog).getByText('1 réussite change de bilan')).toBeInTheDocument()

    await saveCutover(user, dialog)

    expect(await screen.findByText('Date de changement enregistrée.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    const stored = await db.schoolYears.get('2026-2027')
    expect(stored?.period1End).toBe('2027-01-15')

    await waitFor(() => {
      expect(within(periodCard(1)).getByText('0 réussite')).toBeInTheDocument()
      expect(within(periodCard(2)).getByText('2 réussites')).toBeInTheDocument()
    })
  })

  it('ramène les réussites dans le bilan 1 en repassant la date au 5 février', async () => {
    await setUpYear({ period1End: '2027-01-15' })
    const lea = await addStudent('Léa')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2027-01-31')
    await addValidation(lea.id, 'lang-vocabulaire-02', '2027-02-01')

    const user = userEvent.setup()
    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    await waitFor(() => {
      expect(within(periodCard(1)).getByText('0 réussite')).toBeInTheDocument()
      expect(within(periodCard(2)).getByText('2 réussites')).toBeInTheDocument()
    })

    const { dialog, input } = await openCutoverEditor(user)
    expect(input).toHaveValue('2027-01-15')

    fireEvent.change(input, { target: { value: '2027-02-05' } })
    expect(
      within(dialog).getByText('2 réussites changent de bilan'),
    ).toBeInTheDocument()

    await saveCutover(user, dialog)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    const stored = await db.schoolYears.get('2026-2027')
    expect(stored?.period1End).toBe('2027-02-05')

    await waitFor(() => {
      expect(within(periodCard(1)).getByText('2 réussites')).toBeInTheDocument()
      expect(within(periodCard(2)).getByText('0 réussite')).toBeInTheDocument()
    })
  })

  it('refuse une date hors de l’intervalle et laisse la base intacte', async () => {
    await setUpYear()
    const lea = await addStudent('Léa')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2027-01-31')

    const user = userEvent.setup()
    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    const { dialog, input } = await openCutoverEditor(user)
    const save = within(dialog).getByRole('button', { name: 'Enregistrer' })

    // Avant la rentrée.
    fireEvent.change(input, { target: { value: '2026-08-31' } })
    const error = within(dialog).getByRole('alert')
    expect(error).toHaveTextContent(/entre le 1er septembre 2026 et le 30 juin 2027/i)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining(error.id))
    expect(save).toBeDisabled()
    // Hors bornes : aucune ligne de récapitulatif, seulement l'erreur.
    expect(
      within(dialog).queryByText(/réussite.*de bilan/),
    ).not.toBeInTheDocument()

    // Borne haute exclue.
    fireEvent.change(input, { target: { value: '2027-06-30' } })
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(save).toBeDisabled()
    expect(
      within(dialog).queryByText(/réussite.*de bilan/),
    ).not.toBeInTheDocument()

    const stored = await db.schoolYears.get('2026-2027')
    expect(stored?.period1End).toBe('2027-01-31')
  })

  it('ne touche pas l’autre année scolaire en changeant la date de l’année sélectionnée', async () => {
    await setUpYear({
      id: '2025-2026',
      start: '2025-09-01',
      period1End: '2026-01-31',
      period2End: '2026-06-30',
    })
    await setUpYear()
    const lea = await addStudent('Léa')
    await addValidation(lea.id, 'lang-vocabulaire-03', '2025-10-12')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')

    const otherBefore = await db.schoolYears.get('2025-2026')

    const user = userEvent.setup()
    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    const { dialog, input } = await openCutoverEditor(user)
    expect(input).toHaveValue('2027-01-31')
    fireEvent.change(input, { target: { value: '2027-01-15' } })
    await saveCutover(user, dialog)

    await waitFor(async () => {
      const updated = await db.schoolYears.get('2026-2027')
      expect(updated?.period1End).toBe('2027-01-15')
    })
    expect(await db.schoolYears.get('2025-2026')).toEqual(otherBefore)

    // L'autre année garde ses propres bornes et ses propres compteurs.
    const yearSelect = screen.getByRole('combobox', { name: 'Année scolaire' })
    await user.selectOptions(yearSelect, '2025-2026')
    await waitFor(() => expect(yearSelect).toHaveValue('2025-2026'))

    await waitFor(() =>
      expect(periodCard(1)).toHaveTextContent('1 sept. 2025 → 31 janv. 2026'),
    )
    expect(within(periodCard(1)).getByText('1 réussite')).toBeInTheDocument()
    // Une année antérieure à l'année courante affiche « Passé » sur ses deux bilans.
    expect(within(periodCard(1)).getByText('Passé')).toBeInTheDocument()
    expect(within(periodCard(2)).getByText('Passé')).toBeInTheDocument()
  })

  it('n’affiche une validation de juillet dans aucun bilan', async () => {
    await setUpYear()
    const lea = await addStudent('Léa')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2027-07-15')

    const user = userEvent.setup()
    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    expect(within(periodCard(1)).getByText('0 réussite')).toBeInTheDocument()
    expect(within(periodCard(2)).getByText('0 réussite')).toBeInTheDocument()

    await user.click(periodCard(1))
    expect(within(studentRow('Léa')).getByText('MS · 0 réussite')).toBeInTheDocument()

    await user.click(periodCard(2))
    await waitFor(() =>
      expect(within(studentRow('Léa')).getByText('MS · 0 réussite')).toBeInTheDocument(),
    )
  })

  it('affiche tous les élèves, y compris ceux sans réussite, triés par prénom', async () => {
    await setUpYear()
    const zoe = await addStudent('Zoé', 'GS')
    const adam = await addStudent('Adam', 'PS')

    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    // La période par défaut dépend de la date du jour : on fixe le bilan 1
    // avant de vérifier les liens, sans dépendre du calendrier réel.
    const user = userEvent.setup()
    await user.click(periodCard(1))

    const rows = screen.getAllByRole('link', { name: /^(Adam|Zoé)/ })
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      `/bilans/${adam.id}?period=1&year=2026-2027`,
      `/bilans/${zoe.id}?period=1&year=2026-2027`,
    ])
    expect(within(studentRow('Adam')).getByText('PS · 0 réussite')).toBeInTheDocument()
    expect(within(studentRow('Zoé')).getByText('GS · 0 réussite')).toBeInTheDocument()
  })

  it('retombe sur l’année connue la plus récente quand l’année des réglages a disparu', async () => {
    await setUpYear()

    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    // `ensureSeed` (au montage) ajoute l'année réelle du jour. On repart d'une
    // table vidée puis des deux années de test pour que la cible du repli ne
    // dépende jamais du calendrier.
    await db.transaction('rw', db.schoolYears, async () => {
      await db.schoolYears.clear()
      await db.schoolYears.put(
        makeSchoolYear({
          id: '2025-2026',
          start: '2025-09-01',
          period1End: '2026-01-31',
          period2End: '2026-06-30',
        }),
      )
      await db.schoolYears.put(makeSchoolYear())
    })

    // Les réglages pointent encore vers 2026-2027, mais la ligne disparaît :
    // l'écran doit se rabattre sur l'année connue, pas rester en chargement.
    await db.schoolYears.delete('2026-2027')

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Année scolaire' }),
      ).toHaveValue('2025-2026')
      expect(periodCard(1)).toHaveTextContent('1 sept. 2025 → 31 janv. 2026')
    })
    expect(screen.queryByText('Chargement des bilans…')).not.toBeInTheDocument()
  })

  it('affiche un état vide quand la classe n’a aucun élève', async () => {
    await setUpYear()

    renderApp({ route: '/bilans' })

    expect(screen.getByText('Chargement des bilans…')).toBeInTheDocument()
    expect(
      await screen.findByText('Aucun élève dans la classe'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajouter un élève' })).toHaveAttribute(
      'href',
      '/students',
    )
    // Classe vide : aucune génération de lot à proposer.
    expect(
      screen.queryByRole('button', { name: /Générer .*\(ZIP\)/ }),
    ).not.toBeInTheDocument()
  })

  it('télécharge le ZIP de toute la classe et annonce la progression', async () => {
    await setUpYear()
    await addStudent('Léa')
    await addStudent('Adam', 'PS')

    let resolveBundle!: (bundle: BatchBilanBundle) => void
    generateBundleMock.mockImplementationOnce(async (input, onProgress) => {
      const student = input.students[0]
      if (student !== undefined) {
        onProgress?.({ done: 1, total: input.students.length, student })
      }
      return new Promise<BatchBilanBundle>((resolve) => {
        resolveBundle = resolve
      })
    })

    const user = userEvent.setup()
    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    const button = screen.getByRole('button', {
      name: 'Générer les 2 bilans (ZIP)',
    })
    await user.click(button)

    // Adam est le premier élève trié par prénom.
    const status = await screen.findByText('Bilan 1 sur 2 · Adam')
    expect(status).toHaveAttribute('role', 'status')
    expect(button).toBeDisabled()

    const progress = screen.getByRole('progressbar', {
      name: 'Progression de la génération des bilans',
    })
    expect(progress).toHaveAttribute('value', '1')
    expect(progress).toHaveAttribute('max', '2')

    resolveBundle({
      blob: new Blob(['zip'], { type: 'application/zip' }),
      filename: 'bilans-1-2026-2027.zip',
      count: 2,
    })

    expect(await screen.findByText('2 bilans téléchargés.')).toBeInTheDocument()
    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Blob),
      'bilans-1-2026-2027.zip',
    )
    await waitFor(() => expect(button).not.toBeDisabled())
  })

  it('affiche un message français quand la génération du lot échoue', async () => {
    await setUpYear()
    await addStudent('Léa')

    generateBundleMock.mockRejectedValueOnce(new Error('échec disque'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const user = userEvent.setup()
      renderApp({ route: '/bilans' })
      await screen.findByRole('button', { name: /^Bilan 1/ })

      await user.click(
        screen.getByRole('button', { name: 'Générer le bilan (ZIP)' }),
      )

      expect(
        await screen.findByText(
          'Les bilans n’ont pas pu être générés. Réessaie.',
        ),
      ).toBeInTheDocument()
      expect(consoleError).toHaveBeenCalled()
      expect(downloadBlobMock).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })
})
