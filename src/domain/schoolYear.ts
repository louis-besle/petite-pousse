import { addDays, format, parseISO } from 'date-fns'
import type { SchoolYear } from './types'

/** Une date du domaine est toujours une chaîne `YYYY-MM-DD`, jamais un timestamp. */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const SCHOOL_YEAR_ID_PATTERN = /^(\d{4})-(\d{4})$/

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function isDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

function assertDateString(value: string, field: string): string {
  if (typeof value !== 'string' || !isDateString(value)) {
    throw new Error(
      `Date invalide pour ${field} : "${String(value)}". Format attendu YYYY-MM-DD.`,
    )
  }
  return value
}

/** Valide `YYYY-YYYY` et retourne l'année de début (septembre). */
function parseSchoolYearId(id: string): number {
  const match = typeof id === 'string' ? SCHOOL_YEAR_ID_PATTERN.exec(id) : null
  const startYear = match ? Number(match[1]) : Number.NaN
  const endYear = match ? Number(match[2]) : Number.NaN

  if (!match || endYear !== startYear + 1) {
    throw new Error(
      `Identifiant d'année scolaire invalide : "${String(id)}". Format attendu YYYY-YYYY (ex. 2026-2027).`,
    )
  }

  return startYear
}

function assertSchoolYear(year: SchoolYear): void {
  parseSchoolYearId(year.id)
  assertDateString(year.start, 'year.start')
  assertDateString(year.period1End, 'year.period1End')
  assertDateString(year.period2End, 'year.period2End')

  if (year.start > year.period1End || year.period1End >= year.period2End) {
    throw new Error(
      `Bornes incohérentes pour l'année scolaire "${year.id}" : start <= period1End < period2End attendu.`,
    )
  }
}

/**
 * Année scolaire d'une date : septembre à juin appartiennent à l'année commencée
 * en septembre, juillet et août à celle qui vient de s'écouler.
 */
export function schoolYearIdForDate(date: string): string {
  assertDateString(date, 'date')

  const calendarYear = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const startYear = month >= 9 ? calendarYear : calendarYear - 1

  return `${startYear}-${startYear + 1}`
}

/**
 * Année scolaire à utiliser pour les vues par défaut (classe, dossier, bilans).
 *
 * L'année des réglages est prioritaire quand elle contient la date : c'est elle
 * que la maîtresse a explicitement ouverte. Sinon, une réussite datée du jour est
 * classée d'après sa date (`schoolYearIdForDate`), donc l'écran doit suivre
 * l'année qui contient cette date pour ne pas masquer ce qui vient d'être noté.
 * En juillet-août, aucune année ne contient la date (elle finit au 30 juin) :
 * on retombe alors sur l'année de `schoolYearIdForDate`, celle où la réussite
 * serait réellement classée. À défaut seulement, on garde l'année préférée, puis
 * la plus récente (`years` est trié du plus récent au plus ancien).
 */
export function resolveCurrentSchoolYearId(
  years: SchoolYear[],
  preferredId: string | undefined,
  date: string,
): string | undefined {
  assertDateString(date, 'date')

  const preferred =
    preferredId === undefined
      ? undefined
      : years.find((year) => year.id === preferredId)

  if (
    preferred !== undefined &&
    date >= preferred.start &&
    date <= preferred.period2End
  ) {
    return preferred.id
  }

  const containing = years.find(
    (year) => date >= year.start && date <= year.period2End,
  )
  if (containing !== undefined) return containing.id

  // Juillet-août tombe dans le creux entre deux années : c'est pourtant
  // l'année précédente qui reçoit la réussite via `schoolYearIdForDate`.
  const dateYearId = schoolYearIdForDate(date)
  if (years.some((year) => year.id === dateYearId)) return dateYearId

  return preferred?.id ?? years[0]?.id
}

/** Année par défaut : 1er septembre, changement de semestre au 31 janvier, fin au 30 juin. */
export function defaultSchoolYear(id: string): SchoolYear {
  const startYear = parseSchoolYearId(id)
  const endYear = startYear + 1

  return {
    id: `${startYear}-${endYear}`,
    start: `${startYear}-09-01`,
    period1End: `${endYear}-01-31`,
    period2End: `${endYear}-06-30`,
  }
}

export function nextSchoolYearId(id: string): string {
  const startYear = parseSchoolYearId(id) + 1
  return `${startYear}-${startYear + 1}`
}

/**
 * Bilan d'une date : 1 jusqu'à `period1End` inclus, 2 dès le lendemain jusqu'à
 * `period2End` inclus, `null` hors de l'année scolaire (juillet-août inclus).
 * `period1End` peut avoir été modifié : on lit toujours les bornes de `year`.
 */
export function periodForDate(date: string, year: SchoolYear): 1 | 2 | null {
  assertSchoolYear(year)
  assertDateString(date, 'date')

  if (date < year.start || date > year.period2End) return null
  return date <= year.period1End ? 1 : 2
}

/** Bornes incluses d'un bilan. Le deuxième commence le lendemain de `period1End`. */
export function periodRange(year: SchoolYear, period: 1 | 2): { start: string; end: string } {
  assertSchoolYear(year)

  if (period === 1) {
    return { start: year.start, end: year.period1End }
  }
  if (period === 2) {
    // parseISO/addDays/format travaillent en date locale : pas de dérive UTC.
    const start = format(addDays(parseISO(year.period1End), 1), 'yyyy-MM-dd')
    return { start, end: year.period2End }
  }

  throw new Error(`Bilan invalide : "${String(period)}". Valeurs attendues : 1 ou 2.`)
}
