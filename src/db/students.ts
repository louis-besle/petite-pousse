import { useLiveQuery } from 'dexie-react-hooks'
import type { Section, Student } from '@/domain/types'
import { db } from './db'

const EMPTY_FIRST_NAME_ERROR = 'Le prénom est obligatoire.'
const STUDENT_NOT_FOUND_ERROR = 'Élève introuvable.'

/** Nettoie un prénom saisi ; un prénom vide n'est jamais accepté. */
function cleanFirstName(value: string): string {
  const firstName = value.trim()
  if (firstName === '') {
    throw new Error(EMPTY_FIRST_NAME_ERROR)
  }

  return firstName
}

/**
 * Normalise l'initiale du nom de famille : une seule lettre majuscule.
 * Une valeur vide ou composée uniquement d'espaces vaut `undefined`.
 */
export function normalizeLastNameInitial(value: string): string | undefined {
  const initial = value.trim()
  if (initial === '') {
    return undefined
  }

  return initial.charAt(0).toUpperCase()
}

/** Crée un élève et renvoie la ligne réellement enregistrée. */
export async function createStudent(input: {
  firstName: string
  lastNameInitial?: string
  section: Section
}): Promise<Student> {
  const student: Student = {
    id: crypto.randomUUID(),
    firstName: cleanFirstName(input.firstName),
    section: input.section,
    createdAt: new Date().toISOString(),
  }

  const lastNameInitial =
    input.lastNameInitial === undefined
      ? undefined
      : normalizeLastNameInitial(input.lastNameInitial)
  if (lastNameInitial !== undefined) {
    student.lastNameInitial = lastNameInitial
  }

  await db.students.add(student)
  return student
}

/**
 * Modifie un élève existant. L'identifiant et la date de création sont
 * conservés ; une initiale vide retire la clé `lastNameInitial`.
 */
export async function updateStudent(
  id: string,
  patch: Partial<Pick<Student, 'firstName' | 'lastNameInitial' | 'section'>>,
): Promise<void> {
  await db.transaction('rw', db.students, async () => {
    const existing = await db.students.get(id)
    if (!existing) {
      throw new Error(STUDENT_NOT_FOUND_ERROR)
    }

    const updated: Student = { ...existing }
    if (patch.firstName !== undefined) {
      updated.firstName = cleanFirstName(patch.firstName)
    }
    if (patch.section !== undefined) {
      updated.section = patch.section
    }
    if (patch.lastNameInitial !== undefined) {
      const lastNameInitial = normalizeLastNameInitial(patch.lastNameInitial)
      if (lastNameInitial === undefined) {
        delete updated.lastNameInitial
      } else {
        updated.lastNameInitial = lastNameInitial
      }
    }

    await db.students.put(updated)
  })
}

/**
 * Supprime un élève et tout ce qui en dépend : ses validations puis leurs
 * photos, le tout dans une seule transaction.
 */
export async function deleteStudentCascade(id: string): Promise<void> {
  await db.transaction('rw', db.students, db.validations, db.photos, async () => {
    const validationIds = await db.validations.where('studentId').equals(id).primaryKeys()

    // `anyOf([])` lève une erreur Dexie : on ne nettoie que s'il y a des photos.
    if (validationIds.length > 0) {
      await db.photos.where('validationId').anyOf(validationIds).delete()
      await db.validations.bulkDelete(validationIds)
    }

    await db.students.delete(id)
  })
}

/** Élèves de la classe, triés par prénom. `undefined` pendant le chargement. */
export function useStudents(): Student[] | undefined {
  return useLiveQuery(async () => {
    const students = await db.students.toArray()
    return students.sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'))
  }, [])
}
