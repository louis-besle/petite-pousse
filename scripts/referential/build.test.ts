// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildReferentialFromCsv } from './build'

const fixtureCsv = readFileSync(
  new URL('./__fixtures__/objectives.csv', import.meta.url),
  'utf8',
)

describe('buildReferentialFromCsv', () => {
  it('construit un référentiel valide depuis un CSV de trois objectifs', () => {
    const referential = buildReferentialFromCsv(fixtureCsv)

    expect(referential.version).not.toBe('')
    expect(referential.objectives).toHaveLength(3)
    expect(referential.objectives.map((objective) => objective.id)).toEqual([
      'obj-test-1',
      'obj-test-2',
      'obj-test-3',
    ])

    expect(referential.domains.map((domain) => domain.id)).toEqual([
      'langage',
      'corps',
      'arts',
      'maths',
      'temps',
      'vivant',
    ])

    expect(referential.competencies).toHaveLength(2)
    expect(referential.competencies.map((competency) => competency.id)).toEqual([
      'comp-test-langage',
      'comp-test-maths',
    ])

    const [first, second, third] = referential.objectives
    expect(first).toMatchObject({
      competencyId: 'comp-test-langage',
      domainId: 'langage',
      label: 'Objectif de test 1',
      ageBands: ['before4', 'from4'],
      examples: {
        before4: 'Exemple de test avant 4 ans',
        from4: 'Exemple de test à partir de 4 ans',
      },
      source: { bo: 'BO n°19 du 7 mai 2026', page: 12 },
    })
    expect(second.examples.from5).toBe('Exemple de test à partir de 5 ans')
    expect(third.domainId).toBe('maths')
    expect(third.source.page).toBeUndefined()
  })

  it('rejette un identifiant d’objectif dupliqué', () => {
    const duplicated = `${fixtureCsv}\n${fixtureCsv.split('\n')[1]}`

    expect(() => buildReferentialFromCsv(duplicated)).toThrow(/duplicate objective id/i)
  })

  it('rejette une tranche d’âge déclarée sans exemple', () => {
    const withoutExample = fixtureCsv.replace('Exemple de test avant 4 ans', '')

    expect(() => buildReferentialFromCsv(withoutExample)).toThrow(/missing example/i)
  })

  it('rejette un domaine inconnu', () => {
    const unknownDomain = fixtureCsv.replace('obj-test-3,maths', 'obj-test-3,musique')

    expect(() => buildReferentialFromCsv(unknownDomain)).toThrow(/unknown domain id/i)
  })

  it('rejette une compétence dont l’identifiant change de domaine ou d’intitulé', () => {
    const conflicting = fixtureCsv.replace(
      ',Compétence de test en langage,Objectif de test 2,',
      ',Compétence de test renommée,Objectif de test 2,',
    )

    expect(() => buildReferentialFromCsv(conflicting)).toThrow(/competency .*conflict/i)
  })

  it('rejette un intitulé d’objectif vide', () => {
    const withoutLabel = fixtureCsv.replace(',Objectif de test 3,', ',,')

    expect(() => buildReferentialFromCsv(withoutLabel)).toThrow(/objective_label/i)
  })

  it('rejette une source BO absente', () => {
    const withoutBo = fixtureCsv.replace(',BO n°19 du 7 mai 2026,12', ',,12')

    expect(() => buildReferentialFromCsv(withoutBo)).toThrow(/source_bo/i)
  })

  it('rejette une page de source non numérique', () => {
    const badPage = fixtureCsv.replace('BO n°19 du 7 mai 2026,12', 'BO n°19 du 7 mai 2026,douze')

    expect(() => buildReferentialFromCsv(badPage)).toThrow(/source_page/i)
  })

  it('rejette une tranche d’âge inconnue', () => {
    const badBand = fixtureCsv.replace('before4|from4', 'before4|from6')

    expect(() => buildReferentialFromCsv(badBand)).toThrow(/unknown age band/i)
  })

  it('rejette une tranche d’âge dupliquée', () => {
    const duplicatedBand = fixtureCsv.replace('before4|from4', 'before4|before4')

    expect(() => buildReferentialFromCsv(duplicatedBand)).toThrow(/duplicate age band/i)
  })

  it('rejette un exemple renseigné pour une tranche non déclarée', () => {
    const undeclaredExample = fixtureCsv.replace(
      ',from4|from5,,Exemple de test à partir de 4 ans',
      ',from4|from5,Exemple non déclaré,Exemple de test à partir de 4 ans',
    )

    expect(() => buildReferentialFromCsv(undeclaredExample)).toThrow(/example_before4/)
  })

  it('signale les colonnes manquantes', () => {
    const missingColumn = fixtureCsv.replace('source_page', 'page_source')

    expect(() => buildReferentialFromCsv(missingColumn)).toThrow(/source_page/)
  })

  it('accepte un CSV sans objectif', () => {
    const headerOnly = fixtureCsv.split('\n')[0]

    const referential = buildReferentialFromCsv(headerOnly)

    expect(referential.objectives).toEqual([])
    expect(referential.competencies).toEqual([])
  })
})
