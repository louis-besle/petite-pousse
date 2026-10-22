import { fitDimensions } from './image'

describe('fitDimensions', () => {
  it('réduit une image paysage en conservant le rapport d’aspect', () => {
    expect(fitDimensions(2000, 1000, 1600)).toEqual({ width: 1600, height: 800 })
  })

  it('réduit une image portrait en conservant le rapport d’aspect', () => {
    expect(fitDimensions(1000, 2000, 1600)).toEqual({ width: 800, height: 1600 })
  })

  it('laisse une image déjà assez petite inchangée', () => {
    expect(fitDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('refuse des dimensions nulles, négatives ou non finies', () => {
    expect(() => fitDimensions(0, 600, 1600)).toThrow(/dimensions/i)
    expect(() => fitDimensions(800, -1, 1600)).toThrow(/dimensions/i)
    expect(() => fitDimensions(Number.NaN, 600, 1600)).toThrow(/dimensions/i)
    expect(() => fitDimensions(800, 600, 0)).toThrow(/taille maximale/i)
  })
})
