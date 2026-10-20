import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Settings } from '@/domain/types'
import { SETTINGS_ID, db } from './db'
import { ensureSeed } from './seed'

/** Réglages de l'application, après amorçage de la base si nécessaire. */
export async function getSettings(): Promise<Settings> {
  await ensureSeed()

  const settings = await db.settings.get(SETTINGS_ID)
  if (!settings) {
    throw new Error(
      "Réglages introuvables : la base n'a pas été amorcée correctement (ligne « app » absente).",
    )
  }

  return settings
}

/** Fusionne un patch dans les réglages existants, en amorçant la base au besoin. */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await ensureSeed()
  await db.settings.update(SETTINGS_ID, patch)
}

/**
 * Réglages réactifs. `undefined` tant que la base n'est pas amorcée : les
 * écrans doivent gérer ce chargement initial.
 *
 * L'amorçage se fait hors de `liveQuery` : une requête live ne peut pas ouvrir
 * de transaction d'écriture.
 */
export function useSettings(): Settings | undefined {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    ensureSeed()
      .catch((error: unknown) => {
        console.error('Amorçage de la base impossible', error)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return useLiveQuery(() => (ready ? db.settings.get(SETTINGS_ID) : undefined), [ready])
}
