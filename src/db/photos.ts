import type { CompressedPhoto, Photo } from '@/domain/types'
import { db } from './db'

/**
 * Fabrique la ligne `photos` d'une photo compressée. L'écriture reste à la
 * charge de l'appelant, dans sa propre transaction.
 */
export function buildPhoto(validationId: string, photo: CompressedPhoto): Photo {
  return {
    id: `photo_${crypto.randomUUID()}`,
    validationId,
    full: photo.full,
    thumb: photo.thumb,
    width: photo.width,
    height: photo.height,
    mime: photo.mime,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Supprime toutes les photos liées à une validation. Utilisable dans une
 * transaction d'écriture existante ; ne fait rien quand la photo est absente.
 */
export async function deletePhotosForValidation(validationId: string): Promise<void> {
  await db.photos.where('validationId').equals(validationId).delete()
}

/**
 * Charge en une passe les photos des validations fournies.
 * Utilisable dans une transaction de lecture ou hors transaction.
 */
export async function loadPhotosForValidations(
  validations: readonly { photoId?: string }[],
): Promise<Map<string, Photo>> {
  const photoIds: string[] = []
  for (const validation of validations) {
    if (validation.photoId !== undefined) photoIds.push(validation.photoId)
  }

  const photos = new Map<string, Photo>()
  if (photoIds.length === 0) return photos

  for (const photo of await db.photos.bulkGet(photoIds)) {
    if (photo !== undefined) photos.set(photo.id, photo)
  }

  return photos
}
