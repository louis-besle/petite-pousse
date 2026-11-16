import { act, renderHook, screen } from '@testing-library/react'
import { createElement, type ChangeEvent, type ReactNode } from 'react'
import { ImageDecodeError } from '@/domain/errors'
import type { CompressedPhoto } from '@/domain/types'
import { compressImage } from '@/lib/image'
import { ToastProvider } from '@/ui/ToastProvider'
import { usePhotoFileInput } from './usePhotoFileInput'

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
