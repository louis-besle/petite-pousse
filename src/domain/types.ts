export type Section = 'PS' | 'MS' | 'GS'
export type AgeBand = 'before4' | 'from4' | 'from5'

export interface Student {
  id: string
  firstName: string
  lastNameInitial?: string // optionnel, pour le PDF
  section: Section
  createdAt: string // ISO
}

export interface SchoolYear {
  id: string // "2026-2027"
  start: string // YYYY-MM-DD, 1er septembre
  period1End: string // YYYY-MM-DD, date de changement de semestre
  period2End: string // YYYY-MM-DD, fin du bilan 2
}

export interface Domain {
  id: 'langage' | 'maths' | 'corps' | 'arts' | 'temps' | 'vivant'
  label: string
  longLabel: string
  order: number
}

export interface Competency {
  id: string
  domainId: Domain['id']
  label: string
}

export interface Objective {
  id: string
  competencyId: string
  domainId: Domain['id']
  label: string
  ageBands: AgeBand[]
  examples: Partial<Record<AgeBand, string>>
  source: { bo: string; page?: number; table?: string }
}

export interface ValidationSnapshot {
  objectiveLabel: string
  domainId: Domain['id']
  domainLabel: string
  ageBand: AgeBand
  example?: string
  referentialVersion: string
}

export interface Validation {
  id: string
  studentId: string
  objectiveId: string
  schoolYearId: string
  date: string // YYYY-MM-DD
  photoId?: string
  snapshot: ValidationSnapshot
  createdAt: string
}

export interface Photo {
  id: string
  validationId: string
  full: Blob
  thumb: Blob
  width: number
  height: number
  mime: 'image/jpeg'
  createdAt: string
}

export interface Settings {
  schoolName: string
  className: string
  teacherName: string
  currentSchoolYearId: string
  lastBackupAt?: string
  lastBackupValidationCount: number
  referentialVersion: string
  schemaVersion: number
}

export interface CompressedPhoto {
  full: Blob
  thumb: Blob
  width: number
  height: number
  mime: 'image/jpeg'
}
