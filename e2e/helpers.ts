import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import referentialData from '../src/data/referential.json' with { type: 'json' }
import { defaultSchoolYear, schoolYearIdForDate } from '../src/domain/schoolYear'
import type { Validation } from '../src/domain/types'

/** Sections de la maternelle, telles que l'interface les nomme. */
export type Section = 'PS' | 'MS' | 'GS'

/** Photo de test : aplats colorés, aucune personne, aucun texte. */
export const PHOTO_FIXTURE = path.resolve(process.cwd(), 'e2e/fixtures/photo.jpg')

/** Nom stable de la base IndexedDB de l'application. */
const DB_NAME = 'carnet-de-reussites'

/** Tables de la base dont un test peut compter les lignes. */
export type StoreName = 'students' | 'validations' | 'photos' | 'schoolYears'

/** Échappe une chaîne pour l'utiliser dans un `RegExp` construit dynamiquement. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Navigation par le routeur à hash. La première requête au serveur de dev
 * compile l'application : le délai est donc généreux.
 */
export async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(`/#${route}`, { timeout: 60_000 })
}

/**
 * Ouvre la classe et attend son titre. L'écran d'accueil amorce la base
 * (réglages et année courante) : c'est le point d'entrée sûr avant un semis
 * direct via `seedValidation`.
 */
export async function openClass(page: Page): Promise<void> {
  await gotoRoute(page, '/')
  await expect(
    page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
  ).toBeVisible()
}

/**
 * Ajoute un élève depuis la gestion des élèves, puis attend sa ligne.
 * Le contexte Playwright étant neuf pour chaque test, l'élève est le premier.
 */
export async function addStudent(
  page: Page,
  name: string,
  section: Section,
): Promise<void> {
  await gotoRoute(page, '/students')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Gérer les élèves' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Ajouter un élève', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Ajouter un élève' })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Prénom', { exact: true }).fill(name)
  await dialog
    .getByRole('group', { name: 'Section', exact: true })
    .getByRole('button', { name: section, exact: true })
    .click()
  await dialog.getByRole('button', { name: /Ajouter l.élève/ }).click()

  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole('button', {
      name: new RegExp(`^Modifier ${escapeRegExp(name)}, section `),
    }),
  ).toBeVisible()
}

/**
 * Parcours photo complet depuis l'accueil : élève, photo, objectif, validation.
 * Se termine sur l'écran de succès.
 */
export async function captureWithPhoto(
  page: Page,
  name: string,
  objectiveSearch: string,
): Promise<void> {
  await gotoRoute(page, '/')
  await expect(
    page.getByRole('heading', { level: 1, name: /^Bonjour/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: /Prendre une photo/ }).click()

  const studentButton = page.getByRole('button', {
    name: new RegExp(`^${escapeRegExp(name)}, section `),
  })
  await expect(studentButton).toBeVisible()
  await studentButton.click()

  // L'écran photo affiche le récapitulatif de l'élève choisi.
  await expect(
    page.getByRole('group', {
      name: new RegExp(`^Élève ${escapeRegExp(name)}, section `),
    }),
  ).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE)

  const preview = page.getByRole('img', { name: `Photo de réussite de ${name}` })
  await expect(preview).toHaveAttribute('src', /^blob:/)

  await page.getByRole('button', { name: /Choisir l.objectif/ }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: /Choisir l.objectif/ }),
  ).toBeVisible()

  await page.getByLabel('Rechercher un objectif', { exact: true }).fill(objectiveSearch)

  const card = page
    .getByRole('listitem')
    .getByRole('button', { name: new RegExp(escapeRegExp(objectiveSearch), 'i') })
  await expect(card).toHaveCount(1)
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: /Valider la réussite/ }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: /C.est noté/ }),
  ).toBeVisible()
}

/** Ouvre le dossier d'un élève depuis sa carte de la classe. */
export async function openDossier(page: Page, name: string): Promise<void> {
  await gotoRoute(page, '/')

  const card = page.getByRole('link', {
    name: new RegExp(`^${escapeRegExp(name)}, section `),
  })
  await expect(card).toBeVisible()
  await card.click()

  await expect(
    page.getByRole('heading', { level: 1, name, exact: true }),
  ).toBeVisible()
}

