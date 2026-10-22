import {
  buildBilanModel,
  countValidationsInPeriod,
  countValidationsMovedByCutover,
} from './bilan'
import { referential } from './referential'
import type {
  AgeBand,
  Domain,
  Photo,
  SchoolYear,
  Student,
  Validation,
} from './types'

const year: SchoolYear = {
  id: '2026-2027',
  start: '2026-09-01',
  period1End: '2027-01-31',
  period2End: '2027-06-30',
}

const lea: Student = {
  id: 'student-lea',
  firstName: 'Léa',
  section: 'MS',
  createdAt: '2026-09-01T08:00:00.000Z',
}

interface ValidationOverrides {
  id: string
  studentId?: string
  date: string
  domainId?: Domain['id']
  domainLabel?: string
  objectiveLabel?: string
  ageBand?: AgeBand
  example?: string
  photoId?: string
}

function makeValidation(overrides: ValidationOverrides): Validation {
  const {
    id,
    studentId = lea.id,
    date,
    domainId = 'langage',
    domainLabel = 'Langage',
    objectiveLabel = 'Objectif de test',
    ageBand = 'from4',
    example,
    photoId,
  } = overrides

  return {
    id,
    studentId,
    objectiveId: `objective-${id}`,
    schoolYearId: year.id,
    date,
    ...(photoId === undefined ? {} : { photoId }),
    snapshot: {
      objectiveLabel,
      domainId,
      domainLabel,
      ageBand,
      ...(example === undefined ? {} : { example }),
      referentialVersion: referential.version,
    },
    createdAt: '2026-09-01T08:00:00.000Z',
  }
}

function makePhoto(id: string, validationId: string): Photo {
  return {
    id,
    validationId,
    full: new Blob(['full'], { type: 'image/jpeg' }),
    thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
    width: 800,
    height: 600,
    mime: 'image/jpeg',
    createdAt: '2026-10-01T08:00:00.000Z',
  }
}

describe('buildBilanModel', () => {
  it('groupe par domaine officiel, trie les entrées et porte photo, âge et exemple', () => {
    const photo = makePhoto('photo-1', 'v1')
    const validations: Validation[] = [
      makeValidation({
        id: 'v1',
        date: '2026-10-12',
        objectiveLabel: 'Bravo',
        ageBand: 'from5',
        example: 'Un exemple observé',
        photoId: photo.id,
      }),
      makeValidation({
        id: 'v2',
        date: '2026-09-10',
        objectiveLabel: 'Alpha',
      }),
      makeValidation({
        id: 'v3',
        date: '2026-10-12',
        objectiveLabel: 'Alpha bis',
      }),
      makeValidation({
        id: 'v4',
        date: '2026-10-05',
        domainId: 'maths',
        domainLabel: 'Maths',
        objectiveLabel: 'Comparer des quantités',
      }),
      makeValidation({
        id: 'v5',
        date: '2026-09-20',
        domainId: 'musique' as Domain['id'],
        domainLabel: 'Musique',
        objectiveLabel: 'Chanter une comptine',
      }),
      // Hors période et autre élève : jamais inclus.
      makeValidation({ id: 'v6', date: '2027-02-01' }),
      makeValidation({ id: 'v7', date: '2026-10-12', studentId: 'student-adam' }),
    ]

    const model = buildBilanModel({
      student: lea,
      year,
      period: 1,
      validations,
      photos: new Map([[photo.id, photo]]),
      referential,
    })

    expect(model.student).toBe(lea)
    expect(model.year).toBe(year)
    expect(model.period).toBe(1)
    expect(model.start).toBe('2026-09-01')
    expect(model.end).toBe('2027-01-31')
    expect(model.total).toBe(5)

    // Ordre officiel des domaines, puis domaine retiré en dernier.
    expect(model.domains.map((group) => group.domain.id)).toEqual([
      'langage',
      'maths',
      'musique',
    ])
    // Aucun domaine vide.
    expect(model.domains.every((group) => group.entries.length > 0)).toBe(true)

    const langage = model.domains[0]
    expect(langage?.domain.label).toBe('Langage')
    // Dates croissantes, puis intitulé pour une même date.
    expect(langage?.entries.map((entry) => entry.validationId)).toEqual([
      'v2',
      'v3',
      'v1',
    ])

    const first = langage?.entries[2]
    expect(first).toMatchObject({
      validationId: 'v1',
      objectiveLabel: 'Bravo',
      domainId: 'langage',
      domainLabel: 'Langage',
      date: '2026-10-12',
      ageBand: 'from5',
      example: 'Un exemple observé',
    })
    expect(first?.photo).toBe(photo)
    // Une entrée sans photo ni exemple n'invente aucune valeur.
    expect(langage?.entries[0]?.photo).toBeUndefined()
    expect(langage?.entries[0]?.example).toBeUndefined()
  })

  it('reprend un domaine retiré du référentiel depuis l’instantané, en dernier', () => {
    const model = buildBilanModel({
      student: lea,
      year,
      period: 1,
      validations: [
        makeValidation({
          id: 'v1',
          date: '2026-10-12',
          domainId: 'musique' as Domain['id'],
          domainLabel: 'Musique et rythmes',
          objectiveLabel: 'Jouer du tambourin',
        }),
      ],
      photos: new Map(),
      referential,
    })

    expect(model.domains).toHaveLength(1)
    expect(model.domains[0]?.domain).toEqual({
      id: 'musique',
      label: 'Musique et rythmes',
      longLabel: 'Musique et rythmes',
      order: 99,
    })
    expect(model.domains[0]?.entries[0]?.domainLabel).toBe('Musique et rythmes')
  })

  it('borne le deuxième bilan au lendemain de la date de changement', () => {
    const adjusted: SchoolYear = { ...year, period1End: '2027-02-05' }
    const model = buildBilanModel({
      student: lea,
      year: adjusted,
      period: 2,
      validations: [
        makeValidation({ id: 'v1', date: '2027-02-05' }),
        makeValidation({ id: 'v2', date: '2027-02-06' }),
      ],
      photos: new Map(),
      referential,
    })

    expect(model.start).toBe('2027-02-06')
    expect(model.end).toBe('2027-06-30')
    expect(model.total).toBe(1)
    expect(model.domains[0]?.entries[0]?.validationId).toBe('v2')
  })
})

