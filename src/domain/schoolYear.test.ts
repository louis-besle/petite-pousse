import type { SchoolYear } from './types'
import {
  defaultSchoolYear,
  nextSchoolYearId,
  periodForDate,
  periodRange,
  resolveCurrentSchoolYearId,
  schoolYearIdForDate,
} from './schoolYear'

const year2026: SchoolYear = {
  id: '2026-2027',
  start: '2026-09-01',
  period1End: '2027-01-31',
  period2End: '2027-06-30',
}

const year2027: SchoolYear = {
  id: '2027-2028',
  start: '2027-09-01',
  period1End: '2028-01-31',
  period2End: '2028-06-30',
}

const year2025: SchoolYear = {
  id: '2025-2026',
  start: '2025-09-01',
  period1End: '2026-01-31',
  period2End: '2026-06-30',
}

describe('schoolYearIdForDate', () => {
  it('rattache septembre à la nouvelle année et juillet à la précédente', () => {
    expect(schoolYearIdForDate('2026-09-01')).toBe('2026-2027')
    expect(schoolYearIdForDate('2027-01-31')).toBe('2026-2027')
    expect(schoolYearIdForDate('2027-07-15')).toBe('2026-2027')
    expect(schoolYearIdForDate('2027-09-01')).toBe('2027-2028')
  })

  it('garde juin et août dans l’année scolaire en cours', () => {
    expect(schoolYearIdForDate('2027-06-30')).toBe('2026-2027')
    expect(schoolYearIdForDate('2027-08-31')).toBe('2026-2027')
  })

  it('refuse une date mal formée', () => {
    expect(() => schoolYearIdForDate('2026/09/01')).toThrow(/date/i)
    expect(() => schoolYearIdForDate('2026-13-01')).toThrow(/date/i)
    expect(() => schoolYearIdForDate('')).toThrow(/date/i)
  })
})

describe('defaultSchoolYear', () => {
  it('commence le 1er septembre et coupe aux 31 janvier et 30 juin', () => {
    expect(defaultSchoolYear('2026-2027')).toEqual({
      id: '2026-2027',
      start: '2026-09-01',
      period1End: '2027-01-31',
      period2End: '2027-06-30',
    })
  })

  it('refuse un identifiant d’année mal formé', () => {
    expect(() => defaultSchoolYear('2026')).toThrow(/année|year/i)
    expect(() => defaultSchoolYear('2026-2028')).toThrow(/année|year/i)
    expect(() => defaultSchoolYear('26-27')).toThrow(/année|year/i)
  })
})

describe('nextSchoolYearId', () => {
  it('passe à l’année suivante', () => {
    expect(nextSchoolYearId('2026-2027')).toBe('2027-2028')
    expect(nextSchoolYearId('2029-2030')).toBe('2030-2031')
  })

  it('refuse un identifiant mal formé', () => {
    expect(() => nextSchoolYearId('2026')).toThrow(/année|year/i)
  })
})

describe('resolveCurrentSchoolYearId', () => {
  // Toujours trié du plus récent au plus ancien, comme `useSchoolYears`.
  const years: SchoolYear[] = [year2027, year2026, year2025]

  it('garde l’année préférée quand elle contient la date', () => {
    expect(
      resolveCurrentSchoolYearId(years, '2026-2027', '2026-11-07'),
    ).toBe('2026-2027')
  })

  it('suit l’année de la date quand l’année préférée est en avance', () => {
    expect(
      resolveCurrentSchoolYearId(years, '2027-2028', '2026-11-07'),
    ).toBe('2026-2027')
  })

  it('garde l’année préférée en retard quand la date tombe dans le creux de juillet', () => {
    // Juillet n'appartient à aucune borne [start, period2End] : on retombe sur
    // l'année de `schoolYearIdForDate`, ici l'année préférée.
    expect(
      resolveCurrentSchoolYearId(years, '2025-2026', '2026-07-15'),
    ).toBe('2025-2026')
  })

  it('rattache juillet à l’année de la date même quand l’année préférée est en avance', () => {
    // Une réussite du 15 juillet 2027 est classée en 2026-2027, pas dans
    // l'année 2027-2028 que les réglages ont ouverte en avance.
    expect(
      resolveCurrentSchoolYearId(years, '2027-2028', '2027-07-15'),
    ).toBe('2026-2027')
  })

  it('suit l’année qui contient la date sans préférence', () => {
    expect(resolveCurrentSchoolYearId(years, undefined, '2026-11-07')).toBe(
      '2026-2027',
    )
  })

  it('retombe sur la première année sans préférence ni année contenante', () => {
    expect(resolveCurrentSchoolYearId([year2026], undefined, '2027-07-15')).toBe(
      '2026-2027',
    )
    expect(resolveCurrentSchoolYearId([], undefined, '2026-11-07')).toBeUndefined()
  })

  it('refuse une date mal formée', () => {
    expect(() =>
      resolveCurrentSchoolYearId(years, undefined, '07/11/2026'),
    ).toThrow(/date/i)
  })
})

describe('periodForDate', () => {
  it('découpe les deux bilans', () => {
    expect(periodForDate('2026-09-01', year2026)).toBe(1)
    expect(periodForDate('2027-01-31', year2026)).toBe(1)
    expect(periodForDate('2027-02-01', year2026)).toBe(2)
    expect(periodForDate('2027-06-30', year2026)).toBe(2)
    expect(periodForDate('2027-07-01', year2026)).toBeNull()
  })

  it('reste juste hors de l’année scolaire', () => {
    expect(periodForDate('2026-08-31', year2026)).toBeNull()
  })

  it('suit une date de changement de semestre personnalisée', () => {
    const adjusted: SchoolYear = { ...year2026, period1End: '2027-02-05' }
    expect(periodForDate('2027-02-05', adjusted)).toBe(1)
    expect(periodForDate('2027-02-06', adjusted)).toBe(2)
    expect(periodForDate('2027-01-31', adjusted)).toBe(1)
  })

  it('refuse une date mal formée', () => {
    expect(() => periodForDate('01/02/2027', year2026)).toThrow(/date/i)
  })
})

describe('periodRange', () => {
  it('retourne les bornes des deux bilans', () => {
    expect(periodRange(year2026, 1)).toEqual({ start: '2026-09-01', end: '2027-01-31' })
    expect(periodRange(year2026, 2)).toEqual({ start: '2027-02-01', end: '2027-06-30' })
  })

  it('commence le deuxième bilan le lendemain de la date personnalisée', () => {
    const adjusted: SchoolYear = { ...year2026, period1End: '2027-02-05' }
    expect(periodRange(adjusted, 2)).toEqual({ start: '2027-02-06', end: '2027-06-30' })
  })

  it('franchit correctement les fins d’année et les années bissextiles', () => {
    expect(periodRange({ ...year2026, period1End: '2026-12-31' }, 2).start).toBe('2027-01-01')

    const leapYear: SchoolYear = {
      id: '2027-2028',
      start: '2027-09-01',
      period1End: '2028-02-28',
      period2End: '2028-06-30',
    }
    expect(periodRange(leapYear, 2).start).toBe('2028-02-29')
  })
})
