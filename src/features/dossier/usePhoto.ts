import { useEffect, useState } from 'react'
import { db } from '@/db/db'

type PhotoField = 'full' | 'thumb'

interface LoadedPhoto {
  photoId: string
  url: string
}

/**
 * Fabrique une URL d'objet pour un champ de photo et la révoque dès que
 * l'identifiant change ou que le composant est démonté.
 *
 * Une photo absente (identifiant inconnu ou ligne supprimée) rend `undefined`
 * sans lever d'erreur : un dossier peut survivre à une photo manquante.
 */
function usePhotoUrl(photoId: string | undefined, field: PhotoField): string | undefined {
  const [loaded, setLoaded] = useState<LoadedPhoto>()

  useEffect(() => {
    if (photoId === undefined) return

    let active = true
    let objectUrl: string | undefined

    void db.photos
      .get(photoId)
      .then((photo) => {
        if (!active || photo === undefined) return

        objectUrl = URL.createObjectURL(photo[field])
        setLoaded({ photoId, url: objectUrl })
      })
      .catch((error: unknown) => {
        // Ligne supprimée entre-temps, base fermée… : la vignette reste vide.
        console.error('Lecture de la photo impossible.', error)
      })

    return () => {
      active = false
      if (objectUrl !== undefined) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [photoId, field])

  // La dérivation ignore l'URL de la photo précédente pendant le chargement.
  return photoId !== undefined && loaded?.photoId === photoId ? loaded.url : undefined
}

/** URL de la photo pleine taille, pour la fiche de réussite. */
export function usePhoto(photoId?: string): string | undefined {
  return usePhotoUrl(photoId, 'full')
}

/** URL de la vignette, pour les lignes du dossier. */
export function usePhotoThumb(photoId?: string): string | undefined {
  return usePhotoUrl(photoId, 'thumb')
}
