import { referential } from './referential'
import { CUSTOM_OBJECTIVE_SOURCE, isCustomObjective, mergeObjectives } from './objectives'
import type { CustomObjective, Objective } from './types'

function custom(overrides: Partial<CustomObjective> = {}): CustomObjective {
  return {
    id: 'custom-1',
    competencyId: 'custom',
    domainId: 'maths',
    label: 'Compter jusqu’à douze',
    ageBands: ['from4'],
    examples: { from4: 'Réciter la comptine jusqu’à douze.' },
    source: CUSTOM_OBJECTIVE_SOURCE,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  }
}

const official: Objective[] = referential.objectives.slice(0, 3)

describe('isCustomObjective', () => {
  it('reconnaît le préfixe des objectifs ajoutés', () => {
    expect(isCustomObjective(custom())).toBe(true)
    expect(isCustomObjective(official[0]!)).toBe(false)
  })
})

describe('mergeObjectives', () => {
  it('garde les officiels dans l’ordre puis ajoute les personnalisés par date', () => {
    const late = custom({ id: 'custom-b', createdAt: '2026-11-03T09:00:00.000Z' })
    const early = custom({ id: 'custom-a', createdAt: '2026-11-02T09:00:00.000Z' })

    const merged = mergeObjectives(official, [late, early])

    expect(merged.slice(0, official.length)).toEqual(official)
    expect(merged.slice(official.length).map((objective) => objective.id)).toEqual([
      'custom-a',
      'custom-b',
    ])
  })

  it('départage deux dates identiques par identifiant', () => {
    const sameDate = '2026-11-02T09:00:00.000Z'
    const b = custom({ id: 'custom-b', createdAt: sameDate })
    const a = custom({ id: 'custom-a', createdAt: sameDate })

    expect(
      mergeObjectives([], [b, a]).map((objective) => objective.id),
    ).toEqual(['custom-a', 'custom-b'])
  })

  it('ne modifie pas les tableaux reçus', () => {
    const incoming = [custom({ id: 'custom-b' }), custom({ id: 'custom-a' })]
    const before = incoming.map((objective) => objective.id)

    mergeObjectives(official, incoming)

    expect(incoming.map((objective) => objective.id)).toEqual(before)
    expect(official).toEqual(referential.objectives.slice(0, 3))
  })
})
