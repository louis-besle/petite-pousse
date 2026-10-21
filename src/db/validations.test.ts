/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AlreadyValidatedError } from '@/domain/errors'
import { REFERENTIAL_VERSION } from '@/domain/referential'
import type { CompressedPhoto, Objective } from '@/domain/types'
import { db } from './db'
import { createStudent } from './students'
import {
  createValidation,
  deleteValidation,
  updateValidationDate,
  useAllValidations,
  useValidationsForStudent,
  useValidationsForYear,
} from './validations'

const objective: Objective = {
  id: 'obj-dire-un-texte',
  competencyId: 'comp-langage-1',
  domainId: 'langage',
  label: 'Dire de mémoire un texte court',
  ageBands: ['from4', 'from5'],
  examples: {
    from4: 'Réciter une comptine',
    from5: 'Réciter un poème',
  },
  source: { bo: 'BO 2026' },
}

/**
 * Le `Blob` de jsdom est transformé en objet vide par le clone structuré de
 * fake-indexeddb ; celui de Node survit et permet de vérifier le contenu relu.
 */
function jpegBlob(content: string): Blob {
  return new NodeBlob([content], { type: 'image/jpeg' }) as unknown as Blob
}

function makePhoto(label = 'pleine'): CompressedPhoto {
  return {
    full: jpegBlob(label),
    thumb: jpegBlob(`${label}-vignette`),
    width: 800,
    height: 600,
    mime: 'image/jpeg',
  }
}

async function baseInput(date = '2026-10-12') {
  const student = await createStudent({ firstName: 'Léa', section: 'MS' })

  return {
    studentId: student.id,
    objective,
    ageBand: 'from4' as const,
    date,
    referentialVersion: REFERENTIAL_VERSION,
  }
}

