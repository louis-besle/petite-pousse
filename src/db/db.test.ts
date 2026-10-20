import { renderHook, waitFor } from '@testing-library/react'
import { REFERENTIAL_VERSION } from '@/domain/referential'
import { defaultSchoolYear, schoolYearIdForDate } from '@/domain/schoolYear'
import type { SchoolYear } from '@/domain/types'
import { DB_NAME, db } from './db'
import { ensureSeed, localTodayIso } from './seed'
import { getSettings, updateSettings, useSettings } from './settings'

const today = localTodayIso()
const expectedYearId = schoolYearIdForDate(today)

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
      currentSchoolYearId: expectedYearId,
      lastBackupValidationCount: 0,
      referentialVersion: REFERENTIAL_VERSION,
      schemaVersion: 1,
    })
    expect(settings).not.toHaveProperty('lastBackupAt')
  })

  it('crée l’année scolaire courante avec les bornes par défaut', async () => {
    await ensureSeed()

    expect(await db.schoolYears.get(expectedYearId)).toEqual(defaultSchoolYear(expectedYearId))
  })

  it('est idempotent et n’écrase rien', async () => {
    await ensureSeed()

    const settings = await db.settings.get('app')
    expect(settings).toBeDefined()
    await db.settings.update('app', { className: 'MS B' })

    const adjusted: SchoolYear = {
      ...defaultSchoolYear(expectedYearId),
      period1End: `${Number(expectedYearId.slice(0, 4)) + 1}-02-05`,
    }
    await db.schoolYears.put(adjusted)

    await ensureSeed()
    await ensureSeed()

    expect(await db.settings.get('app')).toEqual({ ...settings, className: 'MS B' })
    expect(await db.schoolYears.get(expectedYearId)).toEqual(adjusted)
    expect(await db.schoolYears.count()).toBe(1)
  })

  it('recrée l’année courante si la ligne a disparu sans toucher aux réglages', async () => {
    await ensureSeed()
    await db.settings.update('app', { schoolName: 'École des Lilas' })
    await db.schoolYears.delete(expectedYearId)

    await ensureSeed()

    expect(await db.schoolYears.get(expectedYearId)).toEqual(defaultSchoolYear(expectedYearId))
    expect((await db.settings.get('app'))?.schoolName).toBe('École des Lilas')
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

    expect(settings.currentSchoolYearId).toBe(expectedYearId)
    expect(settings.schemaVersion).toBe(1)
    expect(await db.schoolYears.get(settings.currentSchoolYearId)).toBeDefined()
  })
})

describe('updateSettings', () => {
  it('fusionne le patch dans les réglages existants', async () => {
    await updateSettings({ schoolName: 'École des Lilas', className: 'GS A' })

    const settings = await getSettings()
    expect(settings.schoolName).toBe('École des Lilas')
    expect(settings.className).toBe('GS A')
    expect(settings.currentSchoolYearId).toBe(expectedYearId)
    expect(settings.schemaVersion).toBe(1)
  })

  it('amorce la base si elle est vide', async () => {
    await db.delete()
    await db.open()

    await updateSettings({ teacherName: 'Mme Martin' })

    expect((await db.settings.get('app'))?.teacherName).toBe('Mme Martin')
    expect((await db.settings.get('app'))?.currentSchoolYearId).toBe(expectedYearId)
  })
})

describe('useSettings', () => {
  it('renvoie les réglages une fois la base amorcée', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.currentSchoolYearId).toBe(expectedYearId)
    expect(result.current?.schemaVersion).toBe(1)
  })
})

describe('db', () => {
  it('utilise un nom de base stable', () => {
    expect(db.name).toBe(DB_NAME)
    expect(DB_NAME).toBe('carnet-de-reussites')
  })

  it('expose les six tables du schéma', () => {
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'drafts',
      'photos',
      'schoolYears',
      'settings',
      'students',
      'validations',
    ])
  })
})
