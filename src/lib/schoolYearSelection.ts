import type { SchoolYear } from '@/domain/types'

/**
 * Identifiants d'années proposés dans les sélecteurs : du plus récent au plus
 * ancien (`YYYY-YYYY` se trie comme une date). L'année courante est conservée
 * même quand elle est absente du référentiel, pour que le select ne bascule
 * jamais silencieusement sur une autre valeur.
 */
export function sortedSchoolYearIds(years: SchoolYear[], currentId?: string): string[] {
  const ids = new Set(years.map((year) => year.id))
  if (currentId !== undefined) ids.add(currentId)

  return [...ids].sort((a, b) => b.localeCompare(a))
}
