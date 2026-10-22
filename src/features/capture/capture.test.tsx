/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { getCaptureDraft, saveCaptureDraft } from '@/db/drafts'
import { ensureSeed } from '@/db/seed'
import { ImageDecodeError } from '@/domain/errors'
import type { CaptureDraft, CompressedPhoto, Section } from '@/domain/types'
import { compressImage } from '@/lib/image'
import { makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'

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

async function addStudent(firstName: string, section: Section) {
  const student = makeStudent({ firstName, section })
  await db.students.add(student)
  return student
}

function makeDraft(studentId: string, withPhoto: boolean): CaptureDraft {
  const draft: CaptureDraft = {
    id: 'current',
    studentId,
    createdAt: '2026-11-01T10:00:00.000Z',
  }

  if (withPhoto) {
    draft.full = nodeBlob('photo-pleine')
    draft.thumb = nodeBlob('vignette')
    draft.width = 1200
    draft.height = 900
  }

  return draft
}

async function seedDraft(studentId: string, withPhoto = true): Promise<CaptureDraft> {
  const draft = makeDraft(studentId, withPhoto)
  await saveCaptureDraft(draft)
  return draft
}

function photoInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Aucun input fichier dans l’écran photo.')
  }
  return input
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

beforeEach(() => {
  compressImageMock.mockReset()
})

