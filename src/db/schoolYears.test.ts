import { renderHook, waitFor } from '@testing-library/react'
import { REFERENTIAL_VERSION } from '@/domain/referential'
import { defaultSchoolYear } from '@/domain/schoolYear'
import type { Objective, SchoolYear } from '@/domain/types'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { db } from './db'
import {
  getOrCreateSchoolYear,
  startNextSchoolYear,
  updateSchoolYearPeriods,
  useSchoolYears,
} from './schoolYears'
import { createValidation } from './validations'

const objective: Objective = {
  id: 'obj-annee',
  competencyId: 'comp-langage-1',
  domainId: 'langage',
  label: 'Dire de mémoire un texte court',
  ageBands: ['from4'],
  examples: { from4: 'Réciter une comptine' },
  source: { bo: 'BO 2026' },
}

describe('getOrCreateSchoolYear', () => {
  it('crée l’année de la date avec les bornes par défaut', async () => {
    const year = await getOrCreateSchoolYear('2026-10-12')

    expect(year).toEqual(defaultSchoolYear('2026-2027'))
    expect(await db.schoolYears.get('2026-2027')).toEqual(year)
  })

  it('est idempotent et ne réécrit pas une année existante', async () => {
    const adjusted: SchoolYear = {
      ...defaultSchoolYear('2026-2027'),
      period1End: '2027-02-05',
    }
    await db.schoolYears.put(adjusted)

    const first = await getOrCreateSchoolYear('2026-10-12')
    const second = await getOrCreateSchoolYear('2027-01-20')

    expect(first).toEqual(adjusted)
    expect(second).toEqual(adjusted)
    expect(await db.schoolYears.count()).toBe(1)
    expect(await db.schoolYears.get('2026-2027')).toEqual(adjusted)
  })

  it('rattache juillet à l’année scolaire précédente', async () => {
    const year = await getOrCreateSchoolYear('2027-07-15')

    expect(year.id).toBe('2026-2027')
    expect(await db.schoolYears.get('2026-2027')).toEqual(defaultSchoolYear('2026-2027'))
  })
})

describe('updateSchoolYearPeriods', () => {
  it('ne modifie que l’année ciblée', async () => {
    const target = makeSchoolYear()
    const untouched = makeSchoolYear({
      id: '2025-2026',
      start: '2025-09-01',
      period1End: '2026-01-31',
      period2End: '2026-06-30',
    })
    await db.schoolYears.bulkPut([target, untouched])

    await updateSchoolYearPeriods('2026-2027', { period1End: '2027-02-05' })

    expect(await db.schoolYears.get('2026-2027')).toEqual({
      ...target,
      period1End: '2027-02-05',
    })
    expect(await db.schoolYears.get('2025-2026')).toEqual(untouched)
    expect(await db.schoolYears.count()).toBe(2)
  })

  it('accepte les deux bornes dans le même appel', async () => {
    await db.schoolYears.put(makeSchoolYear())

    await updateSchoolYearPeriods('2026-2027', {
      period1End: '2027-02-05',
      period2End: '2027-07-05',
    })

    expect(await db.schoolYears.get('2026-2027')).toEqual({
      ...makeSchoolYear(),
      period1End: '2027-02-05',
      period2End: '2027-07-05',
    })
  })

  it('refuse un ordre incohérent sans rien modifier', async () => {
    const year = makeSchoolYear()
    await db.schoolYears.put(year)

    await expect(
      updateSchoolYearPeriods('2026-2027', { period1End: '2026-08-01' }),
    ).rejects.toThrow(/start/i)
    await expect(
      updateSchoolYearPeriods('2026-2027', { period2End: '2027-01-01' }),
    ).rejects.toThrow(/start/i)

    expect(await db.schoolYears.get('2026-2027')).toEqual(year)
  })

  it('refuse une date mal formée', async () => {
    const year = makeSchoolYear()
    await db.schoolYears.put(year)

    await expect(
      updateSchoolYearPeriods('2026-2027', { period1End: '2027-02-31' }),
    ).rejects.toThrow(/date/i)
    await expect(
      updateSchoolYearPeriods('2026-2027', { period2End: '30/06/2027' }),
    ).rejects.toThrow(/date/i)

    expect(await db.schoolYears.get('2026-2027')).toEqual(year)
  })

  it('refuse une année inconnue', async () => {
    await expect(
      updateSchoolYearPeriods('2099-2100', { period1End: '2100-02-05' }),
    ).rejects.toThrow('Année scolaire introuvable.')
  })
})

describe('startNextSchoolYear', () => {
  it('crée l’année suivante et bascule les réglages sans rien supprimer', async () => {
    const student = makeStudent()
    await db.students.add(student)

    const validation = await createValidation({
      studentId: student.id,
      objective,
      ageBand: 'from4',
      date: '2026-10-12',
      referentialVersion: REFERENTIAL_VERSION,
      photo: {
        full: new Blob(['pleine'], { type: 'image/jpeg' }),
        thumb: new Blob(['vignette'], { type: 'image/jpeg' }),
        width: 800,
        height: 600,
        mime: 'image/jpeg',
      },
    })

    const next = await startNextSchoolYear('2026-2027')

    expect(next).toEqual(defaultSchoolYear('2027-2028'))
    expect(await db.schoolYears.get('2027-2028')).toEqual(next)
    expect(await db.schoolYears.get('2026-2027')).toBeDefined()
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe('2027-2028')

    expect(await db.students.get(student.id)).toBeDefined()
    expect(await db.validations.get(validation.id)).toBeDefined()
    expect(await db.photos.get(validation.photoId!)).toBeDefined()
  })

  it('bascule vers une année existante sans écraser ses bornes', async () => {
    const existing: SchoolYear = {
      ...defaultSchoolYear('2027-2028'),
      period1End: '2028-02-05',
    }
    await db.schoolYears.put(existing)

    const next = await startNextSchoolYear('2026-2027')

    expect(next).toEqual(existing)
    expect(await db.schoolYears.get('2027-2028')).toEqual(existing)
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe('2027-2028')
  })

  it('est idempotent quand on repasse par la même année courante', async () => {
    await startNextSchoolYear('2026-2027')
    const again = await startNextSchoolYear('2026-2027')

    expect(again.id).toBe('2027-2028')
    expect(await db.schoolYears.where('id').equals('2027-2028').count()).toBe(1)
  })
})

describe('useSchoolYears', () => {
  it('renvoie les années de la plus récente à la plus ancienne', async () => {
    await db.schoolYears.bulkPut([
      makeSchoolYear(),
      makeSchoolYear({
        id: '2025-2026',
        start: '2025-09-01',
        period1End: '2026-01-31',
        period2End: '2026-06-30',
      }),
    ])

    const { result } = renderHook(() => useSchoolYears())

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current?.map((year) => year.id)).toEqual(['2026-2027', '2025-2026'])
  })
})
