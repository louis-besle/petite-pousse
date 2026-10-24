import type { AgeBand, Objective, Section } from './types'
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
  it('exporte un référentiel validé avec les six domaines de 2026 et EVAR', () => {
    expect(validateReferential(referential)).toEqual(referential)
    expect(referential.version).toBe('2026.2.0')
    expect(referential.domains).toHaveLength(7)
    expect(referential.competencies).toHaveLength(40)
    expect(referential.objectives).toHaveLength(407)
    expect(referential.domains.map((domain) => domain.id)).toEqual([
      'langage',
      'corps',
      'arts',
      'maths',
      'temps',
      'vivant',
      'evar',
    ])
    expect(referential.domains[0].longLabel).toBe(
      'Le développement et la structuration du langage oral et écrit',
    )
  })

  it('garde des identifiants uniques dans tout le référentiel', () => {
    const ids = [
      ...referential.domains,
      ...referential.competencies,
      ...referential.objectives,
    ].map((entry) => entry.id)

    expect(new Set(ids).size).toBe(ids.length)
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
      order: 4,
    })
  })

  it('lève une erreur explicite pour un domaine inconnu', () => {
    expect(() => domainById(referential, 'musique' as never)).toThrow(/unknown domain/i)
  })
})

describe('programme EVAR', () => {
  const evarObjectives = referential.objectives.filter(
    (objective) => objective.domainId === 'evar',
  )

  it('ajoute le domaine EVAR en dernier, avec ses trois compétences', () => {
    expect(domainById(referential, 'evar')).toMatchObject({
      label: 'EVAR',
      longLabel: 'Éducation à la vie affective et relationnelle',
      order: 7,
    })
    expect(
      referential.competencies.filter((competency) => competency.domainId === 'evar'),
    ).toHaveLength(3)
  })

  it('déclare trois objectifs par tranche d’âge, avec un exemple et la source du BO', () => {
    expect(evarObjectives).toHaveLength(9)

    for (const ageBand of ['before4', 'from4', 'from5'] as const) {
      expect(
        evarObjectives.filter((objective) => objective.ageBands.includes(ageBand)),
      ).toHaveLength(3)
    }

    const pages: Record<string, number> = {
      'evar-corps-avant4': 11,
      'evar-relations-avant4': 12,
      'evar-societe-avant4': 12,
      'evar-corps-4': 13,
      'evar-relations-4': 13,
      'evar-societe-4': 14,
      'evar-corps-5': 15,
      'evar-relations-5': 15,
      'evar-societe-5': 16,
    }

    for (const objective of evarObjectives) {
      expect(objective.ageBands).toHaveLength(1)
      expect(Object.keys(objective.examples)).toEqual(objective.ageBands)
      expect(objective.source).toEqual({
        bo: 'BO n° 6 du 6 février 2025',
        page: pages[objective.id],
      })
      expect(
        objective.examples[objective.ageBands[0] as keyof typeof objective.examples],
      ).toMatch(/^(Ils |« )/)
    }
  })

  it('ne présente chaque objectif EVAR que pour la section correspondante', () => {
    const evarIdsFor = (section: Section): string[] =>
      objectivesForSection(referential, section)
        .filter((objective) => objective.domainId === 'evar')
        .map((objective) => objective.id)

    expect(evarIdsFor('PS')).toEqual([
      'evar-corps-avant4',
      'evar-relations-avant4',
      'evar-societe-avant4',
    ])
    expect(evarIdsFor('MS')).toEqual([
      'evar-corps-4',
      'evar-relations-4',
      'evar-societe-4',
    ])
    expect(evarIdsFor('GS')).toEqual([
      'evar-corps-5',
      'evar-relations-5',
      'evar-societe-5',
    ])
  })

  it('place le groupe EVAR après les six domaines du programme 2026', () => {
    const groups = referential.domains
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((domain) => domain.id)

    expect(groups.at(-1)).toBe('evar')
    expect(groups.slice(0, -1)).toHaveLength(6)

    const psObjectives = objectivesForSection(referential, 'PS')
    expect(psObjectives.slice(-3).every((objective) => objective.domainId === 'evar')).toBe(
      true,
    )
  })
})
