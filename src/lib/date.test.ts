import {
  assertCalendarDate,
  formatLongDate,
  formatLongDateOrdinal,
  formatPeriodRange,
  formatPeriodRangeLong,
  formatShortDate,
  isCalendarDate,
  todayIso,
} from './date'

describe('isCalendarDate', () => {
  it('accepte une date calendaire réelle', () => {
    expect(isCalendarDate('2026-10-12')).toBe(true)
    expect(isCalendarDate('2028-02-29')).toBe(true)
  })

  it('refuse un jour inexistant', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2027-02-29')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
  })

  it('refuse un autre format de date', () => {
    expect(isCalendarDate('12/10/2026')).toBe(false)
  })

  it('refuse une chaîne vide', () => {
    expect(isCalendarDate('')).toBe(false)
  })

  it('refuse une valeur qui n’est pas une chaîne', () => {
    expect(isCalendarDate(20261012)).toBe(false)
    expect(isCalendarDate(undefined)).toBe(false)
    expect(isCalendarDate(null)).toBe(false)
  })
})

describe('assertCalendarDate', () => {
  it('retourne la valeur quand la date est valide', () => {
    expect(assertCalendarDate('2026-10-12')).toBe('2026-10-12')
  })

  it('nomme le champ fautif quand `field` est fourni', () => {
    expect(() => assertCalendarDate('2026-02-30', 'period1End')).toThrow(
      'Date invalide pour period1End : "2026-02-30". Format attendu YYYY-MM-DD.',
    )
  })

  it('garde le message générique sans `field`', () => {
    expect(() => assertCalendarDate('12/10/2026')).toThrow(
      'Date invalide : "12/10/2026". Format attendu YYYY-MM-DD (ex. 2026-10-12).',
    )
  })
})

describe('formatShortDate', () => {
  it('formate une date ISO en jour et mois abrégé français', () => {
    expect(formatShortDate('2026-10-12')).toBe('12 oct.')
  })

  it('garde le point des mois abrégés qui en ont un', () => {
    expect(formatShortDate('2026-01-03')).toBe('3 janv.')
  })

  it('refuse une date mal formée ou inexistante', () => {
    expect(() => formatShortDate('2026/10/12')).toThrow(/date/i)
    expect(() => formatShortDate('2026-02-30')).toThrow(/date/i)
    expect(() => formatShortDate('')).toThrow(/date/i)
  })
})

describe('formatLongDate', () => {
  it('formate une date ISO en jour, mois et année en français', () => {
    expect(formatLongDate('2026-10-12')).toBe('12 octobre 2026')
  })

  it('refuse une date mal formée ou inexistante', () => {
    expect(() => formatLongDate('2026-13-01')).toThrow(/date/i)
    expect(() => formatLongDate('12/10/2026')).toThrow(/date/i)
  })
})

describe('formatPeriodRange', () => {
  it('rend une période sur une année civile', () => {
    expect(formatPeriodRange('2026-09-01', '2027-01-31')).toBe('1 sept. 2026 → 31 janv. 2027')
  })

  it('garde l’année de chaque borne', () => {
    expect(formatPeriodRange('2026-10-12', '2026-12-15')).toBe('12 oct. 2026 → 15 déc. 2026')
  })

  it('refuse une borne mal formée ou inexistante', () => {
    expect(() => formatPeriodRange('2026-09-01', '2027-02-30')).toThrow(/date/i)
    expect(() => formatPeriodRange('01/09/2026', '2027-01-31')).toThrow(/date/i)
  })
})

describe('formatPeriodRangeLong', () => {
  it('rend une période avec les prépositions françaises', () => {
    expect(formatPeriodRangeLong('2026-09-01', '2027-01-31')).toBe(
      'Du 1 sept. 2026 au 31 janv. 2027',
    )
  })

  it('fonctionne quand les deux bornes sont dans la même année', () => {
    expect(formatPeriodRangeLong('2026-10-12', '2026-12-15')).toBe(
      'Du 12 oct. 2026 au 15 déc. 2026',
    )
  })

  it('refuse une borne mal formée ou inexistante', () => {
    expect(() => formatPeriodRangeLong('2026-09-01', '2027-13-01')).toThrow(/date/i)
    expect(() => formatPeriodRangeLong('', '2027-01-31')).toThrow(/date/i)
  })
})

describe('formatLongDateOrdinal', () => {
  it('écrit le 1er en ordinal', () => {
    expect(formatLongDateOrdinal('2026-09-01')).toBe('1er septembre 2026')
  })

  it('laisse les autres jours en cardinal', () => {
    expect(formatLongDateOrdinal('2026-10-12')).toBe('12 octobre 2026')
  })

  it('refuse une date mal formée ou inexistante', () => {
    expect(() => formatLongDateOrdinal('2026-02-30')).toThrow(/date/i)
    expect(() => formatLongDateOrdinal('2026/09/01')).toThrow(/date/i)
  })
})

describe('todayIso', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rend la date locale du jour au format YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 12, 23, 30, 15))

    expect(todayIso()).toBe('2026-10-12')
  })

  it('respecte la forme YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
