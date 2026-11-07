import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective, Section } from '@/domain/types'
import { formatLongDate, todayIso } from '@/lib/date'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'

/** Objectif du référentiel réel, pour semer des validations crédibles. */
function objectiveAt(index: number): Objective {
  const objective = referential.objectives[index]
  if (!objective) {
    throw new Error(`Référentiel de test incomplet : pas d'objectif à l'index ${index}.`)
  }
  return objective
}

async function addStudent(firstName: string, section: Section) {
  const student = makeStudent({ firstName, section })
  await db.students.add(student)
  return student
}

async function addValidation(studentId: string, objectiveIndex: number, date = '2026-10-12') {
  await createValidation({
    studentId,
    objective: objectiveAt(objectiveIndex),
    ageBand: 'from4',
    date,
    referentialVersion: REFERENTIAL_VERSION,
  })
}

describe('ClassScreen', () => {
  it('affiche les élèves et leur nombre de réussites de l’année', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'PS')
    const adam = await addStudent('Adam', 'MS')
    await addValidation(lea.id, 0)
    await addValidation(lea.id, 1)
    await addValidation(adam.id, 2)

    renderApp({ route: '/' })

    const leaCard = await screen.findByRole('link', { name: /Léa/ })
    await waitFor(() =>
      expect(within(leaCard).getByText('2 réussites')).toBeInTheDocument(),
    )

    const adamCard = await screen.findByRole('link', { name: /Adam/ })
    await waitFor(() =>
      expect(within(adamCard).getByText('1 réussite')).toBeInTheDocument(),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Bonjour, Maîtresse' }),
    ).toBeInTheDocument()
    expect(screen.getByText(new RegExp(formatLongDate(todayIso())))).toBeInTheDocument()
    expect(screen.getByText('2026-2027')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir le profil' })).toHaveAttribute(
      'href',
      '/settings',
    )
    // La gestion des élèves et les réglages ont quitté l'écran classe pour le
    // profil, accessible par la navigation basse.
    expect(
      screen.queryByRole('link', { name: /Gérer les élèves/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Réglages' }),
    ).not.toBeInTheDocument()
  })

  it('suit l’année de la date du jour quand les réglages sont en avance', async () => {
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
      const lea = await addStudent('Léa', 'MS')
      await addValidation(lea.id, 0, '2026-11-07')

      renderApp({ route: '/' })

      const card = await screen.findByRole('link', { name: /Léa/ })
      await waitFor(() =>
        expect(within(card).getByText('1 réussite')).toBeInTheDocument(),
      )
      expect(screen.getByText('2026-2027')).toBeInTheDocument()
      expect(screen.queryByText('2027-2028')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('filtre les élèves par section sans recharger la page', async () => {
    await ensureSeed()
    await addStudent('Léa', 'PS')
    await addStudent('Adam', 'MS')
    const user = userEvent.setup()

    renderApp({ route: '/' })
    expect(await screen.findByRole('link', { name: /Adam/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'PS' }))

    expect(screen.getByRole('button', { name: 'PS' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: /Léa/ })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Adam/ })).not.toBeInTheDocument(),
    )
  })

  it('affiche l’état vide et désactive le bouton photo quand la classe est vide', async () => {
    await ensureSeed()

    renderApp({ route: '/' })

    expect(await screen.findByText(/Aucun élève dans la classe/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prendre une photo/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Ajouter un élève/ })).toHaveAttribute(
      'href',
      '/students',
    )
  })

  it('salue l’enseignante par son nom quand il est renseigné', async () => {
    await ensureSeed()
    await updateSettings({ teacherName: 'Mme Martin' })

    renderApp({ route: '/' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bonjour, Mme Martin' }),
    ).toBeInTheDocument()
  })

  it('ne compte pas les réussites d’une année scolaire précédente', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 0, '2025-10-12')

    renderApp({ route: '/' })

    const card = await screen.findByRole('link', { name: /Léa/ })
    await waitFor(() =>
      expect(within(card).getByText('0 réussite')).toBeInTheDocument(),
    )
    expect(within(card).queryByText('1 réussite')).not.toBeInTheDocument()
  })

  it('rappelle de sauvegarder quand aucune sauvegarde n’a encore été faite', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 0)

    renderApp({ route: '/' })

    expect(await screen.findByRole('link', { name: /Sauvegarde conseillée/ })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('ne rappelle pas la sauvegarde quand elle est récente', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 0)
    await updateSettings({
      lastBackupAt: new Date().toISOString(),
      lastBackupValidationCount: 1,
    })

    renderApp({ route: '/' })
    await screen.findByRole('link', { name: /Léa/ })

    expect(
      screen.queryByRole('link', { name: /Sauvegarde conseillée/ }),
    ).not.toBeInTheDocument()
  })

  it('ouvre l’écran de capture depuis le bouton photo', async () => {
    await ensureSeed()
    await addStudent('Léa', 'MS')
    const user = userEvent.setup()

    renderApp({ route: '/' })

    const cta = await screen.findByRole('button', { name: /Prendre une photo/ })
    await waitFor(() => expect(cta).toBeEnabled())
    await user.click(cta)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeInTheDocument()
  })
})
