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

/** Valide la forme et l'existence de la date (refuse le 30 février). */
function parseCalendarDate(date: string): Date {
  const match = typeof date === 'string' ? DATE_PATTERN.exec(date) : null
  if (!match) {
    throw new Error(
      `Date invalide : "${String(date)}". Format attendu YYYY-MM-DD (ex. 2026-10-12).`,
    )
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(
      `Date invalide : "${String(date)}". Format attendu YYYY-MM-DD (ex. 2026-10-12).`,
    )
  }

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
