import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective, SchoolYear, Section } from '@/domain/types'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'

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
    await setUpYear({
      id: '2025-2026',
      start: '2025-09-01',
      period1End: '2026-01-31',
      period2End: '2026-06-30',
    })
    await setUpYear()

    renderApp({ route: '/bilans' })
    await screen.findByRole('button', { name: /^Bilan 1/ })

    // Les réglages pointent encore vers 2026-2027, mais la ligne a disparu :
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
  })
})
