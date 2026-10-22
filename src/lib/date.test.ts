import { formatLongDate, formatShortDate, todayIso } from './date'

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
