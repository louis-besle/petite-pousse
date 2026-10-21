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
