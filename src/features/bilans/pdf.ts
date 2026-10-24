import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  PDFName,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import type { BilanEntry, BilanModel } from '@/domain/bilan'
import type { Domain, SchoolYear, Student } from '@/domain/types'
import { formatShortDate } from '@/lib/date'
import displayFontUrl from '../../assets/fonts/Fraunces-Bold.ttf?url'
import boldFontUrl from '../../assets/fonts/Nunito-Bold.ttf?url'
import regularFontUrl from '../../assets/fonts/Nunito-Regular.ttf?url'

/** Les trois fontes embarquées dans le PDF. */
export interface PdfFonts {
  regular: Uint8Array
  bold: Uint8Array
  display: Uint8Array
}

export interface BilanPdfMeta {
  schoolName: string
  className: string
  teacherName: string
}

/** A4 en points PostScript : 210 × 297 mm. */
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

const MARGIN = 48
const COLUMN_WIDTH = 236
const COLUMN_GAP = 26

const HEADER_BASELINE = A4_HEIGHT - MARGIN
const HEADER_RULE_Y = HEADER_BASELINE - 10
const TITLE_BASELINE = HEADER_RULE_Y - 32
const NAME_BASELINE = TITLE_BASELINE - 30
const META_BASELINE = NAME_BASELINE - 15
const STUDENT_RULE_Y = META_BASELINE - 11
const FIRST_PAGE_CONTENT_TOP = STUDENT_RULE_Y - 14
const NEXT_PAGE_CONTENT_TOP = HEADER_RULE_Y - 22
const CONTENT_BOTTOM = 60

const THUMB_WIDTH = 46
const THUMB_HEIGHT = 36
const THUMB_GAP = 8
const LABEL_SIZE = 8.5
const LABEL_LINE_HEIGHT = 10.5
const DATE_SIZE = 7.5
const DATE_LINE_HEIGHT = 9
const ENTRY_GAP = 8
const DOMAIN_HEADER_HEIGHT = 19
/** Haut du bloc de signature, calé en bas de la colonne droite. */
const SIGNATURE_TOP = CONTENT_BOTTOM + 52

const TEXT_WIDTH = COLUMN_WIDTH - THUMB_WIDTH - THUMB_GAP

const INK = rgb(0.184, 0.165, 0.141)
const MUTED = rgb(0.42, 0.38, 0.33)
const LINE = rgb(0.918, 0.863, 0.776)
const PAPER = rgb(1, 0.992, 0.976)

/** Couleurs d'accent et fonds doux des domaines (mêmes valeurs que l'UI). */
const DOMAIN_COLORS: Record<Domain['id'], RGB> = {
  langage: rgb(0.435, 0.561, 0.416),
  maths: rgb(0.498, 0.647, 0.722),
  corps: rgb(0.851, 0.463, 0.357),
  arts: rgb(0.851, 0.643, 0.255),
  temps: rgb(0.725, 0.541, 0.431),
  vivant: rgb(0.494, 0.545, 0.341),
  evar: rgb(0.698, 0.412, 0.541),
}

const DOMAIN_SOFT: Record<Domain['id'], RGB> = {
  langage: rgb(0.906, 0.933, 0.875),
  maths: rgb(0.886, 0.929, 0.945),
  corps: rgb(0.969, 0.871, 0.855),
  arts: rgb(0.98, 0.922, 0.788),
  temps: rgb(0.949, 0.89, 0.843),
  vivant: rgb(0.906, 0.922, 0.847),
  evar: rgb(0.965, 0.875, 0.902),
}

/** Couleur de repli pour un domaine retiré du référentiel. */
const FALLBACK_COLOR = rgb(0.42, 0.38, 0.33)
const FALLBACK_SOFT = rgb(0.961, 0.949, 0.925)

/** « 1 réussite », « 2 réussites ». */
function successLabel(count: number): string {
  return `${count} réussite${count > 1 ? 's' : ''}`
}

