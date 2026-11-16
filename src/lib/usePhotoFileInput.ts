import { useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { ImageDecodeError } from '@/domain/errors'
import type { CompressedPhoto } from '@/domain/types'
import { compressImage } from '@/lib/image'
import { useToast } from '@/ui/useToast'

const DEFAULT_LOG_LABEL = 'Enregistrement de la photo impossible.'

export interface UsePhotoFileInputOptions {
  /** Traitement de la photo compressée (écriture en base, brouillon…). */
  onPhoto: (photo: CompressedPhoto) => Promise<void>
  /** Message si le décodage échoue autrement qu'avec un ImageDecodeError. */
  preparationError: string
  /** Message si `onPhoto` rejette. */
  saveError: string
  /** Libellé du console.error en cas d'échec d'enregistrement (défaut « Enregistrement de la photo impossible. »). */
  logLabel?: string
}

export interface PhotoFileInput {
  inputRef: RefObject<HTMLInputElement | null>
  openPicker: () => void
  busy: boolean
  handleChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
}

/**
 * Pipeline photo commun aux écrans qui prennent ou remplacent une photo :
 * compression, toast d'erreur et état occupé. L'écriture réelle est déléguée à
 * `onPhoto`, qui reçoit la photo compressée.
 *
 * Le champ fichier est vidé dès la lecture : reprendre exactement le même
 * fichier relance bien le traitement.
 */
export function usePhotoFileInput({
  onPhoto,
  preparationError,
  saveError,
  logLabel = DEFAULT_LOG_LABEL,
}: UsePhotoFileInputOptions): PhotoFileInput {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker(): void {
    inputRef.current?.click()
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Permet de reprendre exactement le même fichier juste après.
    input.value = ''

    if (file === undefined) return

    setBusy(true)
    try {
      let compressed: CompressedPhoto
      try {
        compressed = await compressImage(file)
      } catch (error) {
        showToast(error instanceof ImageDecodeError ? error.message : preparationError)
        return
      }

      try {
        await onPhoto(compressed)
      } catch (error) {
        console.error(logLabel, error)
        showToast(saveError)
      }
    } finally {
      setBusy(false)
    }
  }

  return { inputRef, openPicker, busy, handleChange }
}