describe('StudentPickerScreen', () => {
  it('enregistre le brouillon et ouvre l’écran photo quand on choisit un élève', async () => {
    await ensureSeed()
    const lea = await addStudent('Léa', 'PS')
    await addStudent('Adam', 'MS')
    const user = userEvent.setup()

    const { router } = renderApp({ route: '/capture' })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeInTheDocument()

    expect(
      await screen.findByRole('button', { name: 'Léa, section PS' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toute' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Adam, section MS' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Léa, section PS' }))

    await waitFor(async () => {
      const draft = await getCaptureDraft()
      expect(draft?.id).toBe('current')
      expect(draft?.studentId).toBe(lea.id)
      expect(draft?.createdAt).toEqual(expect.any(String))
      expect(draft).not.toHaveProperty('full')
    })

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/capture/${lea.id}/photo`),
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nouvelle réussite' }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Élève Léa, section PS' }),
    ).toBeInTheDocument()
  })

  it('filtre les élèves par section et par recherche', async () => {
    const lea = await addStudent('Léa', 'PS')
    await addStudent('Adam', 'MS')
    const user = userEvent.setup()

    renderApp({ route: '/capture' })

    expect(
      await screen.findByRole('button', { name: 'Léa, section PS' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'PS' }))

    expect(screen.getByRole('button', { name: 'PS' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Léa, section PS' })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Adam, section MS' }),
      ).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'Toute' }))
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un élève' }), 'lé')

    expect(screen.getByRole('button', { name: 'Léa, section PS' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Adam, section MS' }),
    ).not.toBeInTheDocument()
    expect(await db.students.get(lea.id)).toEqual(lea)
  })

  it('conserve la photo quand on resélectionne le même élève', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    renderApp({ route: '/capture' })

    await user.click(
      await screen.findByRole('button', { name: 'Léa, section MS' }),
    )

    await waitFor(async () => {
      const draft = await getCaptureDraft()
      expect(draft?.studentId).toBe(lea.id)
      expect(draft?.full).toBeDefined()
      expect(draft?.thumb).toBeDefined()
      expect(draft?.width).toBe(1200)
      expect(draft?.height).toBe(900)
    })

    expect(
      await screen.findByRole('img', { name: 'Photo de réussite de Léa' }),
    ).toBeInTheDocument()
  })

  it('repart sans photo quand on choisit un autre élève', async () => {
    const lea = await addStudent('Léa', 'MS')
    const adam = await addStudent('Adam', 'PS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    renderApp({ route: '/capture' })

    await user.click(await screen.findByRole('button', { name: 'Adam, section PS' }))

    await waitFor(async () => {
      const draft = await getCaptureDraft()
      expect(draft?.studentId).toBe(adam.id)
      expect(draft).not.toHaveProperty('full')
      expect(draft).not.toHaveProperty('thumb')
      expect(draft).not.toHaveProperty('width')
      expect(draft).not.toHaveProperty('height')
    })
  })

  it('affiche l’état vide avec un lien vers la gestion des élèves', async () => {
    await ensureSeed()

    renderApp({ route: '/capture' })

    expect(await screen.findByText(/Aucun élève dans la classe/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ajouter un élève/ })).toHaveAttribute(
      'href',
      '/students',
    )
  })
})

describe('PhotoScreen', () => {
  it('compresse le fichier choisi et le stocke dans le brouillon', async () => {
    const lea = await addStudent('Léa', 'PS')
    await seedDraft(lea.id, false)
    compressImageMock.mockResolvedValue(makeCompressedPhoto('atelier'))

    renderApp({ route: `/capture/${lea.id}/photo` })

    expect(
      await screen.findByRole('button', { name: 'Prendre la photo' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Prête à photographier')).toBeInTheDocument()
    expect(screen.getByText('Valider sans photo')).toBeInTheDocument()

    const input = photoInput()
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('capture', 'environment')

    const file = new File(['source'], 'atelier.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(async () => {
      const draft = await getCaptureDraft()
      expect(draft?.studentId).toBe(lea.id)
      expect(draft?.full).toBeDefined()
      expect(draft?.thumb).toBeDefined()
      expect(draft?.width).toBe(1600)
      expect(draft?.height).toBe(1200)
      expect(draft?.full?.type).toBe('image/jpeg')
    })

    expect(compressImageMock).toHaveBeenCalledWith(file)
    const preview = await screen.findByRole('img', {
      name: 'Photo de réussite de Léa',
    })
    await waitFor(() => expect(preview).toHaveAttribute('src', 'blob:test'))
    expect(screen.getByText('Photo prise à l’instant')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Choisir l’objectif/ }),
    ).toBeInTheDocument()
  })

  it('affiche un état occupé pendant la compression', async () => {
    const lea = await addStudent('Léa', 'PS')
    await seedDraft(lea.id, false)

    let finishCompression: (photo: CompressedPhoto) => void = () => {}
    compressImageMock.mockImplementation(
      () =>
        new Promise<CompressedPhoto>((resolve) => {
          finishCompression = resolve
        }),
    )

    renderApp({ route: `/capture/${lea.id}/photo` })

    await screen.findByRole('button', { name: 'Prendre la photo' })
    fireEvent.change(photoInput(), {
      target: { files: [new File(['source'], 'atelier.jpg', { type: 'image/jpeg' })] },
    })

    expect(
      await screen.findByRole('button', { name: 'Préparation…' }),
    ).toBeDisabled()

    finishCompression(makeCompressedPhoto('atelier'))

    await waitFor(async () =>
      expect((await getCaptureDraft())?.full).toBeDefined(),
    )
    expect(
      await screen.findByRole('button', { name: /Choisir l’objectif/ }),
    ).toBeEnabled()
  })

  it('affiche un toast français quand la photo ne peut pas être lue', async () => {
    const lea = await addStudent('Léa', 'PS')
    await seedDraft(lea.id, false)
    compressImageMock.mockRejectedValue(new ImageDecodeError())

    renderApp({ route: `/capture/${lea.id}/photo` })
    await screen.findByRole('button', { name: 'Prendre la photo' })

    fireEvent.change(photoInput(), {
      target: { files: [new File(['source'], 'photo.heic', { type: 'image/heic' })] },
    })

    expect(
      await screen.findByText(
        "Cette image n'a pas pu être lue. Reformatez-la en JPEG ou reprenez la photo.",
      ),
    ).toBeInTheDocument()

    const draft = await getCaptureDraft()
    expect(draft).not.toHaveProperty('full')
    expect(
      await screen.findByRole('button', { name: 'Prendre la photo' }),
    ).toBeEnabled()
  })

  it('« Valider sans photo » efface les blobs et garde l’élève', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    const { router } = renderApp({ route: `/capture/${lea.id}/photo` })

    expect(
      await screen.findByRole('img', { name: 'Photo de réussite de Léa' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Valider sans photo' }))

    await waitFor(async () => {
      const draft = await getCaptureDraft()
      expect(draft?.studentId).toBe(lea.id)
      expect(draft).not.toHaveProperty('full')
      expect(draft).not.toHaveProperty('thumb')
      expect(draft).not.toHaveProperty('width')
      expect(draft).not.toHaveProperty('height')
    })

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/capture/objective'),
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choisir un objectif' }),
    ).toBeInTheDocument()
  })

  it('garde le brouillon quand l’écran photo est démonté puis remonté', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)

    const first = renderApp({ route: `/capture/${lea.id}/photo` })

    expect(
      await screen.findByRole('img', { name: 'Photo de réussite de Léa' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
    first.unmount()
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled())

    renderApp({ route: `/capture/${lea.id}/photo` })

    expect(
      await screen.findByRole('img', { name: 'Photo de réussite de Léa' }),
    ).toBeInTheDocument()

    const draft = await getCaptureDraft()
    expect(draft?.studentId).toBe(lea.id)
    expect(draft?.full).toBeDefined()
    expect(draft?.thumb).toBeDefined()
  })

  it('redirige vers /capture quand aucun brouillon n’existe', async () => {
    const lea = await addStudent('Léa', 'MS')

    const { router } = renderApp({ route: `/capture/${lea.id}/photo` })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/capture')
  })

  it('redirige quand le brouillon appartient à un autre élève', async () => {
    const lea = await addStudent('Léa', 'MS')
    const adam = await addStudent('Adam', 'PS')
    await seedDraft(lea.id)

    const { router } = renderApp({ route: `/capture/${adam.id}/photo` })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/capture')
  })

  it('redirige quand l’élève du brouillon n’existe plus', async () => {
    await seedDraft('student-disparu', false)

    const { router } = renderApp({
      route: '/capture/student-disparu/photo',
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/capture')
  })

  it('redirige si le brouillon vivant passe à un autre élève', async () => {
    const lea = await addStudent('Léa', 'MS')
    const adam = await addStudent('Adam', 'PS')
    await seedDraft(lea.id)

    const { router } = renderApp({ route: `/capture/${lea.id}/photo` })

    expect(
      await screen.findByRole('img', { name: 'Photo de réussite de Léa' }),
    ).toBeInTheDocument()

    // Simule un autre onglet qui réécrit le brouillon courant.
    await saveCaptureDraft(makeDraft(adam.id, true))

    await waitFor(() => expect(router.state.location.pathname).toBe('/capture'))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeInTheDocument()
  })

  it('affiche un message de stockage quand l’enregistrement échoue', async () => {
    const lea = await addStudent('Léa', 'PS')
    await seedDraft(lea.id, false)
    compressImageMock.mockResolvedValue(makeCompressedPhoto('atelier'))

    const putSpy = vi
      .spyOn(db.drafts, 'put')
      .mockRejectedValue(new Error('QuotaExceededError'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      renderApp({ route: `/capture/${lea.id}/photo` })
      await screen.findByRole('button', { name: 'Prendre la photo' })

      fireEvent.change(photoInput(), {
        target: {
          files: [new File(['source'], 'atelier.jpg', { type: 'image/jpeg' })],
        },
      })

      expect(
        await screen.findByText(
          'Le brouillon n’a pas pu être enregistré. Réessaie.',
        ),
      ).toBeInTheDocument()
      expect(putSpy).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()
    } finally {
      putSpy.mockRestore()
      consoleSpy.mockRestore()
    }

    expect(await getCaptureDraft()).not.toHaveProperty('full')
  })

  it('affiche la photo, le rappel élève et les actions de reprise', async () => {
    const lea = await addStudent('Léa', 'GS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    renderApp({ route: `/capture/${lea.id}/photo` })

    expect(
      await screen.findByRole('group', { name: 'Élève Léa, section GS' }),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByText('2 / 3')).toBeInTheDocument()
    expect(
      await screen.findByRole('img', { name: 'Photo de réussite de Léa' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Photo prise')).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Choisir l’objectif/ }),
    ).toBeInTheDocument()

    const retake = screen.getByRole('button', { name: 'Reprendre' })
    const clickSpy = vi.spyOn(photoInput(), 'click')
    await user.click(retake)
    expect(clickSpy).toHaveBeenCalled()
  })

  it('« Choisir l’objectif » ouvre l’étape 3', async () => {
    const lea = await addStudent('Léa', 'GS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    const { router } = renderApp({ route: `/capture/${lea.id}/photo` })

    await user.click(
      await screen.findByRole('button', { name: /Choisir l’objectif/ }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/capture/objective'),
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choisir un objectif' }),
    ).toBeInTheDocument()
  })
})