/** « Léa » ou « Léa M. » selon que l'initiale est renseignée. */
function studentLabel(student: Student): string {
  const initial = student.lastNameInitial?.trim()

  return initial === undefined || initial === ''
    ? student.firstName
    : `${student.firstName} ${initial}.`
}

/** Une ligne de période lisible : « Du 1 sept. 2026 au 31 janv. 2027 ». */
function periodLabel(model: BilanModel): string {
  return `Du ${formatShortDate(model.start)} ${model.start.slice(0, 4)} au ${formatShortDate(
    model.end,
  )} ${model.end.slice(0, 4)}`
}

/**
 * Découpe un texte en lignes qui tiennent dans `width`. Un mot plus long que la
 * colonne est coupé caractère par caractère : aucune ligne ne déborde.
 */
function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/).filter((word) => word !== '')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`

    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate
      continue
    }

    if (current !== '') {
      lines.push(current)
    }

    let remaining = word
    while (font.widthOfTextAtSize(remaining, size) > width && remaining.length > 1) {
      let end = remaining.length - 1
      while (end > 1 && font.widthOfTextAtSize(remaining.slice(0, end), size) > width) {
        end -= 1
      }
      lines.push(remaining.slice(0, end))
      remaining = remaining.slice(end)
    }
    current = remaining
  }

  if (current !== '') lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/** Position horizontale d'une colonne (0 = gauche, 1 = droite). */
function columnX(column: 0 | 1): number {
  return MARGIN + column * (COLUMN_WIDTH + COLUMN_GAP)
}

/**
 * Précharge les vignettes JPEG. Une photo absente ou illisible est représentée
 * par `null` : le dessin continue avec un rectangle neutre, jamais d'exception.
 */
async function embedPhotos(
  document: PDFDocument,
  model: BilanModel,
): Promise<Map<string, PDFImage | null>> {
  const images = new Map<string, PDFImage | null>()

  for (const group of model.domains) {
    for (const entry of group.entries) {
      if (entry.photo === undefined) continue

      try {
        const bytes = new Uint8Array(await entry.photo.thumb.arrayBuffer())
        images.set(entry.validationId, await document.embedJpg(bytes))
      } catch (error) {
        console.warn(
          `Vignette illisible pour la réussite ${entry.validationId} : rectangle neutre.`,
          error instanceof Error ? error.message : String(error),
        )
        images.set(entry.validationId, null)
      }
    }
  }

  return images
}

function drawHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  model: BilanModel,
  meta: BilanPdfMeta,
): void {
  const identity = [meta.schoolName, meta.className, meta.teacherName]
    .filter((part) => part !== '')
    .join(' · ')
  const left = identity === '' ? 'Petite pousse' : identity
  const right = `Bilan ${model.period} · ${model.year.id}`

  page.drawText(left, {
    x: MARGIN,
    y: HEADER_BASELINE - 8,
    size: 7.5,
    font: fonts.bold,
    color: MUTED,
  })
  page.drawText(right, {
    x: A4_WIDTH - MARGIN - fonts.bold.widthOfTextAtSize(right, 7.5),
    y: HEADER_BASELINE - 8,
    size: 7.5,
    font: fonts.bold,
    color: MUTED,
  })
  page.drawLine({
    start: { x: MARGIN, y: HEADER_RULE_Y },
    end: { x: A4_WIDTH - MARGIN, y: HEADER_RULE_Y },
    thickness: 0.6,
    color: LINE,
  })
}

/** Reprend l'en-tête, la date de période et le bloc élève de la première page. */
function drawTitleBlock(
  page: PDFPage,
  fonts: { bold: PDFFont; display: PDFFont },
  model: BilanModel,
): void {
  page.drawText('Bilan des réussites', {
    x: MARGIN,
    y: TITLE_BASELINE - 24,
    size: 24,
    font: fonts.display,
    color: INK,
  })

  page.drawText(studentLabel(model.student), {
    x: MARGIN,
    y: NAME_BASELINE - 14,
    size: 14,
    font: fonts.display,
    color: INK,
  })

  const meta = `${model.student.section} · ${successLabel(model.total)} · ${periodLabel(model)}`
  page.drawText(meta, {
    x: MARGIN,
    y: META_BASELINE - 8.5,
    size: 8.5,
    font: fonts.bold,
    color: MUTED,
  })

  page.drawLine({
    start: { x: MARGIN, y: STUDENT_RULE_Y },
    end: { x: A4_WIDTH - MARGIN, y: STUDENT_RULE_Y },
    thickness: 0.6,
    color: LINE,
  })
}

function drawDomainHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  domain: Domain,
  count: number,
  x: number,
  y: number,
): number {
  const color = DOMAIN_COLORS[domain.id] ?? FALLBACK_COLOR
  const countLabel = successLabel(count)

  page.drawCircle({ x: x + 3, y: y - 7, size: 3.2, color })
  page.drawText(domain.label.toUpperCase(), {
    x: x + 11,
    y: y - 9,
    size: 8,
    font: fonts.bold,
    color: INK,
  })
  page.drawText(countLabel, {
    x: x + COLUMN_WIDTH - fonts.regular.widthOfTextAtSize(countLabel, 7),
    y: y - 9,
    size: 7,
    font: fonts.regular,
    color: MUTED,
  })

  return y - DOMAIN_HEADER_HEIGHT
}

function drawPlaceholder(
  page: PDFPage,
  fonts: { regular: PDFFont },
  entry: BilanEntry,
  x: number,
  top: number,
): void {
  const color = DOMAIN_SOFT[entry.domainId] ?? FALLBACK_SOFT
  const label = entry.photo === undefined ? 'Observation' : 'Photo'

  page.drawRectangle({
    x,
    y: top - THUMB_HEIGHT,
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    color,
    borderColor: LINE,
    borderWidth: 0.6,
  })
  page.drawText(label, {
    x: x + (THUMB_WIDTH - fonts.regular.widthOfTextAtSize(label, 5.6)) / 2,
    y: top - THUMB_HEIGHT / 2 - 2,
    size: 5.6,
    font: fonts.regular,
    color: MUTED,
  })
}

function drawEntry(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  entry: BilanEntry,
  image: PDFImage | null | undefined,
  x: number,
  top: number,
): number {
  if (image !== null && image !== undefined) {
    page.drawImage(image, {
      x,
      y: top - THUMB_HEIGHT,
      width: THUMB_WIDTH,
      height: THUMB_HEIGHT,
    })
  } else {
    drawPlaceholder(page, fonts, entry, x, top)
  }

  const textX = x + THUMB_WIDTH + THUMB_GAP
  const lines = wrapText(entry.objectiveLabel, fonts.bold, LABEL_SIZE, TEXT_WIDTH)
  let lineY = top - LABEL_SIZE

  for (const line of lines) {
    page.drawText(line, {
      x: textX,
      y: lineY,
      size: LABEL_SIZE,
      font: fonts.bold,
      color: INK,
    })
    lineY -= LABEL_LINE_HEIGHT
  }

  const date =
    entry.photo === undefined
      ? `${formatShortDate(entry.date)} · Observation en classe`
      : formatShortDate(entry.date)
  page.drawText(date, {
    x: textX,
    y: top - LABEL_SIZE - lines.length * LABEL_LINE_HEIGHT,
    size: DATE_SIZE,
    font: fonts.regular,
    color: MUTED,
  })

  return top - measureEntry(entry, fonts.bold) - ENTRY_GAP
}

/** Hauteur d'une entrée, vignette et libellé compris, sans l'espacement suivant. */
function measureEntry(entry: BilanEntry, bold: PDFFont): number {
  const lines = wrapText(entry.objectiveLabel, bold, LABEL_SIZE, TEXT_WIDTH)
  const textHeight = lines.length * LABEL_LINE_HEIGHT + DATE_LINE_HEIGHT
  return Math.max(THUMB_HEIGHT, textHeight)
}

function drawSignature(
  page: PDFPage,
  fonts: { regular: PDFFont },
  x: number,
  top: number,
): void {
  const label = 'Signature des parents'
  const lineWidth = 150
  const lineY = top - 30

  page.drawText(label, {
    x: x + COLUMN_WIDTH - fonts.regular.widthOfTextAtSize(label, 7.5),
    y: lineY + 7,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  })
  page.drawLine({
    start: { x: x + COLUMN_WIDTH - lineWidth, y: lineY },
    end: { x: x + COLUMN_WIDTH, y: lineY },
    thickness: 0.7,
    color: INK,
  })
}

function drawFooter(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  pageNumber: number,
  pageCount: number,
): void {
  const pageLabel = `Page ${pageNumber} / ${pageCount}`

  page.drawLine({
    start: { x: MARGIN, y: 42 },
    end: { x: A4_WIDTH - MARGIN, y: 42 },
    thickness: 0.6,
    color: LINE,
  })
  page.drawText('Petite pousse', {
    x: MARGIN,
    y: 30,
    size: 6.8,
    font: fonts.regular,
    color: MUTED,
  })
  page.drawText(pageLabel, {
    x: A4_WIDTH - MARGIN - fonts.bold.widthOfTextAtSize(pageLabel, 6.8),
    y: 30,
    size: 6.8,
    font: fonts.bold,
    color: MUTED,
  })
}

/**
 * Génère le bilan A4 d'un élève.
 *
 * Le contenu remplit la colonne gauche de haut en bas, puis la droite, puis une
 * nouvelle page. L'en-tête et le pied sont redessinés sur chaque page après la
 * pagination, pour que « Page n / N » connaisse le total.
 */
export async function generateBilanPdf(
  model: BilanModel,
  meta: BilanPdfMeta,
  fonts: PdfFonts,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)

  const regular = await document.embedFont(fonts.regular, { subset: true })
  const bold = await document.embedFont(fonts.bold, { subset: true })
  const display = await document.embedFont(fonts.display, { subset: true })

  document.setTitle(`Bilan de ${studentLabel(model.student)}`)
  document.setSubject('Bilan des réussites')
  document.setAuthor(meta.teacherName.trim() || meta.schoolName.trim() || 'Petite pousse')
  document.setCreator('Petite pousse')
  document.setProducer('Petite pousse')
  document.setLanguage('fr-FR')
  // Affiche le titre du document dans la barre de la visionneuse, utile quand
  // plusieurs bilans sont ouverts. Le PDF reste non balisé : l'aperçu HTML est
  // la version accessible.
  document.catalog.set(
    PDFName.of('ViewerPreferences'),
    document.context.obj({ DisplayDocTitle: true }),
  )

  const images = await embedPhotos(document, model)
  const pages: PDFPage[] = []

  let page!: PDFPage
  let column: 0 | 1 = 0
  let cursorY = 0

  function startPage(): void {
    page = document.addPage([A4_WIDTH, A4_HEIGHT])
    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      color: PAPER,
    })
    drawHeader(page, { regular, bold }, model, meta)

    const first = pages.length === 0
    pages.push(page)
    if (first) {
      drawTitleBlock(page, { bold, display }, model)
    }
    column = 0
    cursorY = first ? FIRST_PAGE_CONTENT_TOP : NEXT_PAGE_CONTENT_TOP
  }

  function advanceColumn(): void {
    if (column === 0) {
      column = 1
      cursorY = pages.length === 1 ? FIRST_PAGE_CONTENT_TOP : NEXT_PAGE_CONTENT_TOP
      return
    }

    startPage()
  }

  /** Haut de la colonne courante : titre compris sur la première page. */
  function columnTop(): number {
    return pages.length === 1 ? FIRST_PAGE_CONTENT_TOP : NEXT_PAGE_CONTENT_TOP
  }

  function ensureSpace(height: number): void {
    if (cursorY - height < CONTENT_BOTTOM) {
      advanceColumn()
    }
  }

  startPage()

  if (model.total === 0) {
    page.drawText('Aucune réussite sur cette période.', {
      x: MARGIN,
      y: cursorY - 10,
      size: 9,
      font: bold,
      color: MUTED,
    })
    cursorY -= 20
  }

  for (const group of model.domains) {
    if (group.entries.length === 0) continue

    const domainHeight =
      DOMAIN_HEADER_HEIGHT +
      group.entries.reduce(
        (height, entry) => height + measureEntry(entry, bold) + ENTRY_GAP,
        0,
      )

    // Un domaine qui tient dans une colonne ne commence jamais en bas d'une
    // colonne pour finir dans la suivante : il bascule entier, en gardant son
    // intitulé avec ses réussites. Un domaine plus haut qu'une colonne est
    // découpé, avec un intitulé répété sur la colonne suivante.
    const columnCapacity = columnTop() - CONTENT_BOTTOM
    if (
      cursorY < columnTop() &&
      domainHeight <= columnCapacity &&
      cursorY - domainHeight < CONTENT_BOTTOM
    ) {
      advanceColumn()
    }

    // Un intitulé de domaine ne reste jamais seul en bas de colonne.
    const firstEntry = group.entries[0]
    const firstEntryHeight =
      firstEntry === undefined ? 0 : measureEntry(firstEntry, bold) + ENTRY_GAP

    ensureSpace(DOMAIN_HEADER_HEIGHT + firstEntryHeight)
    cursorY = drawDomainHeader(
      page,
      { regular, bold },
      group.domain,
      group.entries.length,
      columnX(column),
      cursorY,
    )

    for (const entry of group.entries) {
      const entryHeight = measureEntry(entry, bold) + ENTRY_GAP

      if (cursorY - entryHeight < CONTENT_BOTTOM) {
        advanceColumn()
        cursorY = drawDomainHeader(
          page,
          { regular, bold },
          group.domain,
          group.entries.length,
          columnX(column),
          cursorY,
        )
      }

      cursorY = drawEntry(
        page,
        { regular, bold },
        entry,
        images.get(entry.validationId),
        columnX(column),
        cursorY,
      )
    }
  }

  // La signature des parents termine la dernière page, en bas à droite. Si la
  // colonne droite est déjà pleine, une page supplémentaire l'accueille ; elle
  // reste comptée dans « Page n / N ».
  const activeColumn = column as 0 | 1
  if (activeColumn === 1 && cursorY < SIGNATURE_TOP) {
    startPage()
  }
  drawSignature(page, { regular }, columnX(1), SIGNATURE_TOP)

  pages.forEach((drawnPage, index) => {
    drawFooter(drawnPage, { regular, bold }, index + 1, pages.length)
  })

  return document.save()
}

/** Normalise un nom pour un nom de fichier : `Léa M.` → `lea-m`. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Nom de fichier stable et sans accents : `bilan-lea-1-2026-2027.pdf`. */
export function pdfFileName(student: Student, year: SchoolYear, period: 1 | 2): string {
  return `bilan-${slugify(studentLabel(student))}-${period}-${year.id}.pdf`
}

async function fetchFont(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Police introuvable (${String(response.status)}) : ${url}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

let fontsPromise: Promise<PdfFonts> | undefined

/**
 * Charge les trois TTF via les URL Vite, une seule fois. En cas d'échec, la
 * promesse est oubliée pour qu'un nouvel essai puisse aboutir.
 */
export function loadPdfFonts(): Promise<PdfFonts> {
  fontsPromise ??= Promise.all([
    fetchFont(regularFontUrl),
    fetchFont(boldFontUrl),
    fetchFont(displayFontUrl),
  ])
    .then(([regular, bold, display]) => ({ regular, bold, display }))
    .catch((error: unknown) => {
      fontsPromise = undefined
      throw error
    })

  return fontsPromise
}
