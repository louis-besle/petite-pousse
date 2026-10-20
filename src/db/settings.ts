import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { defaultSchoolYear } from '@/domain/schoolYear'
import type { Settings } from '@/domain/types'
import { SETTINGS_ID, db, type SettingsRecord } from './db'
import { ensureSeed } from './seed'

/** Durée d'attente avant la seconde tentative d'amorçage. */
const SEED_RETRY_DELAY_MS = 500

/** Retire la clé technique Dexie : le domaine ne connaît que `Settings`. */
function toDomainSettings(record: SettingsRecord): Settings {
  const settings: Settings = {
    schoolName: record.schoolName,
    className: record.className,
    teacherName: record.teacherName,
    currentSchoolYearId: record.currentSchoolYearId,
    lastBackupValidationCount: record.lastBackupValidationCount,
    referentialVersion: record.referentialVersion,
    schemaVersion: record.schemaVersion,
  }

  return record.lastBackupAt === undefined
    ? settings
    : { ...settings, lastBackupAt: record.lastBackupAt }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

/** Réglages de l'application, après amorçage de la base si nécessaire. */
export async function getSettings(): Promise<Settings> {
  await ensureSeed()

  const settings = await db.settings.get(SETTINGS_ID)
  if (!settings) {
    throw new Error(
      "Réglages introuvables : la base n'a pas été amorcée correctement (ligne « app » absente).",
    )
  }

  return toDomainSettings(settings)
}

/**
 * Fusionne un patch dans les réglages existants, en amorçant la base au besoin.
 * Si le patch change d'année scolaire, la ligne de cette année est garantie
 * dans la même opération ; une année existante n'est jamais écrasée.
 */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await ensureSeed()

  await db.transaction('rw', db.settings, db.schoolYears, async () => {
    if (patch.currentSchoolYearId !== undefined) {
      const yearId = patch.currentSchoolYearId
      if (!(await db.schoolYears.get(yearId))) {
        await db.schoolYears.add(defaultSchoolYear(yearId))
      }
    }

    await db.settings.update(SETTINGS_ID, patch)
  })
}

/**
 * Réglages réactifs. `undefined` tant que la base n'est pas amorcée : les
 * écrans doivent gérer ce chargement initial.
 *
 * L'amorçage se fait hors de `liveQuery` : une requête live ne peut pas ouvrir
 * de transaction d'écriture. Un échec est retenté une fois ; s'il persiste, la
 * panne de stockage devra être remontée par l'écran réglages/sauvegarde
 * (tâche 20).
 */
export function useSettings(): Settings | undefined {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function seedWithRetry(): Promise<void> {
      try {
        await ensureSeed()
      } catch (firstError) {
        await wait(SEED_RETRY_DELAY_MS)
        if (cancelled) return

        try {
          await ensureSeed()
        } catch (retryError) {
          console.error(
            "Amorçage de la base impossible après une nouvelle tentative : " +
              'le stockage local doit être signalé par l’écran réglages.',
            retryError,
            firstError,
          )
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void seedWithRetry()

    return () => {
      cancelled = true
    }
  }, [])

  return useLiveQuery(async () => {
    if (!ready) return undefined

    const settings = await db.settings.get(SETTINGS_ID)
    return settings ? toDomainSettings(settings) : undefined
  }, [ready])
}
