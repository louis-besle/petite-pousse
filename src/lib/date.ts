import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'

/**
 * Les dates du domaine sont des journées calendaires locales (`YYYY-MM-DD`),
 * jamais des timestamps : on ne convertit donc jamais via UTC.
 */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Vrai si `value` est une date calendaire réelle au format YYYY-MM-DD (refuse le 30 février). */
export function isCalendarDate(value: unknown): value is string {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

/**
 * Vérifie une date calendaire et la retourne. Avec `field`, le message nomme le
 * champ fautif ; sans, il conserve le message générique des formateurs.
 */
export function assertCalendarDate(value: string, field?: string): string {
  if (!isCalendarDate(value)) {
    throw new Error(
      field === undefined
        ? `Date invalide : "${String(value)}". Format attendu YYYY-MM-DD (ex. 2026-10-12).`
        : `Date invalide pour ${field} : "${String(value)}". Format attendu YYYY-MM-DD.`,
    )
  }

  return value
}

/** Valide la forme et l'existence de la date (refuse le 30 février). */
function parseCalendarDate(date: string): Date {
  assertCalendarDate(date)

  // `parseISO` interprète `YYYY-MM-DD` comme une date locale : pas de dérive UTC.
  return parseISO(date)
}

/** `2026-10-12` → `12 oct.` (mois abrégé français, point final conservé). */
export function formatShortDate(date: string): string {
  return format(parseCalendarDate(date), 'd MMM', { locale: fr })
}

/** `2026-10-12` → `12 octobre 2026`. */
export function formatLongDate(date: string): string {
  return format(parseCalendarDate(date), 'd MMMM yyyy', { locale: fr })
}

/** « 1 sept. 2026 → 31 janv. 2027 ». */
export function formatPeriodRange(start: string, end: string): string {
  return `${formatShortDate(start)} ${start.slice(0, 4)} → ${formatShortDate(end)} ${end.slice(
    0,
    4,
  )}`
}

/** « Du 1 sept. 2026 au 31 janv. 2027 ». */
export function formatPeriodRangeLong(start: string, end: string): string {
  return `Du ${formatShortDate(start)} ${start.slice(0, 4)} au ${formatShortDate(end)} ${end.slice(
    0,
    4,
  )}`
}

/** « 1er septembre 2026 » (ordinal français du 1er). */
export function formatLongDateOrdinal(date: string): string {
  const formatted = formatLongDate(date)

  return formatted.startsWith('1 ') ? `1er${formatted.slice(1)}` : formatted
}

/**
 * Date locale du jour au format `YYYY-MM-DD`. Construite à partir des
 * accesseurs locaux : `toISOString()` bascule de jour selon le fuseau.
 * Une date peut être fournie pour rendre les calculs déterministes (tests).
 */
export function todayIso(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
