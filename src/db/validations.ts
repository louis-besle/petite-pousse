import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlreadyValidatedError } from '@/domain/errors'
import { domainById, referential } from '@/domain/referential'
import type {
  AgeBand,
  CompressedPhoto,
  Objective,
  Validation,
  ValidationSnapshot,
} from '@/domain/types'
import { db } from './db'
import { buildPhoto, deletePhotosForValidation } from './photos'
import { getOrCreateSchoolYear } from './schoolYears'

export interface CreateValidationInput {
  studentId: string
  objective: Objective
  ageBand: AgeBand
  date: string
  referentialVersion: string
  photo?: CompressedPhoto
}

const VALIDATION_NOT_FOUND_ERROR = 'Réussite introuvable.'

/** Instantané figé de l'objectif au moment de la validation. */
function buildSnapshot(
  objective: Objective,
  ageBand: AgeBand,
  referentialVersion: string,
): ValidationSnapshot {
  const example = objective.examples[ageBand]

  return {
    objectiveLabel: objective.label,
    domainId: objective.domainId,
    domainLabel: domainById(referential, objective.domainId).label,
    ageBand,
    ...(example === undefined ? {} : { example }),
    referentialVersion,
  }
}

/**
 * Crée une validation pour un élève. L'unicité `studentId + objectiveId` est
 * garantie par l'index Dexie : une seconde tentative lève `AlreadyValidatedError`
 * et la transaction annule aussi l'insertion de la photo.
 */
export async function createValidation(input: CreateValidationInput): Promise<Validation> {
  const schoolYear = await getOrCreateSchoolYear(input.date)

  const id = `val_${crypto.randomUUID()}`
  const photo = input.photo === undefined ? undefined : buildPhoto(id, input.photo)
  const validation: Validation = {
    id,
    studentId: input.studentId,
    objectiveId: input.objective.id,
    schoolYearId: schoolYear.id,
    date: input.date,
    ...(photo === undefined ? {} : { photoId: photo.id }),
    snapshot: buildSnapshot(input.objective, input.ageBand, input.referentialVersion),
    createdAt: new Date().toISOString(),
  }

  try {
    await db.transaction('rw', db.photos, db.validations, async () => {
      if (photo !== undefined) {
        await db.photos.add(photo)
      }
      await db.validations.add(validation)
    })
  } catch (error) {
    if (error instanceof Dexie.ConstraintError) {
      throw new AlreadyValidatedError()
    }
    throw error
  }

  return validation
}

/**
 * Supprime une validation et sa photo, dans cet ordre. Une photo déjà absente
 * n'empêche pas la suppression.
 */
export async function deleteValidation(id: string): Promise<void> {
  await db.transaction('rw', db.validations, db.photos, async () => {
    const validation = await db.validations.get(id)
    if (!validation) return

    await deletePhotosForValidation(id)
    if (validation.photoId !== undefined) {
      await db.photos.delete(validation.photoId)
    }

    await db.validations.delete(id)
  })
}

/**
 * Change la date d'une validation et la reclasse dans son année scolaire.
 * L'année cible est garantie dans la même transaction que la mise à jour.
 */
export async function updateValidationDate(id: string, date: string): Promise<void> {
  await db.transaction('rw', db.validations, db.schoolYears, async () => {
    const schoolYear = await getOrCreateSchoolYear(date)

    const updated = await db.validations.update(id, {
      date,
      schoolYearId: schoolYear.id,
    })

    if (updated === 0) {
      throw new Error(VALIDATION_NOT_FOUND_ERROR)
    }
  })
}

/**
 * Remplace la photo d'une validation (ou l'ajoute si elle n'en avait pas).
 * L'ancienne photo est supprimée avant l'insertion de la nouvelle.
 */
export async function addPhotoToValidation(
  id: string,
  photo: CompressedPhoto,
): Promise<void> {
  await db.transaction('rw', db.validations, db.photos, async () => {
    const validation = await db.validations.get(id)
    if (!validation) {
      throw new Error(VALIDATION_NOT_FOUND_ERROR)
    }

    const record = buildPhoto(id, photo)

    await deletePhotosForValidation(id)
    if (validation.photoId !== undefined) {
      await db.photos.delete(validation.photoId)
    }

    await db.photos.add(record)
    await db.validations.update(id, { photoId: record.id })
  })
}

/** Validations d'un élève. `undefined` pendant le chargement initial. */
export function useValidationsForStudent(studentId: string): Validation[] | undefined {
  return useLiveQuery(
    () => db.validations.where('studentId').equals(studentId).toArray(),
    [studentId],
  )
}

/** Validations d'une année scolaire. `undefined` pendant le chargement initial. */
export function useValidationsForYear(yearId: string): Validation[] | undefined {
  return useLiveQuery(
    () => db.validations.where('schoolYearId').equals(yearId).toArray(),
    [yearId],
  )
}

/** Toutes les validations. `undefined` pendant le chargement initial. */
export function useAllValidations(): Validation[] | undefined {
  return useLiveQuery(() => db.validations.toArray(), [])
}