describe('countValidationsInPeriod', () => {
  const validations = [
    makeValidation({ id: 'start', date: '2026-09-01' }),
    makeValidation({ id: 'cutover', date: '2027-01-31' }),
    makeValidation({ id: 'second', date: '2027-02-01' }),
    makeValidation({ id: 'end', date: '2027-06-30' }),
    makeValidation({ id: 'july', date: '2027-07-01' }),
  ]

  it('compte les bornes incluses de chaque bilan', () => {
    expect(countValidationsInPeriod(validations, year, 1)).toBe(2)
    expect(countValidationsInPeriod(validations, year, 2)).toBe(2)
  })

  it('suit une date de changement personnalisée', () => {
    const adjusted: SchoolYear = { ...year, period1End: '2027-01-15' }
    expect(countValidationsInPeriod(validations, adjusted, 1)).toBe(1)
    expect(countValidationsInPeriod(validations, adjusted, 2)).toBe(3)
  })
})

describe('countValidationsMovedByCutover', () => {
  const validations = [
    makeValidation({ id: 'before', date: '2026-09-01' }),
    makeValidation({ id: 'january', date: '2027-01-31' }),
    makeValidation({ id: 'february', date: '2027-02-01' }),
    makeValidation({ id: 'june', date: '2027-06-30' }),
    makeValidation({ id: 'july', date: '2027-07-01' }),
  ]

  it('compte les validations qui changent de bilan vers une date plus tôt', () => {
    expect(countValidationsMovedByCutover(validations, '2027-01-31', '2027-01-15')).toBe(1)
  })

  it('compte les validations qui changent de bilan vers une date plus tard', () => {
    expect(countValidationsMovedByCutover(validations, '2027-01-15', '2027-02-05')).toBe(2)
  })

  it('ignore juillet et les validations avant ou après les deux dates', () => {
    // Juillet est après les deux dates : il ne change jamais de bilan.
    const july = validations.filter((validation) => validation.id === 'july')
    expect(countValidationsMovedByCutover(july, '2027-01-31', '2027-02-05')).toBe(0)
    // Toutes après les deux dates, puis toutes avant.
    expect(countValidationsMovedByCutover(validations, '2026-08-01', '2026-08-15')).toBe(0)
    expect(countValidationsMovedByCutover(validations, '2027-03-01', '2027-04-01')).toBe(0)
    expect(countValidationsMovedByCutover([], '2027-01-15', '2027-02-05')).toBe(0)
  })
})
