import { ImageDecodeError } from '@/domain/errors'
import type { CompressedPhoto } from '@/domain/types'

/** Taille maximale de l'image conservée pour le zoom et le PDF. */
const FULL_MAX = 1600
/** Taille maximale de la vignette affichée dans les listes. */
const THUMB_MAX = 400
/** Qualité JPEG : bon compromis lisibilité / poids pour une photo d'activité. */
const JPEG_QUALITY = 0.82

/**
 * Dimensions d'une image redimensionnée pour tenir dans un carré de `max`
 * pixels, en conservant le rapport d'aspect. Une image déjà assez petite est
 * rendue telle quelle. Toute dimension non strictement positive (ou non finie)
 * est refusée : elle traduit une image vide ou un appel erroné.
 */
export function fitDimensions(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(
      `Dimensions d'image invalides : ${String(width)}×${String(height)}. Largeur et hauteur doivent être strictement positives.`,
    )
  }
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error(`Taille maximale invalide : ${String(max)}. Elle doit être strictement positive.`)
  }

  if (width <= max && height <= max) {
    return { width, height }
  }

  const scale = max / Math.max(width, height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  /** Libère la mémoire du bitmap ; absent pour un `<img>`. */
  close?: () => void
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file)
  const image = new Image()

  try {
    image.src = url
    await image.decode()

    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (width <= 0 || height <= 0) throw new Error('Image vide')

    return { source: image, width, height }
  } catch {
    throw new ImageDecodeError()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Décode le fichier en respectant l'orientation EXIF. `createImageBitmap` est
 * la voie rapide ; le repli `<img>` couvre les navigateurs qui ne l'exposent
 * pas. Les erreurs de décodage (HEIC, fichier corrompu…) deviennent une
 * `ImageDecodeError` au message utilisateur.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => {
          bitmap.close()
        },
      }
    } catch {
      // Format non géré par le décodeur natif : on retente avec `<img>`.
    }
  }

  return decodeWithImageElement(file)
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error("Le navigateur n'a pas pu préparer l'image (canvas indisponible).")
  }

  context.drawImage(source, 0, 0, width, height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("L'image n'a pas pu être compressée. Réessayez avec une autre photo."))
        }
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

/**
 * Compresse une photo en JPEG pleine taille (max 1600 px) et en vignette
 * (max 400 px). Le ré-encodage supprime les métadonnées EXIF, dont la
 * géolocalisation. La taille retournée est celle de l'image pleine taille.
 */
export async function compressImage(file: File): Promise<CompressedPhoto> {
  const decoded = await decodeImage(file)

  try {
    const fullSize = fitDimensions(decoded.width, decoded.height, FULL_MAX)
    const thumbSize = fitDimensions(decoded.width, decoded.height, THUMB_MAX)

    const full = await canvasToBlob(
      drawToCanvas(decoded.source, fullSize.width, fullSize.height),
    )
    const thumb = await canvasToBlob(
      drawToCanvas(decoded.source, thumbSize.width, thumbSize.height),
    )

    return {
      full,
      thumb,
      width: fullSize.width,
      height: fullSize.height,
      mime: 'image/jpeg',
    }
  } finally {
    decoded.close?.()
  }
}
