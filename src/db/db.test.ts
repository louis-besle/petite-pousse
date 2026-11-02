import Dexie from 'dexie'
import { renderHook, waitFor } from '@testing-library/react'
import { REFERENTIAL_VERSION } from '@/domain/referential'
import { defaultSchoolYear, schoolYearIdForDate } from '@/domain/schoolYear'
import type { SchoolYear, Validation } from '@/domain/types'
import { makeStudent } from '@/test/fixtures'
import { DB_NAME, PetitePousseDB, db } from './db'
import { ensureSeed, localTodayIso } from './seed'
import { getSettings, updateSettings, useSettings } from './settings'

/** Année courante calculée au moment du test, jamais figée à l'import. */
function currentYearId(): string {
  return schoolYearIdForDate(localTodayIso())
}

/** Année scolaire précédant l'année courante. */
function previousYearId(): string {
  const startYear = Number(currentYearId().slice(0, 4)) - 1
  return `${startYear}-${startYear + 1}`
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('ensureSeed', () => {
  it('sème les réglages et l’année courante', async () => {
    await ensureSeed()

    const settings = await db.settings.get('app')
    expect(settings?.schemaVersion).toBe(1)
    expect(settings?.currentSchoolYearId).toMatch(/^\d{4}-\d{4}$/)
    expect(await db.schoolYears.get(settings!.currentSchoolYearId)).toBeDefined()
  })

  it('remplit les réglages par défaut', async () => {
    await ensureSeed()

    const settings = await db.settings.get('app')
    expect(settings).toEqual({
      id: 'app',
      schoolName: '',
      className: '',
      teacherName: '',
      currentSchoolYearId: currentYearId(),
      lastBackupValidationCount: 0,
      referentialVersion: REFERENTIAL_VERSION,
      schemaVersion: 1,
    })
    expect(settings).not.toHaveProperty('lastBackupAt')
  })

  it('crée l’année scolaire courante avec les bornes par défaut', async () => {
    await ensureSeed()

    const yearId = currentYearId()
    expect(await db.schoolYears.get(yearId)).toEqual(defaultSchoolYear(yearId))
  })

  it('est idempotent et n’écrase rien', async () => {
    await ensureSeed()

    const settings = await db.settings.get('app')
    expect(settings).toBeDefined()
    await db.settings.update('app', { className: 'MS B' })

    const yearId = currentYearId()
    const adjusted: SchoolYear = {
      ...defaultSchoolYear(yearId),
      period1End: `${Number(yearId.slice(0, 4)) + 1}-02-05`,
    }
    await db.schoolYears.put(adjusted)

    await ensureSeed()
    await ensureSeed()

    expect(await db.settings.get('app')).toEqual({ ...settings, className: 'MS B' })
    expect(await db.schoolYears.get(yearId)).toEqual(adjusted)
    expect(await db.schoolYears.count()).toBe(1)
  })

  it('recrée l’année courante si la ligne a disparu sans toucher aux réglages', async () => {
    await ensureSeed()
    const yearId = currentYearId()
    await db.settings.update('app', { schoolName: 'École des Lilas' })
    await db.schoolYears.delete(yearId)

    await ensureSeed()

    expect(await db.schoolYears.get(yearId)).toEqual(defaultSchoolYear(yearId))
    expect((await db.settings.get('app'))?.schoolName).toBe('École des Lilas')
  })

  it('crée l’année courante calculée même si les réglages pointent vers une année antérieure', async () => {
    await ensureSeed()
    const currentId = currentYearId()
    const previousId = previousYearId()

    // Réglages repris d'une année précédente : ils pointent vers l'année passée.
    await updateSettings({ currentSchoolYearId: previousId })
    await db.schoolYears.delete(currentId)

    await ensureSeed()

    expect(await db.schoolYears.get(previousId)).toBeDefined()
    expect(await db.schoolYears.get(currentId)).toEqual(defaultSchoolYear(currentId))
    // Aucun basculement silencieux : les réglages restent sur l'année choisie.
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe(previousId)
  })

  it('ne crée qu’une ligne par année quand deux amorçages partent en parallèle', async () => {
    await Promise.all([ensureSeed(), ensureSeed()])

    const yearId = currentYearId()
    expect(await db.settings.count()).toBe(1)
    expect(await db.schoolYears.where('id').equals(yearId).count()).toBe(1)
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe(yearId)
  })

  it('conserve les autres années scolaires existantes', async () => {
    const other: SchoolYear = {
      id: '1999-2000',
      start: '1999-09-01',
      period1End: '2000-01-31',
      period2End: '2000-06-30',
    }
    await db.schoolYears.put(other)

    await ensureSeed()

    expect(await db.schoolYears.get('1999-2000')).toEqual(other)
    expect(await db.schoolYears.count()).toBe(2)
  })
})

describe('localTodayIso', () => {
  it('formate la date locale sans passer par UTC', () => {
    expect(localTodayIso(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02')
    expect(localTodayIso(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31')
    expect(localTodayIso(new Date(2027, 6, 1, 12, 0))).toBe('2027-07-01')
  })
})

describe('getSettings', () => {
  it('amorce la base puis renvoie les réglages', async () => {
    const settings = await getSettings()

    expect(settings.currentSchoolYearId).toBe(currentYearId())
    expect(settings.schemaVersion).toBe(1)
    expect(await db.schoolYears.get(settings.currentSchoolYearId)).toBeDefined()
  })

  it('ne renvoie pas la clé technique id de Dexie', async () => {
    const settings = await getSettings()

    expect(settings).not.toHaveProperty('id')
    expect(settings.schoolName).toBe('')
  })
})

describe('updateSettings', () => {
  it('fusionne le patch dans les réglages existants', async () => {
    await updateSettings({ schoolName: 'École des Lilas', className: 'GS A' })

    const settings = await getSettings()
    expect(settings.schoolName).toBe('École des Lilas')
    expect(settings.className).toBe('GS A')
    expect(settings.currentSchoolYearId).toBe(currentYearId())
    expect(settings.schemaVersion).toBe(1)
  })

  it('amorce la base si elle est vide', async () => {
    await db.delete()
    await db.open()

    await updateSettings({ teacherName: 'Mme Martin' })

    expect((await db.settings.get('app'))?.teacherName).toBe('Mme Martin')
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe(currentYearId())
  })

  it('crée l’année ciblée sans l’écraser si elle existe déjà', async () => {
    await ensureSeed()
    const startYear = Number(currentYearId().slice(0, 4)) + 1
    const nextYearId = `${startYear}-${startYear + 1}`
    const adjusted: SchoolYear = {
      ...defaultSchoolYear(nextYearId),
      period1End: `${startYear + 1}-02-05`,
    }
    await db.schoolYears.put(adjusted)

    await updateSettings({ currentSchoolYearId: nextYearId })

    expect(await db.schoolYears.get(nextYearId)).toEqual(adjusted)
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe(nextYearId)
  })

  it('crée l’année ciblée par le patch si elle manque', async () => {
    await ensureSeed()
    const startYear = Number(currentYearId().slice(0, 4)) + 2
    const targetYearId = `${startYear}-${startYear + 1}`

    await updateSettings({ currentSchoolYearId: targetYearId })

    expect(await db.schoolYears.get(targetYearId)).toEqual(defaultSchoolYear(targetYearId))
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe(targetYearId)
  })
})

describe('useSettings', () => {
  it('renvoie les réglages une fois la base amorcée', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.currentSchoolYearId).toBe(currentYearId())
    expect(result.current?.schemaVersion).toBe(1)
    expect(result.current).not.toHaveProperty('id')
  })
})

describe('db', () => {
  it('utilise un nom de base stable', () => {
    expect(db.name).toBe(DB_NAME)
    expect(DB_NAME).toBe('carnet-de-reussites')
  })

  it('expose les sept tables du schéma', () => {
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'customObjectives',
      'drafts',
      'photos',
      'schoolYears',
      'settings',
      'students',
      'validations',
    ])
  })

  it('conserve les données d’une base v1 en ajoutant customObjectives', async () => {
    const name = 'carnet-de-reussites-migration-test'
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      students: 'id, section, firstName',
      schoolYears: 'id, start',
      validations:
        'id, studentId, objectiveId, date, schoolYearId, &[studentId+objectiveId]',
      photos: 'id, validationId',
      settings: 'id',
      drafts: 'id',
    })

    const student = makeStudent({ firstName: 'Léa', section: 'MS' })
    const validation: Validation = {
      id: 'validation-1',
      studentId: student.id,
      objectiveId: 'lang-vocabulaire-01',
      schoolYearId: '2026-2027',
      date: '2026-11-10',
      snapshot: {
        objectiveLabel: 'Comprendre, mémoriser et raconter',
        domainId: 'langage',
        domainLabel: 'Langage',
        ageBand: 'from4',
        example: 'Raconter une histoire entendue.',
        referentialVersion: REFERENTIAL_VERSION,
      },
      createdAt: '2026-11-10T10:00:00.000Z',
    }

    await legacy.open()
    await legacy.table('students').add(student)
    await legacy.table('validations').add(validation)
    legacy.close()

    const upgraded = new PetitePousseDB(name)

    try {
      await upgraded.open()

      expect(await upgraded.students.get(student.id)).toEqual(student)
      expect(await upgraded.validations.get(validation.id)).toEqual(validation)
      expect(upgraded.tables.map((table) => table.name)).toContain(
        'customObjectives',
      )
      expect(
        await upgraded.validations
          .where('[studentId+objectiveId]')
          .equals([student.id, validation.objectiveId])
          .count(),
      ).toBe(1)
      await expect(
        upgraded.validations.add({ ...validation, id: 'validation-2' }),
      ).rejects.toThrow()
    } finally {
      upgraded.close()
      await Dexie.delete(name)
    }
  })
})
