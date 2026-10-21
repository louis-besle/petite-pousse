/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type {
  CompressedPhoto,
  Objective,
  Section,
  Student,
} from '@/domain/types'
import { makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { ToastProvider } from '@/ui/ToastProvider'

/** Objectif du référentiel réel, pour semer des validations crédibles. */
function objectiveAt(index: number): Objective {
  const objective = referential.objectives[index]
  if (!objective) {
    throw new Error(`Référentiel de test incomplet : pas d'objectif à l'index ${index}.`)
  }
  return objective
}

/**
 * Le `Blob` de jsdom est perdu par le clone structuré de fake-indexeddb ;
 * celui de Node survit et permet de vérifier les données relues.
 */
function nodeBlob(content: string): Blob {
  return new NodeBlob([content], { type: 'image/jpeg' }) as unknown as Blob
}

function makeCompressedPhoto(label: string): CompressedPhoto {
  return {
    full: nodeBlob(`${label}-pleine`),
    thumb: nodeBlob(`${label}-vignette`),
    width: 1600,
    height: 1200,
    mime: 'image/jpeg',
  }
}

async function addStudent(
  firstName: string,
  section: Section,
  overrides: Partial<Student> = {},
): Promise<Student> {
  const student = makeStudent({ firstName, section, ...overrides })
  await db.students.add(student)
  return student
}

async function addValidation(
  studentId: string,
  objectiveIndex: number,
  date: string,
  options: { photo?: boolean } = {},
) {
  return createValidation({
    studentId,
    objective: objectiveAt(objectiveIndex),
    ageBand: 'from4',
    date,
    referentialVersion: REFERENTIAL_VERSION,
    ...(options.photo === true ? { photo: makeCompressedPhoto('atelier') } : {}),
  })
}

describe('ManageStudentsScreen', () => {
  it('ajoute un élève en PS avec zéro réussite', async () => {
    await ensureSeed()
    const user = userEvent.setup()

    renderApp({ route: '/students' })

    await user.click(await screen.findByRole('button', { name: 'Ajouter un élève' }))
    await user.type(screen.getByLabelText('Prénom'), 'Noah')
    await user.click(screen.getByRole('button', { name: 'PS' }))
    await user.click(screen.getByRole('button', { name: 'Ajouter l’élève' }))

    const row = await screen.findByRole('button', { name: 'Modifier Noah' })
    expect(within(row).getByText('0 réussite')).toBeInTheDocument()

    await waitFor(async () => {
      const stored = await db.students.toArray()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ firstName: 'Noah', section: 'PS' })
    })

    expect(screen.getByText(/Élève ajouté/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('modifie le prénom, la section et efface l’initiale du nom', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'MS', { lastNameInitial: 'M' })
    await addValidation(lea.id, 0, '2026-10-12')
    await addValidation(lea.id, 1, '2026-10-13')
    const user = userEvent.setup()

    renderApp({ route: '/students' })

    await user.click(await screen.findByRole('button', { name: 'Modifier Léa' }))

    expect(
      screen.getByRole('heading', { level: 2, name: 'Modifier Léa' }),
    ).toBeInTheDocument()

    const firstName = screen.getByLabelText('Prénom')
    await user.clear(firstName)
    await user.type(firstName, 'Léa-Marie')
    await user.clear(screen.getByLabelText('Initiale du nom (facultative)'))
    await user.click(screen.getByRole('button', { name: 'GS' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByRole('button', { name: 'Modifier Léa-Marie' })
    expect(
      screen.queryByRole('button', { name: 'Modifier Léa' }),
    ).not.toBeInTheDocument()

    await waitFor(async () => {
      const stored = await db.students.get(lea.id)
      expect(stored).toMatchObject({ firstName: 'Léa-Marie', section: 'GS' })
      expect(stored).not.toHaveProperty('lastNameInitial')
    })

    expect(screen.getByText(/Modifications enregistrées/)).toBeInTheDocument()
  })

  it('confirme la suppression avec les comptes de toutes les années, puis supprime en cascade', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'MS')
    const adam = await addStudent('Adam', 'PS')
    // Une réussite par année : seule la somme des deux prouve le comptage global.
    await addValidation(lea.id, 0, '2025-10-12', { photo: true })
    await addValidation(lea.id, 1, '2026-10-12')
    await addValidation(adam.id, 2, '2026-10-12')
    const user = userEvent.setup()

    const { router } = renderApp({ route: '/students' })
    await user.click(await screen.findByRole('button', { name: 'Supprimer Léa' }))

    const dialog = screen.getByRole('dialog', { name: 'Supprimer Léa ?' })
    expect(within(dialog).getByText(/2 réussites/)).toBeInTheDocument()
    expect(within(dialog).getByText(/1 photo/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await db.students.get(lea.id)).toBeDefined()
    expect(await db.validations.where('studentId').equals(lea.id).count()).toBe(2)
    expect(await db.photos.count()).toBe(1)
    expect(router.state.location.pathname).toBe('/students')

    await user.click(screen.getByRole('button', { name: 'Supprimer Léa' }))
    await user.click(
      screen.getByRole('button', { name: 'Supprimer définitivement' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Modifier Léa' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Modifier Adam' })).toBeInTheDocument()

    await waitFor(async () => {
      expect(await db.students.get(lea.id)).toBeUndefined()
      expect(await db.validations.where('studentId').equals(lea.id).count()).toBe(0)
      expect(await db.photos.count()).toBe(0)
    })
    expect(await db.students.get(adam.id)).toBeDefined()
    expect(await db.validations.where('studentId').equals(adam.id).count()).toBe(1)
    expect(screen.getByText(/Élève supprimé/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/students')
  })

  it('revient à /students quand l’élève supprimé est celui de la route courante', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 0, '2026-10-12')
    const user = userEvent.setup()

    // Routeur ciblé : la route `/students/:studentId` de l'application réelle
    // ouvre le dossier. Ici, on monte l'écran de gestion sur les deux routes
    // pour exercer le repli sans ajouter d'écran à la table de routes.
    const { ManageStudentsScreen } = await import('./ManageStudentsScreen')
    const router = createMemoryRouter(
      [
        { path: '/students', element: <ManageStudentsScreen /> },
        { path: '/students/:studentId', element: <ManageStudentsScreen /> },
      ],
      { initialEntries: [`/students/${lea.id}`] },
    )
    render(
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Supprimer Léa' }))
    await user.click(
      screen.getByRole('button', { name: 'Supprimer définitivement' }),
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/students'))
    expect(screen.queryByRole('button', { name: 'Modifier Léa' })).not.toBeInTheDocument()
    expect(await db.students.get(lea.id)).toBeUndefined()
  })

  it('affiche l’état vide avec le compte de zéro élève', async () => {
    await ensureSeed()

    renderApp({ route: '/students' })

    expect(await screen.findByText(/Aucun élève/)).toBeInTheDocument()
    expect(screen.getByText('0 élève')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ajouter le premier élève' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Gérer les élèves' }),
    ).toBeInTheDocument()
  })
})
