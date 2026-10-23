import { expect, test } from '@playwright/test'
import referentialData from '../src/data/referential.json' with { type: 'json' }
import type { AgeBand, Domain, Section, Validation } from '../src/domain/types'
import {
  countStored,
  openClass,
  seedBulkPhotoValidations,
  type BulkPhotoSeed,
  type BulkStudentSeed,
} from './helpers'

/**
 * Garde-fou de performance : 1 500 réussites photographiées, réparties sur
 * 20 élèves. Les photos sont des JPEG 1 × 1 px : le poids des octets n'est pas
 * ce que l'on mesure, c'est le nombre de lignes et de photos à charger.
 */
const STUDENT_COUNT = 20
const OBJECTIVES_PER_STUDENT = 75
const VALIDATION_COUNT = STUDENT_COUNT * OBJECTIVES_PER_STUDENT
const SCHOOL_YEAR_ID = '2026-2027'

/**
 * Budget CI volontairement large : la machine de CI est lente et partagée.
 * La cible réelle sur téléphone est < 2 000 ms ; elle se mesure manuellement
 * sur iPhone, jamais dans cette suite.
 */
const CI_BUDGET_MS = 4_000

/**
 * JPEG minimal valide de 1 × 1 px (268 octets, entête `FF D8 FF`). Le même
 * contenu sert de photo pleine et de vignette : l'application ne fait que
 * l'afficher, aucun décodage n'est nécessaire pour ce test.
 */
const MINIMAL_JPEG_BASE64 =
  '/9j/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL4Akk//2Q=='

interface ReferentialDomain {
  id: Domain['id']
  label: string
}

interface ReferentialObjective {
  id: string
  domainId: Domain['id']
  label: string
  ageBands: AgeBand[]
}

interface ReferentialFile {
  version: string
  domains: ReferentialDomain[]
  objectives: ReferentialObjective[]
}

const referential = referentialData as unknown as ReferentialFile

interface ObjectiveSeed {
  id: string
  label: string
  domainId: Domain['id']
  domainLabel: string
  ageBand: AgeBand
}

/** Les 75 premiers objectifs du référentiel, avec leur domaine et leur tranche. */
function buildObjectiveSeeds(): ObjectiveSeed[] {
  const domainLabels = new Map(
    referential.domains.map((domain) => [domain.id, domain.label]),
  )

  return referential.objectives
    .filter((objective) => objective.ageBands.length > 0)
    .slice(0, OBJECTIVES_PER_STUDENT)
    .map((objective) => ({
      id: objective.id,
      label: objective.label,
      domainId: objective.domainId,
      domainLabel:
        domainLabels.get(objective.domainId) ?? String(objective.domainId),
      ageBand: objective.ageBands[0] as AgeBand,
    }))
}

/** Dates réparties du 15 septembre 2026 au 20 juin 2027, toutes dans l'année. */
function dateAt(index: number): string {
  const start = Date.UTC(2026, 8, 15)
  const end = Date.UTC(2027, 5, 20)
  const step = (end - start) / (OBJECTIVES_PER_STUDENT - 1)
  return new Date(start + Math.round(step * index)).toISOString().slice(0, 10)
}

const SECTIONS: Section[] = ['PS', 'MS', 'GS']

function buildStudents(): BulkStudentSeed[] {
  return Array.from({ length: STUDENT_COUNT }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    return {
      id: `student_perf_${number}`,
      firstName: `Élève ${number}`,
      section: SECTIONS[index % SECTIONS.length] as Section,
      createdAt: '2026-09-01T08:00:00.000Z',
    }
  })
}

interface SeedRows {
  students: BulkStudentSeed[]
  validations: Validation[]
  photos: BulkPhotoSeed[]
}

/**
 * Une photo par réussite, avec 75 objectifs distincts par élève : l'index
 * unique `studentId + objectiveId` est donc respecté sans collision.
 */
function buildSeedRows(objectives: ObjectiveSeed[]): SeedRows {
  const students = buildStudents()
  const validations: Validation[] = []
  const photos: BulkPhotoSeed[] = []

  for (const [studentIndex, student] of students.entries()) {
    for (const [objectiveIndex, objective] of objectives.entries()) {
      const suffix = `${studentIndex}_${objectiveIndex}`
      const validationId = `val_perf_${suffix}`
      const photoId = `photo_perf_${suffix}`

      validations.push({
        id: validationId,
        studentId: student.id,
        objectiveId: objective.id,
        schoolYearId: SCHOOL_YEAR_ID,
        date: dateAt((studentIndex + objectiveIndex) % OBJECTIVES_PER_STUDENT),
        photoId,
        snapshot: {
          objectiveLabel: objective.label,
          domainId: objective.domainId,
          domainLabel: objective.domainLabel,
          ageBand: objective.ageBand,
          referentialVersion: referential.version,
        },
        createdAt: '2026-09-15T08:00:00.000Z',
      })
      photos.push({
        id: photoId,
        validationId,
        createdAt: '2026-09-15T08:00:00.000Z',
      })
    }
  }

  return { students, validations, photos }
}

test.describe('performance', () => {
  test('la classe et un dossier restent utilisables avec 1 500 réussites photographiées', async ({
    page,
  }) => {
    // Semis en masse : 1 500 validations et 1 500 photos en une transaction.
    test.setTimeout(120_000)

    // Horloge figée : l'année amorcée et les compteurs portent sur 2026-2027,
    // quel que soit le calendrier de la machine de CI.
    await page.clock.setFixedTime(new Date('2026-11-07T10:00:00'))

    const objectives = buildObjectiveSeeds()
    expect(objectives).toHaveLength(OBJECTIVES_PER_STUDENT)

    // Ouvre l'application une première fois pour amorcer réglages et année.
    await openClass(page)

    const rows = buildSeedRows(objectives)
    expect(rows.students).toHaveLength(STUDENT_COUNT)
    expect(rows.validations).toHaveLength(VALIDATION_COUNT)
    expect(rows.photos).toHaveLength(VALIDATION_COUNT)

    await seedBulkPhotoValidations(page, {
      ...rows,
      photoBase64: MINIMAL_JPEG_BASE64,
    })

    // Le semis est réellement en base avant de mesurer le rechargement.
    expect(await countStored(page, 'validations')).toBe(VALIDATION_COUNT)
    expect(await countStored(page, 'photos')).toBe(VALIDATION_COUNT)

    // Rechargement complet : on mesure jusqu'à la première carte élève.
    const reloadStartedAt = Date.now()
    await page.reload()

    const firstCard = page.getByRole('link', {
      name: /^Élève 01, section /,
    })
    await expect(firstCard).toBeVisible()
    const reloadMs = Date.now() - reloadStartedAt

    // Budget CI : < 4 000 ms. Cible téléphone : < 2 000 ms, mesurée à la main
    // sur iPhone, hors de cette suite.
    console.log(
      `Classe (20 élèves, 1 500 réussites) affichée en ${reloadMs} ms (budget ${CI_BUDGET_MS} ms).`,
    )
    expect(reloadMs).toBeLessThan(CI_BUDGET_MS)

    // Ouverture d'un dossier : en-tête de l'élève, chargement des réussites et
    // des vignettes compris.
    const dossierStartedAt = Date.now()
    await firstCard.click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Élève 01', exact: true }),
    ).toBeVisible()
    const dossierMs = Date.now() - dossierStartedAt

    console.log(
      `Dossier d'Élève 01 (75 réussites) ouvert en ${dossierMs} ms (budget ${CI_BUDGET_MS} ms).`,
    )
    expect(dossierMs).toBeLessThan(CI_BUDGET_MS)
  })
})
