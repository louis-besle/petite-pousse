import { format, isValid, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { defaultSchoolYear, nextSchoolYearId, schoolYearIdForDate } from '@/domain/schoolYear'
import type { SchoolYear } from '@/domain/types'
import { SETTINGS_ID, db } from './db'
import { ensureSeed } from './seed'

const YEAR_NOT_FOUND_ERROR = 'Année scolaire introuvable.'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function assertDateString(value: string, field: string): void {
  const parsed = DATE_PATTERN.test(value) ? parseISO(value) : null
  const valid = parsed !== null && isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value

  if (!valid) {
    throw new Error(
      `Date invalide pour ${field} : "${String(value)}". Format attendu YYYY-MM-DD.`,
    )
  }
}

/**
 * Année scolaire d'une date, créée avec les bornes par défaut si elle manque.
 * Une année existante n'est jamais écrasée ni supprimée.
 */
export async function getOrCreateSchoolYear(date: string): Promise<SchoolYear> {
  const id = schoolYearIdForDate(date)

  const existing = await db.schoolYears.get(id)
  if (existing) return existing

  const year = defaultSchoolYear(id)
  await db.schoolYears.add(year)
  return year
}

/**
 * Modifie les bornes d'une seule année scolaire. L'ordre
 * `start < period1End < period2End` est vérifié avant écriture : une valeur
 * refusée laisse la ligne intacte. Les validations ne sont pas reclassées,
 * leur bilan étant dérivé des dates à la lecture.
 */
export async function updateSchoolYearPeriods(
  yearId: string,
  patch: { period1End?: string; period2End?: string },
): Promise<void> {
  await db.transaction('rw', db.schoolYears, async () => {
    const existing = await db.schoolYears.get(yearId)
    if (!existing) {
      throw new Error(`${YEAR_NOT_FOUND_ERROR} (« ${yearId} »)`)
    }

    const updated: SchoolYear = { ...existing }
    if (patch.period1End !== undefined) {
      assertDateString(patch.period1End, 'period1End')
      updated.period1End = patch.period1End
    }
    if (patch.period2End !== undefined) {
      assertDateString(patch.period2End, 'period2End')
      updated.period2End = patch.period2End
    }

    if (!(updated.start < updated.period1End && updated.period1End < updated.period2End)) {
      throw new Error(
        `Dates incohérentes pour l'année scolaire « ${yearId} » : start < period1End < period2End attendu.`,
      )
    }

    await db.schoolYears.put(updated)
  })
}

/**
 * Crée l'année suivante si elle manque, puis bascule les réglages dessus.
 * Rien n'est supprimé : élèves, validations, photos et années antérieures
 * restent en place.
 */
export async function startNextSchoolYear(currentId: string): Promise<SchoolYear> {
  const nextId = nextSchoolYearId(currentId)

  // Les réglages doivent exister avant la bascule.
  await ensureSeed()

  return db.transaction('rw', db.schoolYears, db.settings, async () => {
    const existing = await db.schoolYears.get(nextId)
    const year = existing ?? defaultSchoolYear(nextId)

    if (!existing) {
      await db.schoolYears.add(year)
    }

    await db.settings.update(SETTINGS_ID, { currentSchoolYearId: nextId })
    return year
  })
}

/** Années scolaires connues, de la plus récente à la plus ancienne. */
export function useSchoolYears(): SchoolYear[] | undefined {
  return useLiveQuery(async () => {
    const years = await db.schoolYears.toArray()
    return years.sort((a, b) => b.start.localeCompare(a.start))
  }, [])
}