/**
 * Compte les lignes d'une table de la base applicative, depuis la page.
 *
 * La base est ouverte sans version : on ne veut jamais déclencher de mise à
 * niveau ni créer de magasin. La transaction est en lecture seule et la
 * connexion est refermée dans tous les cas. Seuls des nombres traversent la
 * frontière Playwright (aucun Blob, aucun objet de l'application).
 */
export async function countStored(page: Page, store: StoreName): Promise<number> {
  return page.evaluate(
    ({ dbName, storeName }) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open(dbName)

        request.onerror = () => {
          reject(request.error ?? new Error(`Ouverture de ${dbName} impossible`))
        }

        request.onupgradeneeded = () => {
          // La base doit déjà exister : on annule plutôt que de la créer vide.
          request.transaction?.abort()
          reject(new Error(`La base ${dbName} n'existe pas`))
        }

        request.onsuccess = () => {
          const database = request.result

          try {
            const transaction = database.transaction(storeName, 'readonly')
            const countRequest = transaction.objectStore(storeName).count()

            countRequest.onerror = () => {
              database.close()
              reject(
                countRequest.error ??
                  new Error(`Comptage de ${storeName} impossible`),
              )
            }

            countRequest.onsuccess = () => {
              database.close()
              resolve(countRequest.result)
            }
          } catch (error) {
            database.close()
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        }
      }),
    { dbName: DB_NAME, storeName: store },
  )
}

/** Referme la notice de confidentialité affichée au premier lancement. */
export async function dismissPrivacy(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', {
    name: 'Tes données restent sur ton appareil',
  })

  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: 'J’ai compris' }).click()
    await expect(dialog).toBeHidden()
  }
}

/* ------------------------------------------------------------------ */
/* Semis et inspection via la base exposée en développement            */
/* ------------------------------------------------------------------ */

/** Tables que les helpers peuvent lire ou vider. */
export type DatabaseTable = StoreName | 'settings' | 'drafts'

/** Vue minimale de la base applicative exposée sur `window` en développement. */
interface DevTable {
  get(id: string): Promise<unknown>
  add(row: unknown): Promise<unknown>
  bulkAdd(rows: unknown[]): Promise<unknown>
  update(id: string, changes: unknown): Promise<number>
  toArray(): Promise<unknown[]>
  clear(): Promise<void>
}

interface DevDatabase {
  students: DevTable
  schoolYears: DevTable
  validations: DevTable
  photos: DevTable
  settings: DevTable
  drafts: DevTable
  transaction(
    mode: 'r' | 'rw',
    tables: DevTable[],
    body: () => Promise<void>,
  ): Promise<void>
}

interface ReferentialDomain {
  id: string
  label: string
}

interface ReferentialObjective {
  id: string
  domainId: string
  label: string
  ageBands: string[]
  examples: Record<string, string | undefined>
}

interface ReferentialFile {
  version: string
  domains: ReferentialDomain[]
  objectives: ReferentialObjective[]
}

const referential = referentialData as unknown as ReferentialFile

/** Année scolaire `YYYY-YYYY` figée d'une date, avec ses bornes par défaut. */
interface SeedYear {
  id: string
  start: string
  period1End: string
  period2End: string
}

export interface SeedValidationInput {
  studentId: string
  objectiveId: string
  /** `YYYY-MM-DD`, dans l'année scolaire correspondante. */
  date: string
  /** Crée une photo JPEG (pleine et vignette) et la lie à la réussite. */
  withPhoto?: boolean
}

export interface SeededValidation {
  validationId: string
  photoId?: string
}

/**
 * Écrit une réussite directement en base, sans passer par l'interface.
 *
 * L'instantané est construit depuis le référentiel embarqué, comme le fait
 * `createValidation`. L'année scolaire de la date est créée si elle manque, sans
 * jamais écraser une ligne existante. La photo éventuelle utilise les octets
 * réels de `e2e/fixtures/photo.jpg`.
 *
 * La base doit être amorcée avant l'appel : naviguer sur `/` et attendre la
 * classe garantit que les réglages existent.
 */
