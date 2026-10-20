import { REFERENTIAL_VERSION } from '@/domain/referential'
import { defaultSchoolYear, schoolYearIdForDate } from '@/domain/schoolYear'
import { SETTINGS_ID, db, type SettingsRecord } from './db'

/**
 * Date du jour au format `YYYY-MM-DD`, calculée en heure locale. Le helper
 * partagé `todayIso` arrivera en tâche 11 ; `toISOString` est volontairement
 * évité pour ne pas basculer d'année autour de minuit.
 */
export function localTodayIso(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function defaultSettings(currentSchoolYearId: string): SettingsRecord {
  return {
    id: SETTINGS_ID,
    schoolName: '',
    className: '',
    teacherName: '',
    currentSchoolYearId,
    lastBackupValidationCount: 0,
    referentialVersion: REFERENTIAL_VERSION,
    schemaVersion: 1,
  }
}

/**
 * Amorce la base : réglages par défaut et année scolaire courante.
 *
 * Idempotent et non destructif : les réglages et l'année existants ne sont
 * jamais écrasés. Si les réglages existent mais que l'année qu'ils référencent
 * a disparu, elle est recréée avec ses bornes par défaut.
 */
export async function ensureSeed(): Promise<void> {
  const currentSchoolYearId = schoolYearIdForDate(localTodayIso())

  await db.transaction('rw', db.settings, db.schoolYears, async () => {
    const settings = await db.settings.get(SETTINGS_ID)

    if (!settings) {
      if (!(await db.schoolYears.get(currentSchoolYearId))) {
        await db.schoolYears.add(defaultSchoolYear(currentSchoolYearId))
      }
      await db.settings.add(defaultSettings(currentSchoolYearId))
      return
    }

    const referencedYearId = settings.currentSchoolYearId || currentSchoolYearId
    if (!(await db.schoolYears.get(referencedYearId))) {
      await db.schoolYears.add(defaultSchoolYear(referencedYearId))
    }
  })
}
