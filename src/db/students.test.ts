import { act, renderHook, waitFor } from '@testing-library/react'
import { REFERENTIAL_VERSION } from '@/domain/referential'
import type { Photo, Validation } from '@/domain/types'
import { db } from './db'
import {
  createStudent,
  deleteStudentCascade,
  normalizeLastNameInitial,
  updateStudent,
  useStudents,
} from './students'

function makeValidation(studentId: string, id = 'validation-1'): Validation {
  return {
    id,
    studentId,
    objectiveId: 'obj-1',
    schoolYearId: '2026-2027',
    date: '2026-10-01',
    photoId: `${id}-photo`,
    snapshot: {
      objectiveLabel: 'Dire de mémoire un texte court',
      domainId: 'langage',
      domainLabel: 'Langage',
      ageBand: 'from4',
      referentialVersion: REFERENTIAL_VERSION,
    },
    createdAt: '2026-10-01T09:00:00.000Z',
  }
}

function makePhoto(validationId: string, id = 'validation-1-photo'): Photo {
  return {
    id,
    validationId,
    full: new Blob(['pleine'], { type: 'image/jpeg' }),
    thumb: new Blob(['vignette'], { type: 'image/jpeg' }),
    width: 800,
    height: 600,
    mime: 'image/jpeg',
    createdAt: '2026-10-01T09:00:00.000Z',
  }
}

describe('normalizeLastNameInitial', () => {
  it('met l’initiale en majuscule', () => {
    expect(normalizeLastNameInitial('m')).toBe('M')
  })

  it('ignore les espaces autour de l’initiale', () => {
    expect(normalizeLastNameInitial('  m  ')).toBe('M')
  })

  it('ne garde que le premier caractère', () => {
    expect(normalizeLastNameInitial('martin')).toBe('M')
  })

  it('renvoie undefined pour une valeur vide ou blanche', () => {
    expect(normalizeLastNameInitial('')).toBeUndefined()
    expect(normalizeLastNameInitial('   ')).toBeUndefined()
  })
})

describe('createStudent', () => {
  it('crée un élève et le renvoie avec un identifiant et une date', async () => {
    const student = await createStudent({ firstName: 'Léa', section: 'MS' })

    expect(student.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(student.firstName).toBe('Léa')
    expect(student.section).toBe('MS')
    expect(Number.isNaN(Date.parse(student.createdAt))).toBe(false)
    expect(await db.students.get(student.id)).toEqual(student)
  })

  it('nettoie le prénom et normalise l’initiale', async () => {
    const student = await createStudent({
      firstName: '  Léa  ',
      lastNameInitial: 'm',
      section: 'PS',
    })

    expect(student.firstName).toBe('Léa')
    expect(student.lastNameInitial).toBe('M')
  })

  it('n’enregistre pas d’initiale vide', async () => {
    const student = await createStudent({
      firstName: 'Léa',
      lastNameInitial: '   ',
      section: 'GS',
    })

    expect(student).not.toHaveProperty('lastNameInitial')
    expect(await db.students.get(student.id)).not.toHaveProperty('lastNameInitial')
  })

  it('refuse un prénom vide', async () => {
    await expect(
      createStudent({ firstName: '   ', section: 'MS' }),
    ).rejects.toThrow('Le prénom est obligatoire.')
    expect(await db.students.count()).toBe(0)
  })
})

describe('useStudents', () => {
  it('renvoie les élèves triés par prénom', async () => {
    const { result } = renderHook(() => useStudents())

    await waitFor(() => expect(result.current).toEqual([]))

    await act(async () => {
      await createStudent({ firstName: 'Zoé', section: 'GS' })
      await createStudent({ firstName: 'Alice', section: 'PS' })
      await createStudent({ firstName: 'émile', section: 'MS' })
    })

    await waitFor(() => expect(result.current).toHaveLength(3))
    expect(result.current?.map((student) => student.firstName)).toEqual([
      'Alice',
      'émile',
      'Zoé',
    ])
  })
})

describe('updateStudent', () => {
  it('modifie le prénom et la section en conservant l’identifiant et la date', async () => {
    const student = await createStudent({ firstName: 'Léa', section: 'MS' })

    await updateStudent(student.id, { firstName: '  Émile ', section: 'GS' })

    const updated = await db.students.get(student.id)
    expect(updated).toEqual({
      ...student,
      firstName: 'Émile',
      section: 'GS',
    })
  })

  it('normalise une nouvelle initiale', async () => {
    const student = await createStudent({ firstName: 'Léa', section: 'MS' })

    await updateStudent(student.id, { lastNameInitial: 'm' })

    expect((await db.students.get(student.id))?.lastNameInitial).toBe('M')
  })

  it('supprime l’initiale quand la valeur devient vide', async () => {
    const student = await createStudent({
      firstName: 'Léa',
      lastNameInitial: 'M',
      section: 'MS',
    })

    await updateStudent(student.id, { lastNameInitial: '  ' })

    const updated = await db.students.get(student.id)
    expect(updated).not.toHaveProperty('lastNameInitial')
    expect(updated?.id).toBe(student.id)
    expect(updated?.createdAt).toBe(student.createdAt)
  })

  it('refuse un prénom vide et laisse l’élève inchangé', async () => {
    const student = await createStudent({ firstName: 'Léa', section: 'MS' })

    await expect(updateStudent(student.id, { firstName: '   ' })).rejects.toThrow(
      'Le prénom est obligatoire.',
    )
    expect(await db.students.get(student.id)).toEqual(student)
  })
})

describe('deleteStudentCascade', () => {
  it('supprime un élève sans validation', async () => {
    const kept = await createStudent({ firstName: 'Alice', section: 'PS' })
    const removed = await createStudent({ firstName: 'Zoé', section: 'GS' })
    const { result } = renderHook(() => useStudents())

    await waitFor(() => expect(result.current).toHaveLength(2))

    await act(async () => {
      await deleteStudentCascade(removed.id)
    })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0]?.id).toBe(kept.id)
    expect(await db.students.get(removed.id)).toBeUndefined()
  })

  it('supprime les validations et photos de l’élève, sans toucher aux autres', async () => {
    const removed = await createStudent({ firstName: 'Léa', section: 'MS' })
    const kept = await createStudent({ firstName: 'Alice', section: 'PS' })

    const removedValidation = makeValidation(removed.id, 'validation-removed')
    const keptValidation = makeValidation(kept.id, 'validation-kept')
    await db.validations.bulkAdd([removedValidation, keptValidation])
    await db.photos.bulkAdd([
      makePhoto(removedValidation.id, 'photo-removed'),
      makePhoto(keptValidation.id, 'photo-kept'),
    ])

    await deleteStudentCascade(removed.id)

    expect(await db.students.get(removed.id)).toBeUndefined()
    expect(await db.validations.get(removedValidation.id)).toBeUndefined()
    expect(await db.photos.get('photo-removed')).toBeUndefined()
    expect(await db.validations.get(keptValidation.id)).toEqual(keptValidation)
    expect(await db.photos.get('photo-kept')).toBeDefined()
  })
})
