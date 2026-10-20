import Dexie, { type EntityTable } from 'dexie'
import type {
  CaptureDraft,
  Photo,
  SchoolYear,
  Settings,
  Student,
  Validation,
} from '@/domain/types'

/** Nom stable de la base : il conditionne les sauvegardes et les migrations. */
export const DB_NAME = 'carnet-de-reussites'

/** Les réglages sont une ligne unique, identifiée par cette clé fixe. */
export const SETTINGS_ID = 'app'

export type SettingsRecord = Settings & { id: typeof SETTINGS_ID }

export class CarnetDB extends Dexie {
  students!: EntityTable<Student, 'id'>
  schoolYears!: EntityTable<SchoolYear, 'id'>
  validations!: EntityTable<Validation, 'id'>
  photos!: EntityTable<Photo, 'id'>
  settings!: EntityTable<SettingsRecord, 'id'>
  drafts!: EntityTable<CaptureDraft, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)

    this.version(1).stores({
      students: 'id, section, firstName',
      schoolYears: 'id, start',
      validations: 'id, studentId, objectiveId, date, schoolYearId, &[studentId+objectiveId]',
      photos: 'id, validationId',
      settings: 'id',
      drafts: 'id',
    })
  }
}

export const db = new CarnetDB()
