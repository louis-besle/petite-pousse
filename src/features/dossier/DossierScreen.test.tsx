/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { getCaptureDraft, saveCaptureDraft } from '@/db/drafts'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type {
  AgeBand,
  CompressedPhoto,
  Objective,
  Photo,
  Section,
} from '@/domain/types'
import { compressImage } from '@/lib/image'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'

// Seule la compression est simulée : `fitDimensions` reste réel dans les tests.
vi.mock('@/lib/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image')>()
  return { ...actual, compressImage: vi.fn() }
})

const compressImageMock = vi.mocked(compressImage)

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

function objective(id: string): Objective {
  const found = referential.objectives.find((candidate) => candidate.id === id)
  if (found === undefined) {
    throw new Error(`Objectif de test introuvable : ${id}`)
  }
  return found
}

const LANGAGE_1 = objective('lang-vocabulaire-01').label
const LANGAGE_2 = objective('lang-vocabulaire-02').label
const MATHS = objective('maths-nombres-05').label

const LANGAGE_1_NAME = /Comprendre, mémoriser/
const MATHS_NAME = /Comparer des quantités/

async function addStudent(firstName: string, section: Section) {
  const student = makeStudent({ firstName, section })
  await db.students.add(student)
  return student
}

async function addValidation(
  studentId: string,
  objectiveId: string,
  date: string,
  options: { ageBand?: AgeBand; photo?: boolean } = {},
) {
  return createValidation({
    studentId,
    objective: objective(objectiveId),
    ageBand: options.ageBand ?? 'from4',
    date,
    referentialVersion: REFERENTIAL_VERSION,
    ...(options.photo === true ? { photo: makeCompressedPhoto('atelier') } : {}),
  })
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Aucun input fichier dans la fiche de réussite.')
  }
  return input
}

beforeEach(async () => {
  await ensureSeed()
  compressImageMock.mockReset()
})

