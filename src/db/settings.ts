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

export interface SettingsState {
  /** `undefined` pendant le chargement initial ou après un échec définitif. */
  settings: Settings | undefined
  /** Vrai quand la base ne peut pas être amorcée ou lue. */
  error: boolean
}

type SettingsQueryResult =
  | { status: 'loading' }
  | { status: 'ready'; settings: Settings }
  | { status: 'error' }

/**
 * Réglages réactifs avec leur état de panne. Les écrans qui n'ont pas besoin
 * de distinguer une panne d'un chargement utilisent `useSettings`.
 *
 * L'amorçage se fait hors de `liveQuery` : une requête live ne peut pas ouvrir
 * de transaction d'écriture. Un échec est retenté une fois ; s'il persiste,
 * `error` passe à vrai pour que l'écran réglages puisse l'expliquer.
 */
export function useSettingsState(): SettingsState {
  const [ready, setReady] = useState(false)
  const [seedError, setSeedError] = useState(false)

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
              'le stockage local de cet appareil est peut-être indisponible.',
            retryError,
            firstError,
          )
          if (!cancelled) setSeedError(true)
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

  // Une lecture qui échoue est renvoyée comme un état, pas comme une exception :
  // `useLiveQuery` la relancerait au rendu et ferait tomber l'écran entier.
  const query = useLiveQuery<SettingsQueryResult>(async () => {
    if (!ready) return { status: 'loading' }

    try {
      const record = await db.settings.get(SETTINGS_ID)
      if (!record) return { status: 'error' }

      return { status: 'ready', settings: toDomainSettings(record) }
    } catch (error) {
      console.error('Lecture des réglages impossible.', error)
      return { status: 'error' }
    }
  }, [ready])

  if (seedError || query?.status === 'error') {
    return { settings: undefined, error: true }
  }
  if (query?.status === 'ready') {
    return { settings: query.settings, error: false }
  }

  return { settings: undefined, error: false }
}

/** Réglages réactifs. `undefined` tant que la base n'est pas amorcée. */
export function useSettings(): Settings | undefined {
  return useSettingsState().settings
}
