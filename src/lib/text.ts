import type { Student } from '@/domain/types'

/**
 * « 0 réussite », « 1 réussite », « 2 réussites » : en français le singulier
 * couvre aussi zéro. Le nombre est toujours inclus dans le libellé.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** « 1 réussite », « 2 réussites ». */
export function successLabel(count: number): string {
  return plural(count, 'réussite', 'réussites')
}

/** « 1 élève », « 2 élèves ». */
export function studentCountLabel(count: number): string {
  return plural(count, 'élève', 'élèves')
}

/** « 1 objectif », « 2 objectifs ». */
export function objectiveCountLabel(count: number): string {
  return plural(count, 'objectif', 'objectifs')
}

/** « 1 validation », « 2 validations ». */
export function validationCountLabel(count: number): string {
  return plural(count, 'validation', 'validations')
}

/**
 * Nom lisible d'un élève : « Léa » ou « Léa M. » quand l'initiale du nom est
 * renseignée. Une initiale vide est ignorée.
 */
export function studentFullName(
  student: Pick<Student, 'firstName' | 'lastNameInitial'>,
): string {
  const initial = student.lastNameInitial?.trim()

  return initial === undefined || initial === ''
    ? student.firstName
    : `${student.firstName} ${initial}.`
}

/** Initiale du prénom + initiale du nom quand elle existe : « LM ». */
export function studentInitials(
  student: Pick<Student, 'firstName' | 'lastNameInitial'>,
): string {
  const firstInitial = student.firstName.trim().charAt(0).toUpperCase()
  const lastInitial = student.lastNameInitial?.trim().charAt(0).toUpperCase() ?? ''

  return `${firstInitial}${lastInitial}`
}

/** Recherche insensible à la casse et aux accents (« memoriser » trouve « mémoriser »). */
export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
