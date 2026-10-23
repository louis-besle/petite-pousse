import path from 'node:path'
import { expect, type Page } from '@playwright/test'

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
    page.getByRole('button', { name: `Modifier ${name}`, exact: true }),
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