export async function seedValidation(
  page: Page,
  input: SeedValidationInput,
): Promise<SeededValidation> {
  const objective = referential.objectives.find(
    (candidate) => candidate.id === input.objectiveId,
  )
  if (objective === undefined) {
    throw new Error(`Objectif introuvable dans le référentiel : ${input.objectiveId}`)
  }

  const domain = referential.domains.find(
    (candidate) => candidate.id === objective.domainId,
  )
  const ageBand = objective.ageBands[0]
  if (domain === undefined || ageBand === undefined) {
    throw new Error(`Objectif incomplet dans le référentiel : ${input.objectiveId}`)
  }

  const schoolYearId = schoolYearIdForDate(input.date)
  const yearRow: SeedYear = defaultSchoolYear(schoolYearId)
  const photoBase64 =
    input.withPhoto === true
      ? readFileSync(PHOTO_FIXTURE).toString('base64')
      : undefined

  return page.evaluate(
    async (payload) => {
      const database = (window as unknown as { __carnetDb: DevDatabase }).__carnetDb
      const validationId = `val_seed_${crypto.randomUUID()}`
      const createdAt = new Date().toISOString()
      let photoId: string | undefined

      await database.transaction(
        'rw',
        [database.schoolYears, database.validations, database.photos],
        async () => {
          if ((await database.schoolYears.get(payload.schoolYearId)) === undefined) {
            await database.schoolYears.add(payload.yearRow)
          }

          if (payload.photoBase64 !== undefined) {
            const bytes = Uint8Array.from(atob(payload.photoBase64), (character) =>
              character.charCodeAt(0),
            )
            const full = new Blob([bytes], { type: 'image/jpeg' })
            const thumb = new Blob([bytes], { type: 'image/jpeg' })
            photoId = `photo_seed_${crypto.randomUUID()}`

            await database.photos.add({
              id: photoId,
              validationId,
              full,
              thumb,
              width: 1200,
              height: 900,
              mime: 'image/jpeg',
              createdAt,
            })
          }

          await database.validations.add({
            id: validationId,
            studentId: payload.studentId,
            objectiveId: payload.objectiveId,
            schoolYearId: payload.schoolYearId,
            date: payload.date,
            ...(photoId === undefined ? {} : { photoId }),
            snapshot: {
              objectiveLabel: payload.objectiveLabel,
              domainId: payload.domainId,
              domainLabel: payload.domainLabel,
              ageBand: payload.ageBand,
              ...(payload.example === undefined ? {} : { example: payload.example }),
              referentialVersion: payload.referentialVersion,
            },
            createdAt,
          })
        },
      )

      return { validationId, ...(photoId === undefined ? {} : { photoId }) }
    },
    {
      studentId: input.studentId,
      objectiveId: input.objectiveId,
      date: input.date,
      schoolYearId,
      yearRow,
      objectiveLabel: objective.label,
      domainId: objective.domainId,
      domainLabel: domain.label,
      ageBand,
      example: objective.examples[ageBand],
      referentialVersion: referential.version,
      photoBase64,
    },
  )
}

/**
 * Lit toutes les lignes d'une table. Les `Blob` sont remplacés par leur taille
 * et leur type : un Blob brut ne traverse pas la frontière Playwright.
 */
export async function readDb(
  page: Page,
  table: DatabaseTable,
): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(
    async ({ tableName }) => {
      const database = (window as unknown as { __carnetDb: DevDatabase }).__carnetDb
      const handle = (database as unknown as Record<string, DevTable | undefined>)[
        tableName
      ]
      if (handle === undefined) {
        throw new Error(`Table inconnue : ${tableName}`)
      }

      const rows = await handle.toArray()
      return rows.map((row) => {
        const mapped: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
          mapped[key] =
            value instanceof Blob ? { size: value.size, type: value.type } : value
        }
        return mapped
      })
    },
    { tableName: table },
  )
}