describe('createValidation', () => {
  it('crée une validation avec son instantané et l’enregistre', async () => {
    const base = await baseInput()

    const validation = await createValidation(base)

    expect(validation.id).toMatch(/^val_/)
    expect(validation.studentId).toBe(base.studentId)
    expect(validation.objectiveId).toBe(objective.id)
    expect(validation.schoolYearId).toBe('2026-2027')
    expect(validation.date).toBe('2026-10-12')
    expect(validation.createdAt).not.toBe('')
    expect(validation.snapshot).toEqual({
      objectiveLabel: 'Dire de mémoire un texte court',
      domainId: 'langage',
      domainLabel: 'Langage',
      ageBand: 'from4',
      example: 'Réciter une comptine',
      referentialVersion: REFERENTIAL_VERSION,
    })
    expect(await db.validations.get(validation.id)).toEqual(validation)
  })

  it('n’ajoute pas d’exemple quand la tranche d’âge n’en a pas', async () => {
    const base = await baseInput()

    const validation = await createValidation({
      ...base,
      objective: { ...objective, ageBands: ['before4'], examples: {} },
      ageBand: 'before4',
    })

    expect(validation.snapshot).not.toHaveProperty('example')
  })

  it('enregistre la photo liée dans la même opération', async () => {
    const base = await baseInput()

    const validation = await createValidation({ ...base, photo: makePhoto() })

    expect(validation.photoId).toMatch(/^photo_/)
    const photo = await db.photos.get(validation.photoId!)
    expect(photo).toBeDefined()
    expect(photo?.validationId).toBe(validation.id)
    expect(photo?.width).toBe(800)
    expect(photo?.height).toBe(600)
    expect(photo?.mime).toBe('image/jpeg')
    expect(photo?.full.type).toBe('image/jpeg')
    expect(photo?.thumb.type).toBe('image/jpeg')
  })

  it('refuse une deuxième validation du même objectif', async () => {
    const base = await baseInput('2026-10-12')

    await createValidation(base)
    await expect(createValidation({ ...base, date: '2026-10-13' })).rejects.toThrow(
      AlreadyValidatedError,
    )

    expect(await db.validations.count()).toBe(1)
  })

  it('n’accepte qu’une validation sur deux créations concurrentes', async () => {
    const base = await baseInput('2026-10-12')

    const results = await Promise.allSettled([
      createValidation({ ...base, photo: makePhoto('concurrente-a') }),
      createValidation({ ...base, photo: makePhoto('concurrente-b') }),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.reason).toBeInstanceOf(AlreadyValidatedError)
    expect(await db.validations.count()).toBe(1)
    expect(await db.photos.count()).toBe(1)
  })

  it('n’ajoute pas de photo orpheline quand la validation est refusée', async () => {
    const base = await baseInput('2026-10-12')

    await createValidation({ ...base, photo: makePhoto('première') })
    await expect(
      createValidation({ ...base, date: '2026-10-13', photo: makePhoto('seconde') }),
    ).rejects.toThrow(AlreadyValidatedError)

    expect(await db.validations.count()).toBe(1)
    expect(await db.photos.count()).toBe(1)
  })

  it('classe une validation de juillet dans l’année scolaire précédente', async () => {
    const base = await baseInput()

    const validation = await createValidation({ ...base, date: '2027-07-15' })

    expect(validation.schoolYearId).toBe('2026-2027')
    expect((await db.validations.get(validation.id))?.schoolYearId).toBe('2026-2027')
  })
})

describe('updateValidationDate', () => {
  it('reclasse la validation quand la date change d’année', async () => {
    const base = await baseInput('2026-10-12')
    const validation = await createValidation(base)

    await updateValidationDate(validation.id, '2027-10-12')

    const updated = await db.validations.get(validation.id)
    expect(updated?.date).toBe('2027-10-12')
    expect(updated?.schoolYearId).toBe('2027-2028')
    expect(await db.schoolYears.get('2027-2028')).toBeDefined()
  })

  it('conserve l’instantané et la photo', async () => {
    const base = await baseInput('2026-10-12')
    const validation = await createValidation({ ...base, photo: makePhoto() })

    await updateValidationDate(validation.id, '2027-10-12')

    const updated = await db.validations.get(validation.id)
    expect(updated?.snapshot).toEqual(validation.snapshot)
    expect(updated?.photoId).toBe(validation.photoId)
    expect(await db.photos.get(validation.photoId!)).toBeDefined()
  })

  it('refuse une date mal formée sans modifier la validation', async () => {
    const base = await baseInput('2026-10-12')
    const validation = await createValidation(base)

    await expect(updateValidationDate(validation.id, '12/10/2027')).rejects.toThrow(/date/i)
    expect(await db.validations.get(validation.id)).toEqual(validation)
  })
})

describe('deleteValidation', () => {
  it('supprime la validation et sa photo', async () => {
    const base = await baseInput()
    const validation = await createValidation({ ...base, photo: makePhoto() })
    const photoId = validation.photoId!

    await deleteValidation(validation.id)

    expect(await db.validations.get(validation.id)).toBeUndefined()
    expect(await db.photos.get(photoId)).toBeUndefined()
  })

  it('supprime une photo orpheline même si la validation a déjà disparu', async () => {
    const base = await baseInput()
    const validation = await createValidation({ ...base, photo: makePhoto() })
    const photoId = validation.photoId!
    await db.validations.delete(validation.id)

    await deleteValidation(validation.id)

    expect(await db.photos.get(photoId)).toBeUndefined()
  })

  it('fonctionne quand la photo est absente', async () => {
    const base = await baseInput()
    const validation = await createValidation(base)

    await deleteValidation(validation.id)

    expect(await db.validations.get(validation.id)).toBeUndefined()
  })
})

describe('useValidationsForStudent', () => {
  it('ne renvoie que les validations de l’élève demandé', async () => {
    const lea = await createStudent({ firstName: 'Léa', section: 'MS' })
    const noe = await createStudent({ firstName: 'Noé', section: 'MS' })
    const shared = {
      objective,
      ageBand: 'from4' as const,
      referentialVersion: REFERENTIAL_VERSION,
    }

    await createValidation({
      ...shared,
      studentId: lea.id,
      date: '2026-10-12',
      objective: { ...objective, id: 'obj-1' },
    })
    await createValidation({
      ...shared,
      studentId: noe.id,
      date: '2026-10-12',
      objective: { ...objective, id: 'obj-2' },
    })

    const { result } = renderHook(() => useValidationsForStudent(lea.id))

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0]?.studentId).toBe(lea.id)
    expect(result.current?.[0]?.objectiveId).toBe('obj-1')
  })
})

describe('useValidationsForYear', () => {
  it('filtre les validations sur l’année scolaire', async () => {
    const base = await baseInput('2026-10-12')

    await createValidation(base)
    await createValidation({
      ...base,
      date: '2027-10-12',
      objective: { ...objective, id: 'obj-annee-suivante' },
    })

    const { result } = renderHook(() => useValidationsForYear('2026-2027'))

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0]?.schoolYearId).toBe('2026-2027')
  })
})

describe('useAllValidations', () => {
  it('renvoie toutes les validations', async () => {
    const base = await baseInput('2026-10-12')

    await createValidation(base)
    await createValidation({
      ...base,
      date: '2027-10-12',
      objective: { ...objective, id: 'obj-annee-suivante' },
    })

    const { result } = renderHook(() => useAllValidations())

    await waitFor(() => expect(result.current).toHaveLength(2))
  })

  it('se met à jour après une suppression', async () => {
    const base = await baseInput()
    const validation = await createValidation(base)
    const { result } = renderHook(() => useAllValidations())

    await waitFor(() => expect(result.current).toHaveLength(1))

    await act(async () => {
      await deleteValidation(validation.id)
    })

    await waitFor(() => expect(result.current).toEqual([]))
  })
})