describe('DossierScreen', () => {
  it('regroupe les réussites par domaine pour l’année sélectionnée', async () => {
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')
    await addValidation(lea.id, 'lang-vocabulaire-02', '2026-09-20', {
      ageBand: 'from5',
    })
    await addValidation(lea.id, 'maths-nombres-05', '2026-10-02')
    await addValidation(lea.id, 'lang-vocabulaire-03', '2025-10-12')

    const user = userEvent.setup()
    const { router } = renderApp({ route: `/students/${lea.id}` })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Léa' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/students/${lea.id}`)
    expect(await screen.findByText(/MS · 3 réussites cette année/)).toBeInTheDocument()

    const summary = screen.getByRole('group', { name: 'Résumé du dossier' })
    expect(within(summary).getByText('3 réussites')).toBeInTheDocument()
    expect(within(summary).getByText('Langage 2')).toBeInTheDocument()
    expect(within(summary).getByText('Maths 1')).toBeInTheDocument()

    const langage = screen.getByRole('region', { name: 'Langage' })
    expect(within(langage).getByText(LANGAGE_1)).toBeInTheDocument()
    expect(within(langage).getByText(LANGAGE_2)).toBeInTheDocument()
    // La réussite d'une autre tranche d'âge porte son étiquette.
    expect(within(langage).getByText('À partir de 5 ans')).toBeInTheDocument()
    // Tri par date décroissante : la plus récente d'abord.
    const rows = within(langage).getAllByRole('button')
    expect(rows[0]).toHaveTextContent(LANGAGE_1)

    // L'année précédente n'est pas affichée par défaut.
    expect(screen.queryByText(objective('lang-vocabulaire-03').label)).not.toBeInTheDocument()

    const mathsToggle = screen.getByRole('button', { name: /^Maths/ })
    expect(mathsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(MATHS)).not.toBeInTheDocument()

    await user.click(mathsToggle)

    expect(mathsToggle).toHaveAttribute('aria-expanded', 'true')
    const maths = screen.getByRole('region', { name: 'Maths' })
    expect(within(maths).getByText(MATHS)).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Bilan' })).toHaveAttribute(
      'href',
      `/bilans/${lea.id}?period=1&year=2026-2027`,
    )
  })

  it('affiche une réussite du jour quand l’année des réglages est en avance', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-07T12:00:00'))

    try {
      // L'amorçage du test a tourné à l'heure réelle : on le rejoue à la date
      // simulée pour garantir la présence de l'année 2026-2027.
      await ensureSeed()
      const lea = await addStudent('Léa', 'MS')
      await db.schoolYears.put(
        makeSchoolYear({
          id: '2027-2028',
          start: '2027-09-01',
          period1End: '2028-01-31',
          period2End: '2028-06-30',
        }),
      )
      await updateSettings({ currentSchoolYearId: '2027-2028' })
      await addValidation(lea.id, 'lang-vocabulaire-01', '2026-11-07')

      renderApp({ route: `/students/${lea.id}` })

      expect(await screen.findByText(LANGAGE_1)).toBeInTheDocument()
      expect(await screen.findByText(/1 réussite cette année/)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Année scolaire' })).toHaveValue(
        '2026-2027',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('change d’année sans supprimer les réussites', async () => {
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')
    await addValidation(lea.id, 'lang-vocabulaire-02', '2025-10-12')

    const user = userEvent.setup()
    renderApp({ route: `/students/${lea.id}` })

    expect(await screen.findByText(LANGAGE_1)).toBeInTheDocument()
    expect(screen.queryByText(LANGAGE_2)).not.toBeInTheDocument()

    const yearSelect = screen.getByRole('combobox', { name: 'Année scolaire' })
    await user.selectOptions(yearSelect, '2025-2026')

    await waitFor(() => expect(screen.getByText(LANGAGE_2)).toBeInTheDocument())
    expect(screen.queryByText(LANGAGE_1)).not.toBeInTheDocument()
    expect(screen.getByText(/1 réussite en 2025-2026/)).toBeInTheDocument()
    expect(await db.validations.count()).toBe(2)

    await user.selectOptions(yearSelect, 'all')

    await waitFor(() => expect(screen.getByText(LANGAGE_1)).toBeInTheDocument())
    expect(screen.getByText(LANGAGE_2)).toBeInTheDocument()
    expect(screen.getByText(/2 réussites toutes les années/)).toBeInTheDocument()
    expect(await db.validations.count()).toBe(2)
  })

  it('affiche « Observation en classe » et « sans photo » pour une réussite sans photo', async () => {
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')

    renderApp({ route: `/students/${lea.id}` })

    const row = await screen.findByRole('button', { name: LANGAGE_1_NAME })

    expect(within(row).getByText('Observation en classe')).toBeInTheDocument()
    expect(within(row).getByText('sans photo')).toBeInTheDocument()
    expect(within(row).queryByRole('img')).not.toBeInTheDocument()
  })

  it('retire une réussite après confirmation, avec sa photo', async () => {
    const lea = await addStudent('Léa', 'MS')
    await addValidation(lea.id, 'maths-nombres-05', '2026-10-12', { photo: true })
    expect(await db.photos.count()).toBe(1)

    const user = userEvent.setup()
    renderApp({ route: `/students/${lea.id}` })

    await user.click(await screen.findByRole('button', { name: MATHS_NAME }))

    expect(await screen.findByRole('heading', { name: MATHS })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retirer cette réussite' }))

    expect(
      screen.getByRole('heading', { name: 'Retirer cette réussite ?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/et sa photo seront retirées/)).toBeInTheDocument()
    // Rien n'est supprimé avant la confirmation.
    expect(await db.validations.count()).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Retirer définitivement' }))

    await waitFor(async () => expect(await db.validations.count()).toBe(0))
    await waitFor(async () => expect(await db.photos.count()).toBe(0))
    expect(await screen.findByText('La réussite a été retirée.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(MATHS)).not.toBeInTheDocument())
    // Les deux feuilles empilées sont démontées : le corps doit défiler à nouveau.
    await waitFor(() => expect(document.body.style.overflow).toBe(''))
  })

  it('modifie la date et reclasse la réussite dans son année scolaire', async () => {
    const lea = await addStudent('Léa', 'MS')
    const validation = await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')

    const user = userEvent.setup()
    renderApp({ route: `/students/${lea.id}` })

    await user.click(await screen.findByRole('button', { name: LANGAGE_1_NAME }))

    const dateInput = await screen.findByLabelText('Date de la réussite')
    expect(dateInput).toHaveValue('2026-10-12')

    fireEvent.change(dateInput, { target: { value: '2025-09-20' } })

    await waitFor(async () => {
      const stored = await db.validations.get(validation.id)
      expect(stored?.date).toBe('2025-09-20')
      expect(stored?.schoolYearId).toBe('2025-2026')
    })
    expect(await screen.findByText('Date mise à jour.')).toBeInTheDocument()
  })

  it('ajoute une photo à une réussite qui n’en avait pas', async () => {
    compressImageMock.mockResolvedValue(makeCompressedPhoto('atelier'))

    const lea = await addStudent('Léa', 'MS')
    const validation = await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')

    const user = userEvent.setup()
    renderApp({ route: `/students/${lea.id}` })

    const row = await screen.findByRole('button', { name: LANGAGE_1_NAME })
    expect(within(row).getByText('sans photo')).toBeInTheDocument()

    await user.click(row)
    await user.click(await screen.findByRole('button', { name: 'Ajouter une photo' }))

    const input = fileInput()
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('capture', 'environment')

    const file = new File(['source'], 'atelier.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(async () => {
      const stored = await db.validations.get(validation.id)
      expect(stored?.photoId).toBeDefined()
    })
    expect(compressImageMock).toHaveBeenCalledWith(file)
    expect(await db.photos.count()).toBe(1)
    await waitFor(() => expect(input.value).toBe(''))

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    const updatedRow = await screen.findByRole('button', { name: LANGAGE_1_NAME })
    expect(within(updatedRow).queryByText('sans photo')).not.toBeInTheDocument()
    expect(
      within(updatedRow).getByRole('img', { name: /Photo de la réussite/ }),
    ).toBeInTheDocument()
  })

  it('affiche un chargement neutre pendant la lecture de la photo', async () => {
    const lea = await addStudent('Léa', 'MS')
    const validation = await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12', {
      photo: true,
    })
    const photo =
      validation.photoId === undefined ? undefined : await db.photos.get(validation.photoId)

    let releasePhoto!: (value: Photo | undefined) => void
    const pendingPhoto = new Promise<Photo | undefined>((resolve) => {
      releasePhoto = resolve
    })
    const getSpy = vi
      .spyOn(db.photos, 'get')
      .mockReturnValue(
        pendingPhoto as unknown as ReturnType<typeof db.photos.get>,
      )
    const user = userEvent.setup()

    try {
      renderApp({ route: `/students/${lea.id}` })

      await user.click(await screen.findByRole('button', { name: LANGAGE_1_NAME }))

      const sheet = await screen.findByRole('dialog')
      expect(within(sheet).getByText('Chargement de la photo…')).toBeInTheDocument()
      expect(within(sheet).queryByText('Observation en classe')).not.toBeInTheDocument()

      releasePhoto(photo)

      expect(
        await within(sheet).findByRole('img', { name: /Photo de la réussite/ }),
      ).toBeInTheDocument()
    } finally {
      getSpy.mockRestore()
    }
  })

  it('se rabat sur une année connue quand l’année sélectionnée disparaît', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-07T12:00:00'))

    try {
      await ensureSeed()
      const lea = await addStudent('Léa', 'MS')
      // L'année des réglages est en avance : elle reste proposée, mais le
      // défaut suit l'année qui contient la date du jour.
      await updateSettings({ currentSchoolYearId: '2030-2031' })

      const user = userEvent.setup()
      renderApp({ route: `/students/${lea.id}` })

      const yearSelect = await screen.findByRole('combobox', { name: 'Année scolaire' })
      await waitFor(() => expect(yearSelect).toHaveValue('2026-2027'))
      expect(screen.getByRole('option', { name: '2030-2031' })).toBeInTheDocument()

      await user.selectOptions(yearSelect, '2030-2031')
      await waitFor(() => expect(yearSelect).toHaveValue('2030-2031'))

      await db.schoolYears.delete('2030-2031')

      await waitFor(() => expect(yearSelect).toHaveValue('2026-2027'))
      expect(screen.queryByRole('option', { name: '2030-2031' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('affiche l’instantané quand l’objectif a disparu du référentiel', async () => {
    const lea = await addStudent('Léa', 'MS')
    const validation = await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')
    await db.validations.update(validation.id, { objectiveId: 'objectif-retire' })

    const user = userEvent.setup()
    renderApp({ route: `/students/${lea.id}` })

    expect(await screen.findByText(LANGAGE_1)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: LANGAGE_1_NAME }))

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText(LANGAGE_1)).toBeInTheDocument()
    expect(
      within(sheet).getByText('Langage · À partir de 4 ans'),
    ).toBeInTheDocument()
    expect(within(sheet).getByText('Exemple de réussite')).toBeInTheDocument()
    expect(
      within(sheet).getByText(objective('lang-vocabulaire-01').examples.from4 ?? ''),
    ).toBeInTheDocument()
  })

  it('affiche un message clair quand l’élève est introuvable', async () => {
    renderApp({ route: '/students/eleve-disparu' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Élève introuvable' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Retour à la classe/ })).toHaveAttribute(
      'href',
      '/',
    )
  })
})

describe('DossierScreen : capture', () => {
  it('ouvre la photo avec un brouillon neuf pour l’élève du dossier', async () => {
    const lea = await addStudent('Léa', 'MS')
    const other = await addStudent('Adam', 'PS')
    await saveCaptureDraft({
      id: 'current',
      studentId: other.id,
      createdAt: '2026-10-01T08:00:00.000Z',
      ...makeCompressedPhoto('ancien'),
    })

    const user = userEvent.setup()
    const { router } = renderApp({ route: `/students/${lea.id}` })

    await user.click(await screen.findByRole('button', { name: 'Prendre une photo' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/capture/${lea.id}/photo`),
    )
    const draft = await getCaptureDraft()
    expect(draft?.studentId).toBe(lea.id)
    expect(draft?.full).toBeUndefined()
    expect(draft?.thumb).toBeUndefined()
  })

  it('ouvre l’objectif avec un brouillon neuf sans photo', async () => {
    const lea = await addStudent('Léa', 'MS')
    const other = await addStudent('Adam', 'PS')
    await saveCaptureDraft({
      id: 'current',
      studentId: other.id,
      createdAt: '2026-10-01T08:00:00.000Z',
      ...makeCompressedPhoto('ancien'),
    })

    const user = userEvent.setup()
    const { router } = renderApp({ route: `/students/${lea.id}` })

    await user.click(
      await screen.findByRole('button', { name: /Ajouter une réussite sans photo/ }),
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/capture/objective'))
    // Attend que l'écran objectif ait fini sa lecture live avant la fermeture de la base.
    expect(
      await screen.findByRole('heading', { level: 1, name: "Choisir l'objectif" }),
    ).toBeInTheDocument()
    const draft = await getCaptureDraft()
    expect(draft?.studentId).toBe(lea.id)
    expect(draft?.full).toBeUndefined()
    expect(draft?.thumb).toBeUndefined()
  })
})
