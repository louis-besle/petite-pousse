import { act, renderHook, screen } from '@testing-library/react'
import { createElement, type ChangeEvent, type ReactNode } from 'react'
import { ImageDecodeError } from '@/domain/errors'
import type { CompressedPhoto } from '@/domain/types'
import { compressImage } from '@/lib/image'
import { ToastProvider } from '@/ui/ToastProvider'
import { usePhotoFileInput, type PhotoFileInput } from './usePhotoFileInput'

vi.mock('@/lib/image', () => ({ compressImage: vi.fn() }))

const compressImageMock = vi.mocked(compressImage)

const PHOTO: CompressedPhoto = {
  full: new Blob(['pleine'], { type: 'image/jpeg' }),
  thumb: new Blob(['vignette'], { type: 'image/jpeg' }),
  width: 800,
  height: 600,
  mime: 'image/jpeg',
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(ToastProvider, null, children)
}

/** Événement minimal : `handleChange` ne lit que `currentTarget`. */
function changeEventFor(file: File): ChangeEvent<HTMLInputElement> {
  const input = document.createElement('input')
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  return { currentTarget: input } as unknown as ChangeEvent<HTMLInputElement>
}

function renderPhotoInput(onPhoto: (photo: CompressedPhoto) => Promise<void>) {
  return renderHook(
    () =>
      usePhotoFileInput({
        onPhoto,
        preparationError: 'Préparation impossible.',
        saveError: 'Enregistrement impossible.',
      }),
    { wrapper },
  )
}

/**
 * Branche deux champs fichier sur les refs du hook, comme le fait l'écran de
 * capture : caméra et photothèque restent deux champs distincts.
 */
function attachInputs(result: { current: PhotoFileInput }) {
  const camera = document.createElement('input')
  const library = document.createElement('input')

  act(() => {
    result.current.inputRef.current = camera
    result.current.libraryInputRef.current = library
  })

  return { camera, library }
}

describe('usePhotoFileInput', () => {
  beforeEach(() => {
    compressImageMock.mockReset()
  })

  it('transmet la photo compressée puis retombe au repos', async () => {
    compressImageMock.mockResolvedValue(PHOTO)
    const onPhoto = vi.fn(async () => {})
    const { result } = renderPhotoInput(onPhoto)

    await act(async () => {
      await result.current.handleChange(changeEventFor(new File(['x'], 'x.jpg')))
    })

    expect(onPhoto).toHaveBeenCalledWith(PHOTO)
    expect(result.current.busy).toBe(false)
  })

  it('ouvre le champ caméra sans toucher à celui de la photothèque', () => {
    const { result } = renderPhotoInput(vi.fn(async () => {}))
    const { camera, library } = attachInputs(result)
    const cameraClick = vi.spyOn(camera, 'click')
    const libraryClick = vi.spyOn(library, 'click')

    act(() => {
      result.current.openPicker()
    })

    expect(cameraClick).toHaveBeenCalledTimes(1)
    expect(libraryClick).not.toHaveBeenCalled()
  })

  it('ouvre le champ photothèque sans toucher à celui de la caméra', () => {
    const { result } = renderPhotoInput(vi.fn(async () => {}))
    const { camera, library } = attachInputs(result)
    const cameraClick = vi.spyOn(camera, 'click')
    const libraryClick = vi.spyOn(library, 'click')

    act(() => {
      result.current.openLibrary()
    })

    expect(libraryClick).toHaveBeenCalledTimes(1)
    expect(cameraClick).not.toHaveBeenCalled()
  })

  it('avertit et n’enregistre rien quand le décodage échoue', async () => {
    compressImageMock.mockRejectedValue(new ImageDecodeError('Image illisible.'))
    const onPhoto = vi.fn(async () => {})
    const { result } = renderPhotoInput(onPhoto)

    await act(async () => {
      await result.current.handleChange(changeEventFor(new File(['x'], 'x.heic')))
    })

    expect(onPhoto).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Image illisible.')
    expect(result.current.busy).toBe(false)
  })
})
