import type { AgeBand, Objective } from './types'
import {
  ageBandForSection,
  domainById,
  objectivesForSection,
  referential,
  validateReferential,
} from './referential'

function objective(
  id: string,
  ageBands: AgeBand[],
  examples: Partial<Record<AgeBand, string>> = Object.fromEntries(
    ageBands.map((band) => [band, `Exemple ${band}`]),
  ),
): Objective {
  return {
    id,
    competencyId: 'comp-test-langage',
    domainId: 'langage',
    label: `Objectif ${id}`,
    ageBands,
    examples,
    source: { bo: 'BO n°19 du 7 mai 2026' },
  }
}

function miniReferential(objectives: Objective[]) {
  return {
    version: '2026.0.0',
    domains: referential.domains,
    competencies: [
      { id: 'comp-test-langage', domainId: 'langage' as const, label: 'Compétence de test' },
    ],
    objectives,
  }
}

describe('referential', () => {
  it('exporte un référentiel validé avec les six domaines officiels', () => {
    expect(validateReferential(referential)).toEqual(referential)
    expect(referential.version).toBe('2026.0.0')
    expect(referential.competencies).toEqual([])
    expect(referential.objectives).toEqual([])
    expect(referential.domains.map((domain) => domain.id)).toEqual([
      'langage',
      'maths',
      'corps',
      'arts',
      'temps',
      'vivant',
    ])
    expect(referential.domains[0].longLabel).toBe(
      'Le développement et la structuration du langage oral et écrit',
    )
  })

  it('accepte une liste d’objectifs vide', () => {
    expect(validateReferential(miniReferential([])).objectives).toEqual([])
  })

  it('rejette un identifiant d’objectif dupliqué', () => {
    expect(() =>
      validateReferential(miniReferential([objective('obj-1', ['before4']), objective('obj-1', ['from4'])])),
    ).toThrow(/duplicate objective id/i)
  })

  it('rejette une tranche déclarée sans exemple', () => {
    expect(() =>
      validateReferential(miniReferential([objective('obj-1', ['before4', 'from4'], { before4: 'x' })])),
    ).toThrow(/missing an example/i)
  })

  it('rejette un objectif dont la compétence est absente du référentiel', () => {
    const orphan = { ...objective('obj-1', ['before4']), competencyId: 'comp-inconnue' }

    expect(() => validateReferential(miniReferential([orphan]))).toThrow(/unknown competency id/i)
  })
})

describe('ageBandForSection', () => {
  it.each([
    ['PS', 'before4'],
    ['MS', 'from4'],
    ['GS', 'from5'],
  ] as const)('associe %s à %s', (section, expected) => {
    expect(ageBandForSection(section)).toBe(expected)
  })
})

describe('objectivesForSection', () => {
  const ref = validateReferential(
    miniReferential([
      objective('obj-before4', ['before4', 'from4']),
      objective('obj-from4', ['from4']),
      objective('obj-from5', ['from5']),
    ]),
  )

  it('filtre les objectifs de la tranche d’âge de la section', () => {
    expect(objectivesForSection(ref, 'PS').map((item) => item.id)).toEqual(['obj-before4'])
    expect(objectivesForSection(ref, 'MS').map((item) => item.id)).toEqual([
      'obj-before4',
      'obj-from4',
    ])
    expect(objectivesForSection(ref, 'GS').map((item) => item.id)).toEqual(['obj-from5'])
  })
})

describe('domainById', () => {
  it('retourne le domaine demandé', () => {
    expect(domainById(referential, 'maths')).toMatchObject({
      id: 'maths',
      label: 'Maths',
      order: 2,
    })
  })

  it('lève une erreur explicite pour un domaine inconnu', () => {
    expect(() => domainById(referential, 'musique' as never)).toThrow(/unknown domain/i)
  })
})
