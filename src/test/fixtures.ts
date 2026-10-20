import { REFERENTIAL_VERSION } from '@/domain/referential'
import type { SchoolYear, Settings, Student } from '@/domain/types'

let nextId = 0

function fixtureId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

/** Élève de test ; chaque appel produit un identifiant distinct. */
export function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: fixtureId('student'),
    firstName: 'Léa',
    section: 'MS',
    createdAt: '2026-09-01T08:00:00.000Z',
    ...overrides,
  }
}

/** Année scolaire de test, par défaut 2026-2027. */
export function makeSchoolYear(overrides: Partial<SchoolYear> = {}): SchoolYear {
  return {
    id: '2026-2027',
    start: '2026-09-01',
    period1End: '2027-01-31',
    period2End: '2027-06-30',
    ...overrides,
  }
}

/** Réglages de test, sans clé `id` : la couche base l'ajoute elle-même. */
export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    schoolName: 'École des Lilas',
    className: 'MS A',
    teacherName: 'Mme Martin',
    currentSchoolYearId: '2026-2027',
    lastBackupValidationCount: 0,
    referentialVersion: REFERENTIAL_VERSION,
    schemaVersion: 1,
    ...overrides,
  }
}