/**
 * Vide toutes les tables applicatives sans supprimer la base elle-même.
 *
 * Les réglages disparaissent aussi : l'application redevient « non amorcée »
 * et les écrans qui en dépendent se désactivent jusqu'au prochain montage.
 */
export async function clearDb(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const database = (window as unknown as { __carnetDb: DevDatabase }).__carnetDb

    await database.transaction(
      'rw',
      [
        database.students,
        database.schoolYears,
        database.validations,
        database.photos,
        database.settings,
        database.drafts,
      ],
      async () => {
        await database.students.clear()
        await database.schoolYears.clear()
        await database.validations.clear()
        await database.photos.clear()
        await database.settings.clear()
        await database.drafts.clear()
      },
    )
  })
}

/**
 * Force l'année scolaire en cours, sans passer par l'interface (qui ne propose
 * que le passage à l'année suivante). Sert à reproduire une base reprise d'une
 * année pas encore basculée, comme le font les tests unitaires.
 */
export async function setCurrentSchoolYear(
  page: Page,
  yearId: string,
): Promise<void> {
  await page.evaluate(
    async (id) => {
      const database = (window as unknown as { __carnetDb: DevDatabase }).__carnetDb

      if ((await database.schoolYears.get(id)) === undefined) {
        throw new Error(`Année scolaire absente : ${id}`)
      }

      const updated = await database.settings.update('app', {
        currentSchoolYearId: id,
      })
      if (updated === 0) {
        throw new Error('Réglages absents : impossible de changer d’année scolaire.')
      }
    },
    yearId,
  )
}

/**
 * Écrit le brouillon de capture d'un élève, sans passer par l'interface.
 * Sert aux écrans qui exigent un brouillon en place avant leur analyse.
 */
export async function seedDraft(page: Page, studentId: string): Promise<void> {
  await page.evaluate(
    async (id) => {
      const database = (window as unknown as { __carnetDb: DevDatabase }).__carnetDb

      await database.transaction('rw', [database.drafts], async () => {
        await database.drafts.clear()
        await database.drafts.add({
          id: 'current',
          studentId: id,
          createdAt: new Date().toISOString(),
        })
      })
    },
    studentId,
  )
}

/** Élève semé en masse : mêmes champs que la table `students`. */
export interface BulkStudentSeed {
  id: string
  firstName: string
  section: Section
  createdAt: string
}

/** Photo semée en masse : ses `Blob` sont construits dans la page. */
export interface BulkPhotoSeed {
  id: string
  validationId: string
  createdAt: string
}

export interface BulkSeedInput {
  students: BulkStudentSeed[]
  validations: Validation[]
  photos: BulkPhotoSeed[]
  /** JPEG minimal (1 × 1 px) encodé en base64. */
  photoBase64: string
}

/**
 * Sème en une seule transaction des élèves, leurs réussites et une photo par
 * réussite. Réservé au garde-fou de performance : le même volume semé par
 * l'interface (500 captures) rendrait le test impraticable.
 *
 * Les `Blob` sont construits dans la page depuis le JPEG base64 : aucun octet
 * binaire ne traverse la frontière Playwright.
 */
export async function seedBulkPhotoValidations(
  page: Page,
  input: BulkSeedInput,
): Promise<void> {
  await page.evaluate(
    async (payload) => {
      const database = (window as unknown as { __carnetDb: DevDatabase }).__carnetDb
      const bytes = Uint8Array.from(atob(payload.photoBase64), (character) =>
        character.charCodeAt(0),
      )
      const full = new Blob([bytes], { type: 'image/jpeg' })
      const thumb = new Blob([bytes], { type: 'image/jpeg' })

      await database.transaction(
        'rw',
        [database.students, database.validations, database.photos],
        async () => {
          await database.students.bulkAdd(payload.students)
          await database.validations.bulkAdd(payload.validations)
          await database.photos.bulkAdd(
            payload.photos.map((photo) => ({
              ...photo,
              full,
              thumb,
              width: 1,
              height: 1,
              mime: 'image/jpeg',
            })),
          )
        },
      )
    },
    input,
  )
}
