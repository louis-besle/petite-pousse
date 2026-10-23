// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { BilanEntry, BilanModel } from '@/domain/bilan'
import { referential } from '@/domain/referential'
import type { Domain, Photo } from '@/domain/types'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { generateBilanPdf, loadPdfFonts, pdfFileName, type PdfFonts } from './pdf'

const FONT_DIRECTORY = join(process.cwd(), 'src', 'assets', 'fonts')

const META = {
  schoolName: 'École des Lilas',
  className: 'MS A',
  teacherName: 'Mme Martin',
}

let fonts: PdfFonts
let nextEntry = 0

beforeAll(async () => {
  fonts = {
    regular: new Uint8Array(await readFile(join(FONT_DIRECTORY, 'Nunito-Regular.ttf'))),
    bold: new Uint8Array(await readFile(join(FONT_DIRECTORY, 'Nunito-Bold.ttf'))),
    display: new Uint8Array(await readFile(join(FONT_DIRECTORY, 'Fraunces-Bold.ttf'))),
  }
})

function domain(id: Domain['id']): Domain {
  const found = referential.domains.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`Domaine de test introuvable : ${id}`)
  return found
}

function entry(
  label: string,
  date: string,
  overrides: Partial<BilanEntry> = {},
): BilanEntry {
  nextEntry += 1
  return {
    validationId: `val-test-${nextEntry}`,
    objectiveLabel: label,
    domainId: 'langage',
    domainLabel: 'Langage',
    date,
    ageBand: 'from4',
    ...overrides,
  }
}

function model(groups: Array<{ id: Domain['id']; entries: BilanEntry[] }>): BilanModel {
  const year = makeSchoolYear()
  const domains = groups.map((group) => ({
    domain: domain(group.id),
    entries: group.entries,
  }))

  return {
    student: makeStudent({ firstName: 'Léa', lastNameInitial: 'M' }),
    year,
    period: 1,
    start: year.start,
    end: year.period1End,
    total: domains.reduce((total, group) => total + group.entries.length, 0),
    domains,
  }
}

interface ExtractedPage {
  text: string
  width: number
  height: number
}

/**
 * Extrait le texte et la taille de chaque page. Le rendu n'est pas demandé :
 * le worker pdf.js est désactivé, `isEvalSupported` aussi, pour rester dans un
 * environnement Node déterministe.
 */
async function extractPages(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    isEvalSupported: false,
  } as Parameters<typeof getDocument>[0])
  const document = await task.promise
  const pages: ExtractedPage[] = []

  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      pages.push({ text, width: viewport.width, height: viewport.height })
    }
  } finally {
    await task.destroy()
  }

  return pages
}

// La génération et l'extraction pdf.js sont lentes : on laisse une marge
// généreuse pour ne pas faire échouer la suite sur une machine chargée.
const PDF_TIMEOUT = 30_000

describe('generateBilanPdf', () => {
  it(
    'produit une feuille A4 avec le titre, l’élève, les intitulés et les dates',
    async () => {
      const bilan = model([
        {
          id: 'langage',
          entries: [entry('Raconter une histoire à partir des images', '2026-10-12')],
        },
        {
          id: 'maths',
          entries: [
            entry('Compter une collection de 1 à 5 objets', '2026-09-28', {
              domainId: 'maths',
              domainLabel: 'Maths',
            }),
          ],
        },
      ])

      const bytes = await generateBilanPdf(bilan, META, fonts)
      const pages = await extractPages(bytes)

      expect(pages).toHaveLength(1)
      const [page] = pages
      expect(page?.width).toBeCloseTo(595.28, 0)
      expect(page?.height).toBeCloseTo(841.89, 0)
      expect(Math.abs((page?.width ?? 0) - 595)).toBeLessThanOrEqual(1)
      expect(Math.abs((page?.height ?? 0) - 842)).toBeLessThanOrEqual(1)

      const text = page?.text ?? ''
      expect(text).toContain('Bilan des réussites')
      expect(text).toContain('Léa')
      expect(text).toContain('Raconter une histoire à partir des images')
      expect(text).toContain('Compter une collection de 1 à 5 objets')
      expect(text).toContain('12 oct.')
      expect(text).toContain('28 sept.')
      expect(text).toContain('Signature des parents')
    },
    PDF_TIMEOUT,
  )

  it(
    'répartit 40 réussites sur plusieurs pages avec en-tête et pagination',
    async () => {
      const entries = Array.from({ length: 40 }, (_, index) =>
        entry(`Objectif numéro ${index + 1} observé en classe`, '2026-10-12'),
      )
      const bilan = model([{ id: 'langage', entries }])

      const bytes = await generateBilanPdf(bilan, META, fonts)
      const pages = await extractPages(bytes)

      expect(pages.length).toBeGreaterThan(1)
      for (const page of pages) {
        expect(page.text).toContain('École des Lilas')
        expect(page.text).toContain('Page')
      }
      expect(pages[0]?.text).toContain('Bilan des réussites')
      expect(pages.at(-1)?.text).toContain('Signature des parents')
    },
    PDF_TIMEOUT,
  )

  it(
    'remplace la vignette absente par « Observation en classe »',
    async () => {
      const bilan = model([
        {
          id: 'vivant',
          entries: [
            entry('Observer les animaux et les végétaux', '2026-09-18', {
              domainId: 'vivant',
              domainLabel: 'Vivant',
            }),
          ],
        },
      ])

      const bytes = await generateBilanPdf(bilan, META, fonts)
      const [page] = await extractPages(bytes)

      expect(page?.text).toContain('Observation en classe')
    },
    PDF_TIMEOUT,
  )

  it(
    'ne plante pas quand une vignette JPEG est illisible',
    async () => {
      const brokenPhoto: Photo = {
        id: 'photo-broken',
        validationId: 'val-broken',
        full: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
        thumb: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
        width: 1,
        height: 1,
        mime: 'image/jpeg',
        createdAt: '2026-10-12T08:00:00.000Z',
      }
      const bilan = model([
        {
          id: 'arts',
          entries: [
            entry('Réaliser une composition en volume', '2026-10-09', {
              domainId: 'arts',
              domainLabel: 'Arts',
              photo: brokenPhoto,
            }),
          ],
        },
      ])

      const bytes = await generateBilanPdf(bilan, META, fonts)
      const [page] = await extractPages(bytes)

      expect(page?.text).toContain('Réaliser une composition en volume')
      expect(page?.text).toContain('Photo')
    },
    PDF_TIMEOUT,
  )
})

describe('pdfFileName', () => {
  it('normalise le prénom et la période', () => {
    expect(pdfFileName(makeStudent(), makeSchoolYear(), 1)).toBe(
      'bilan-lea-1-2026-2027.pdf',
    )
  })

  it('retire les accents et les caractères non alphanumériques', () => {
    const student = makeStudent({ firstName: 'Éloïse', lastNameInitial: 'D' })

    expect(pdfFileName(student, makeSchoolYear(), 2)).toBe(
      'bilan-eloise-d-2-2026-2027.pdf',
    )
  })
})

describe('loadPdfFonts', () => {
  it('met la promesse en cache', async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array([0, 1, 2, 3])),
    )
    vi.stubGlobal('fetch', fetchMock)

    try {
      const first = loadPdfFonts()
      const second = loadPdfFonts()
      expect(second).toBe(first)

      const loaded = await first
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(loaded.regular).toBeInstanceOf(Uint8Array)
      expect(loaded.bold).toBeInstanceOf(Uint8Array)
      expect(loaded.display).toBeInstanceOf(Uint8Array)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
