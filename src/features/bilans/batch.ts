import { Zip, ZipPassThrough } from 'fflate'
import { buildBilanModel } from '@/domain/bilan'
import type { Referential } from '@/domain/referential'
import type { Photo, SchoolYear, Student, Validation } from '@/domain/types'
import {
  generateBilanPdf,
  loadPdfFonts,
  pdfFileName,
  type BilanPdfMeta,
} from './pdf'

export interface BatchBilanInput {
  students: Student[]
  year: SchoolYear
  period: 1 | 2
  validations: Validation[]
  photos: Map<string, Photo>
  meta: BilanPdfMeta
  referential: Referential
}

export interface BatchProgress {
  done: number
  total: number
  student: Student
}

export interface BatchBilanBundle {
  blob: Blob
  filename: string
  count: number
}

/** Nom du ZIP : une archive par année et par période. */
function bundleFileName(year: SchoolYear, period: 1 | 2): string {
  return `bilans-${period}-${year.id}.zip`
}

/**
 * Deux élèves peuvent partager le même prénom et la même initiale. Le nom du
 * PDF est conservé quand il est libre ; sinon un suffixe stable (`-2`, `-3`…)
 * évite qu'une entrée du ZIP écrase la précédente.
 */
function uniqueEntryName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }

  const extension = name.endsWith('.pdf') ? '.pdf' : ''
  const stem = extension === '' ? name : name.slice(0, -extension.length)

  let index = 2
  let candidate = `${stem}-${index}${extension}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${stem}-${index}${extension}`
  }

  used.add(candidate)
  return candidate
}

/**
 * Génère le bilan PDF de chaque élève de la classe et les regroupe dans un
 * seul ZIP, dans l'ordre de `students`.
 *
 * Les PDF sont produits l'un après l'autre : le pic mémoire reste celui d'un
 * bilan, et non celui de toute la classe. Comme les PDF sont déjà compressés,
 * chaque entrée est stockée telle quelle (`ZipPassThrough`) au lieu d'être
 * dégonflée une seconde fois.
 *
 * Tous les élèves sont inclus, y compris ceux qui n'ont aucune réussite sur la
 * période : `buildBilanModel` produit alors un modèle vide et le PDF affiche
 * « Aucune réussite sur cette période. ».
 */
export async function generateBilanBundle(
  input: BatchBilanInput,
  onProgress?: (progress: BatchProgress) => void,
): Promise<BatchBilanBundle> {
  const { students, year, period, validations, photos, meta, referential } = input
  const fonts = await loadPdfFonts()

  // `fflate` remet des vues sur un buffer non partagé ; le type générique de
  // `BlobPart` exige un `ArrayBuffer` explicite.
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let zipError: Error | undefined

  const zip = new Zip((error, chunk) => {
    if (error) {
      zipError ??= error instanceof Error ? error : new Error(String(error))
      return
    }
    chunks.push(chunk as Uint8Array<ArrayBuffer>)
  })

  const usedNames = new Set<string>()
  let done = 0
  for (const student of students) {
    if (zipError !== undefined) throw zipError

    const model = buildBilanModel({
      student,
      year,
      period,
      validations,
      photos,
      referential,
    })
    const bytes = await generateBilanPdf(model, meta, fonts)

    const entryName = uniqueEntryName(pdfFileName(student, year, period), usedNames)
    const entry = new ZipPassThrough(entryName)
    zip.add(entry)
    entry.push(bytes, true)

    done += 1
    onProgress?.({ done, total: students.length, student })
  }

  zip.end()
  if (zipError !== undefined) throw zipError

  return {
    blob: new Blob(chunks, { type: 'application/zip' }),
    filename: bundleFileName(year, period),
    count: students.length,
  }
}
