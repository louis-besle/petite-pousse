import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective, Section } from '@/domain/types'
import { formatLongDate, todayIso } from '@/lib/date'
import { makeStudent } from '@/test/fixtures'
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
    expect(screen.getByRole('link', { name: /Gérer les élèves/ })).toHaveAttribute(
      'href',
      '/students',
    )
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
