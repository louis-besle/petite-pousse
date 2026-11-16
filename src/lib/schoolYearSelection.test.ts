import type { SchoolYear } from '@/domain/types'
import { sortedSchoolYearIds } from './schoolYearSelection'

function makeYear(id: string): SchoolYear {
  return {
    id,
    start: `${id.slice(0, 4)}-09-01`,
    period1End: `${Number(id.slice(0, 4)) + 1}-01-31`,
    period2End: `${Number(id.slice(0, 4)) + 1}-06-30`,
  }
}

describe('sortedSchoolYearIds', () => {
  it('trie du plus récent au plus ancien', () => {
    const years = [makeYear('2024-2025'), makeYear('2026-2027'), makeYear('2025-2026')]

    expect(sortedSchoolYearIds(years)).toEqual(['2026-2027', '2025-2026', '2024-2025'])
  })

  it('ajoute l’année courante absente de la liste', () => {
    const years = [makeYear('2024-2025'), makeYear('2025-2026')]

    expect(sortedSchoolYearIds(years, '2026-2027')).toEqual([
      '2026-2027',
      '2025-2026',
      '2024-2025',
    ])
  })

  it('ne duplique pas l’année courante déjà présente', () => {
    const years = [makeYear('2025-2026'), makeYear('2026-2027')]

    expect(sortedSchoolYearIds(years, '2025-2026')).toEqual(['2026-2027', '2025-2026'])
  })
})
