import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, sharePdf } from './share'

const FILENAME = 'bilan-lea-1-2026-2027.pdf'
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46])

function defineNavigatorMethod(name: 'canShare' | 'share', value: unknown): void {
  Object.defineProperty(navigator, name, {
    configurable: true,
    value,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  defineNavigatorMethod('canShare', undefined)
  defineNavigatorMethod('share', undefined)
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  defineNavigatorMethod('canShare', undefined)
  defineNavigatorMethod('share', undefined)
})

describe('sharePdf', () => {
  it('partage un vrai fichier PDF quand le partage natif est disponible', async () => {
    const canShare = vi.fn(() => true)
    const share = vi.fn((data: ShareData): Promise<void> => {
      void data
      return Promise.resolve()
    })
    defineNavigatorMethod('canShare', canShare)
    defineNavigatorMethod('share', share)

    const result = await sharePdf(PDF_BYTES, FILENAME)

    expect(result).toBe('shared')
    expect(canShare).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledTimes(1)

    const shareData = share.mock.calls[0]?.[0]
    expect(shareData?.title).toBe(FILENAME)
    expect(shareData?.files).toHaveLength(1)

    const file = shareData?.files?.[0]
    expect(file).toBeInstanceOf(File)
    expect(file?.name).toBe(FILENAME)
    expect(file?.type).toBe('application/pdf')
  })

  it('télécharge le PDF quand le partage natif n’est pas disponible', async () => {
    const share = vi.fn()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    defineNavigatorMethod('canShare', vi.fn(() => false))
    defineNavigatorMethod('share', share)

    const result = await sharePdf(PDF_BYTES, FILENAME)

    expect(result).toBe('downloaded')
    expect(share).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    // La révocation est différée : iOS Safari annule le téléchargement si
    // l'URL d'objet disparaît dans la même tâche que le clic.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('laisse remonter une annulation utilisateur sans télécharger', async () => {
    const abort = Object.assign(new Error('Partage annulé'), {
      name: 'AbortError',
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    defineNavigatorMethod('canShare', vi.fn(() => true))
    defineNavigatorMethod('share', vi.fn(() => Promise.reject(abort)))

    await expect(sharePdf(PDF_BYTES, FILENAME)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(click).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

describe('downloadBlob', () => {
  it('clique un lien temporaire, le retire puis révoque l’URL après le clic', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    downloadBlob(new Blob([PDF_BYTES], { type: 'application/pdf' }), FILENAME)

    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download]')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('reste utilisable quand revokeObjectURL n’existe pas', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const originalRevoke = URL.revokeObjectURL

    try {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: undefined,
      })

      expect(() =>
        downloadBlob(new Blob([PDF_BYTES], { type: 'application/pdf' }), FILENAME),
      ).not.toThrow()
      expect(click).toHaveBeenCalledTimes(1)
      expect(() => vi.runAllTimers()).not.toThrow()
    } finally {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevoke,
      })
    }
  })
})
