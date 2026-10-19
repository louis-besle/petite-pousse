// @vitest-environment node
import { unzipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective, Validation } from '@/domain/types'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { generateBilanBundle, type BatchProgress } from './batch'
import { pdfFileName, type BilanPdfMeta } from './pdf'

// Les fontes réelles sont lues sur disque : les PDF produits par le test sont
// de vrais PDF, seul le chargement réseau de `loadPdfFonts` est remplacé.
vi.mock('./pdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdf')>()
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  let fonts: Promise<{
    regular: Uint8Array
    bold: Uint8Array
    display: Uint8Array
  }> | undefined

  return {
    ...actual,
    loadPdfFonts: vi.fn(() => {
      fonts ??= (async () => {
        const directory = join(process.cwd(), 'src', 'assets', 'fonts')
        return {
          regular: new Uint8Array(await readFile(join(directory, 'Nunito-Regular.ttf'))),
          bold: new Uint8Array(await readFile(join(directory, 'Nunito-Bold.ttf'))),
          display: new Uint8Array(await readFile(join(directory, 'Fraunces-Bold.ttf'))),
        }
      })()
      return fonts
    }),
  }
})

const META: BilanPdfMeta = {
  schoolName: 'École des Lilas',
  className: 'MS A',
  teacherName: 'Mme Martin',
}

let nextValidation = 0

function objective(id: string): Objective {
  const found = referential.objectives.find((candidate) => candidate.id === id)
  if (found === undefined) {
    throw new Error(`Objectif de test introuvable : ${id}`)
  }
  return found
}

function makeValidation(
  studentId: string,
  objectiveId: string,
  date: string,
): Validation {
  const found = objective(objectiveId)

  nextValidation += 1
  return {
    id: `val-batch-${nextValidation}`,
    studentId,
    objectiveId: found.id,
    schoolYearId: '2026-2027',
    date,
    snapshot: {
      objectiveLabel: found.label,
      domainId: found.domainId,
      domainLabel:
        referential.domains.find((domain) => domain.id === found.domainId)?.label ?? '',
      ageBand: found.ageBands[0] ?? 'from4',
      referentialVersion: REFERENTIAL_VERSION,
    },
    createdAt: '2026-10-12T08:00:00.000Z',
  }
}

function input(
  students: ReturnType<typeof makeStudent>[],
  validations: Validation[] = [],
): Parameters<typeof generateBilanBundle>[0] {
  return {
    students,
    year: makeSchoolYear(),
    period: 1,
    validations,
    photos: new Map(),
    meta: META,
    referential,
  }
}

async function entriesOf(blob: Blob): Promise<Record<string, Uint8Array>> {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()))
}

function header(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes.slice(0, 5))
}

// La génération pdf-lib (fontes embarquées, sous-ensembles) prend quelques
// secondes : marge généreuse sur une machine chargée.
const BUNDLE_TIMEOUT = 60_000

describe('generateBilanBundle', () => {
  it(
    'crée une entrée ZIP par élève, nommée comme le PDF individuel',
    async () => {
      const year = makeSchoolYear()
      const lea = makeStudent({ firstName: 'Léa', lastNameInitial: 'M' })
      const adam = makeStudent({ firstName: 'Adam', section: 'PS' })
      const zoe = makeStudent({ firstName: 'Zoé', section: 'GS' })

      // Adam n'a aucune réussite : il doit tout de même avoir son entrée.
      const bundle = await generateBilanBundle(
        input(
          [lea, adam, zoe],
          [
            makeValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12'),
            makeValidation(zoe.id, 'maths-nombres-01', '2026-11-03'),
          ],
        ),
      )
      const entries = await entriesOf(bundle.blob)

      expect(Object.keys(entries).sort()).toEqual(
        [
          pdfFileName(adam, year, 1),
          pdfFileName(lea, year, 1),
          pdfFileName(zoe, year, 1),
        ].sort(),
      )
      expect(bundle.count).toBe(3)
    },
    BUNDLE_TIMEOUT,
  )

  it(
    'produit un PDF non vide pour un élève sans réussite',
    async () => {
      const lea = makeStudent({ firstName: 'Léa' })

      const bundle = await generateBilanBundle(input([lea]))
      const entries = await entriesOf(bundle.blob)
      const entry = entries[pdfFileName(lea, makeSchoolYear(), 1)]

      expect(entry).toBeDefined()
      expect(entry?.byteLength).toBeGreaterThan(1_000)
      expect(header(entry as Uint8Array)).toBe('%PDF-')
    },
    BUNDLE_TIMEOUT,
  )

  it(
    'signale la progression après chaque élève, dans l’ordre de la classe',
    async () => {
      const lea = makeStudent({ firstName: 'Léa' })
      const adam = makeStudent({ firstName: 'Adam', section: 'PS' })
      const progress: BatchProgress[] = []

      await generateBilanBundle(input([lea, adam]), (item) => {
        progress.push(item)
      })

      expect(progress.map((item) => item.student.id)).toEqual([lea.id, adam.id])
      expect(progress.map((item) => item.done)).toEqual([1, 2])
      expect(progress.every((item) => item.total === 2)).toBe(true)
    },
    BUNDLE_TIMEOUT,
  )

  it(
    'dédoublonne les noms de fichiers quand deux élèves partagent le même prénom',
    async () => {
      const first = makeStudent({ firstName: 'Léa' })
      const second = makeStudent({ firstName: 'Léa' })

      const bundle = await generateBilanBundle(input([first, second]))
      const names = Object.keys(await entriesOf(bundle.blob)).sort()

      expect(names).toEqual(
        [
          pdfFileName(first, makeSchoolYear(), 1),
          pdfFileName(second, makeSchoolYear(), 1).replace(/\.pdf$/, '-2.pdf'),
        ].sort(),
      )
    },
    BUNDLE_TIMEOUT,
  )

  it(
    'nomme l’archive avec la période et l’année',
    async () => {
      const lea = makeStudent({ firstName: 'Léa' })
      const bundleInput = input([lea])
      bundleInput.period = 2

      const bundle = await generateBilanBundle(bundleInput)
      const entries = await entriesOf(bundle.blob)

      expect(bundle.filename).toBe('bilans-2-2026-2027.zip')
      expect(Object.keys(entries)).toEqual([pdfFileName(lea, bundleInput.year, 2)])
    },
    BUNDLE_TIMEOUT,
  )
})
