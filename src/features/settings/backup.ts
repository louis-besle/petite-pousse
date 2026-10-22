import { differenceInCalendarDays } from 'date-fns'
import {
  Unzip,
  UnzipInflate,
  Zip,
  ZipDeflate,
  ZipPassThrough,
  strFromU8,
  strToU8,
} from 'fflate'
import { z } from 'zod'
import { SETTINGS_ID, db, type SettingsRecord } from '@/db/db'
import { updateSettings } from '@/db/settings'
import { referential } from '@/domain/referential'
import type {
  Photo,
  SchoolYear,
  Settings,
  Student,
  Validation,
} from '@/domain/types'

/** Version du format `data.json` produit par cette version de l'application. */
const BACKUP_SCHEMA_VERSION = 1

/** Un rappel apparaît aussi après ce nombre de nouvelles réussites. */
const REMIND_AFTER_NEW_VALIDATIONS = 50

/** Un rappel apparaît quand la dernière sauvegarde a au moins ce nombre de jours. */
const REMIND_AFTER_DAYS = 30

const DATA_MISSING =
  'Ce fichier n’est pas une sauvegarde : le fichier data.json est absent.'
const DATA_CORRUPT =
  'La sauvegarde est illisible : data.json est endommagé.'
const DATA_INVALID =
  'La sauvegarde est invalide : data.json ne respecte pas le format attendu.'
const SCHEMA_TOO_RECENT =
  'Cette sauvegarde vient d’une version plus récente de l’application. ' +
  'Mets à jour l’application avant de la restaurer.'
const ZIP_UNREADABLE =
  'Le fichier ZIP est illisible ou endommagé. Vérifie que tu as choisi le bon fichier.'
const REFERENTIAL_MISSING =
  'La sauvegarde est incomplète : le fichier referential.json est absent.'
const REFERENTIAL_INVALID =
  'La sauvegarde est incomplète : referential.json est illisible.'

/** Métadonnées d'une photo dans `data.json` ; les octets vivent dans le ZIP. */
export interface BackupPhotoMetadata {
  id: string
  validationId: string
  path: string
  thumbPath: string
  width: number
  height: number
  mime: 'image/jpeg'
  createdAt: string
}

/** Contenu de `data.json`, avec la ligne de réglages complète (`id: 'app'`). */
export interface BackupData {
  schemaVersion: number
  exportedAt: string
  settings: SettingsRecord
  schoolYears: SchoolYear[]
  students: Student[]
  validations: Validation[]
  photos: BackupPhotoMetadata[]
}

/** Octets d'une photo et de sa vignette, relus depuis le ZIP. */
export interface BackupPhotoFiles {
  id: string
  validationId: string
  full: Blob
  thumb: Blob
}

/** Sauvegarde validée en mémoire, prête pour `restoreBackup`. */
export interface BackupPackage {
  data: BackupData
  /** Référentiel embarqué au moment de l'export, conservé pour traçabilité. */
  referential: unknown
  photos: BackupPhotoFiles[]
  summary: BackupSummary
}

export interface BackupSummary {
  students: number
  years: number
  validations: number
  photos: number
  exportedAt: string
  schemaVersion: number
}

const schoolYearSchema = z.object({
  id: z.string().min(1),
  start: z.string().min(1),
  period1End: z.string().min(1),
  period2End: z.string().min(1),
})

const studentSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastNameInitial: z.string().optional(),
  section: z.enum(['PS', 'MS', 'GS']),
  createdAt: z.string().min(1),
})

const validationSnapshotSchema = z.object({
  objectiveLabel: z.string().min(1),
  domainId: z.enum(['langage', 'maths', 'corps', 'arts', 'temps', 'vivant']),
  domainLabel: z.string().min(1),
  ageBand: z.enum(['before4', 'from4', 'from5']),
  example: z.string().optional(),
  referentialVersion: z.string().min(1),
})

const validationSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
  objectiveId: z.string().min(1),
  schoolYearId: z.string().min(1),
  date: z.string().min(1),
  photoId: z.string().min(1).optional(),
  snapshot: validationSnapshotSchema,
  createdAt: z.string().min(1),
})

const photoMetadataSchema = z.object({
  id: z.string().min(1),
  validationId: z.string().min(1),
  path: z.string().min(1),
  thumbPath: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mime: z.literal('image/jpeg'),
  createdAt: z.string().min(1),
})

const settingsSchema = z.object({
  id: z.literal(SETTINGS_ID),
  schoolName: z.string(),
  className: z.string(),
  teacherName: z.string(),
  currentSchoolYearId: z.string().min(1),
  lastBackupAt: z.string().min(1).optional(),
  lastBackupValidationCount: z.number().int().nonnegative(),
  referentialVersion: z.string().min(1),
  schemaVersion: z.number().int(),
})

const backupDataSchema = z.object({
  schemaVersion: z.number().int(),
  exportedAt: z.string().min(1),
  settings: settingsSchema,
  schoolYears: z.array(schoolYearSchema),
  students: z.array(studentSchema),
  validations: z.array(validationSchema),
  photos: z.array(photoMetadataSchema),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Enveloppe un callback de progression pour garantir une suite croissante
 * entre 0 et 1, même quand un appelant remonte une valeur imprécise.
 */
function progressReporter(
  onProgress: (ratio: number) => void,
): (ratio: number) => void {
  let last = 0

  return (ratio) => {
    const next = Math.max(last, Math.min(1, ratio))
    last = next
    onProgress(next)
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }

  return output
}

/**
 * Lit un ZIP en streaming et retourne les octets de chaque entrée. Les photos
 * sont conservées une par une pour la restauration ; le ZIP lui-même n'est
 * jamais matérialisé en une seule copie de tous les fichiers.
 */
async function readZipEntries(
  file: File,
): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    throw new Error(ZIP_UNREADABLE)
  }

  const entries = new Map<string, Uint8Array<ArrayBuffer>>()
  let failure: unknown

  const unzip = new Unzip((entry) => {
    const chunks: Uint8Array<ArrayBuffer>[] = []

    entry.ondata = (error, chunk, final) => {
      if (error) {
        failure = error
        return
      }
      if (chunk.length > 0) chunks.push(chunk)
      if (final) entries.set(entry.name, concatBytes(chunks))
    }

    entry.start()
  })
  unzip.register(UnzipInflate)

  try {
    unzip.push(bytes, true)
  } catch {
    throw new Error(ZIP_UNREADABLE)
  }

  if (failure !== undefined) {
    throw new Error(ZIP_UNREADABLE)
  }

  return entries
}

/**
 * Exporte toutes les données dans un ZIP complet, en streaming :
 * `data.json`, `referential.json`, `photos/<id>.jpg`, `thumbs/<id>.jpg`.
 *
 * Les JPEG passent sans recompression ; les JSON sont dégonflés. Chaque photo
 * est lue puis poussée immédiatement dans l'archive : aucune collection de
 * tous les octets n'est conservée en mémoire.
 */
export async function exportBackup(
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const report = progressReporter(onProgress)
  report(0)

  const [settings, schoolYears, students, validations, photoRows] =
    await Promise.all([
      db.settings.get(SETTINGS_ID),
      db.schoolYears.toArray(),
      db.students.toArray(),
      db.validations.toArray(),
      db.photos.toArray(),
    ])

  if (!settings) {
    throw new Error(
      'Les réglages sont introuvables : la sauvegarde ne peut pas être créée.',
    )
  }

  const exportedAt = new Date().toISOString()
  const photoMetadata: BackupPhotoMetadata[] = photoRows.map((photo) => ({
    id: photo.id,
    validationId: photo.validationId,
    path: `photos/${photo.id}.jpg`,
    thumbPath: `thumbs/${photo.id}.jpg`,
    width: photo.width,
    height: photo.height,
    mime: photo.mime,
    createdAt: photo.createdAt,
  }))

  // La copie des réglages porte déjà la date et le compteur de l'export :
  // restaurer cette sauvegarde ne déclenche donc pas un rappel immédiat.
  const data: BackupData = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    settings: {
      ...settings,
      id: SETTINGS_ID,
      lastBackupAt: exportedAt,
      lastBackupValidationCount: validations.length,
    },
    schoolYears,
    students,
    validations,
    photos: photoMetadata,
  }

  const totalFiles = 2 + photoRows.length * 2
  let completedFiles = 0

  function markFileWritten(): void {
    completedFiles += 1
    report(completedFiles / totalFiles)
  }

  const chunks: Uint8Array<ArrayBuffer>[] = []
  let resolveArchive!: (blob: Blob) => void
  let rejectArchive!: (error: unknown) => void
  const archive = new Promise<Blob>((resolve, reject) => {
    resolveArchive = resolve
    rejectArchive = reject
  })

  const zip = new Zip((error, chunk, final) => {
    if (error) {
      rejectArchive(error)
      return
    }
    if (chunk.length > 0) chunks.push(chunk)
    if (final) resolveArchive(new Blob(chunks, { type: 'application/zip' }))
  })

  function addDeflated(name: string, bytes: Uint8Array): void {
    const file = new ZipDeflate(name, { level: 6 })
    zip.add(file)
    file.push(bytes, true)
    markFileWritten()
  }

  function addStored(name: string, bytes: Uint8Array): void {
    const file = new ZipPassThrough(name)
    zip.add(file)
    file.push(bytes, true)
    markFileWritten()
  }

  try {
    addDeflated('data.json', strToU8(JSON.stringify(data)))
    addDeflated('referential.json', strToU8(JSON.stringify(referential)))

    for (const photo of photoRows) {
      addStored(
        `photos/${photo.id}.jpg`,
        new Uint8Array(await photo.full.arrayBuffer()),
      )
      addStored(
        `thumbs/${photo.id}.jpg`,
        new Uint8Array(await photo.thumb.arrayBuffer()),
      )
    }

    zip.end()
  } catch (error) {
    rejectArchive(error)
  }

  const blob = await archive
  report(1)

  await updateSettings({
    lastBackupAt: exportedAt,
    lastBackupValidationCount: validations.length,
  })

  return blob
}

/**
 * Lit et valide entièrement un ZIP avant de toucher à la base : version de
 * schéma, `data.json`, `referential.json`, cohérence des photos et présence de
 * chaque fichier référencé. Toute anomalie rejette la sauvegarde.
 */
export async function readBackup(
  file: File,
  onProgress: (ratio: number) => void,
): Promise<BackupPackage> {
  const report = progressReporter(onProgress)
  report(0)

  const entries = await readZipEntries(file)
  report(0.3)

  const dataBytes = entries.get('data.json')
  if (!dataBytes) {
    throw new Error(DATA_MISSING)
  }

  let rawData: unknown
  try {
    rawData = JSON.parse(strFromU8(dataBytes))
  } catch {
    throw new Error(DATA_CORRUPT)
  }

  // La version est contrôlée avant le schéma complet : une sauvegarde future
  // peut avoir une forme différente et doit quand même recevoir un message clair.
  if (
    !isRecord(rawData) ||
    typeof rawData.schemaVersion !== 'number' ||
    !Number.isInteger(rawData.schemaVersion)
  ) {
    throw new Error(DATA_INVALID)
  }
  if (rawData.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(SCHEMA_TOO_RECENT)
  }
  if (rawData.schemaVersion < BACKUP_SCHEMA_VERSION) {
    throw new Error(DATA_INVALID)
  }

  const parsed = backupDataSchema.safeParse(rawData)
  if (!parsed.success) {
    throw new Error(DATA_INVALID)
  }
  const data = parsed.data

  for (const photo of data.photos) {
    if (
      photo.path !== `photos/${photo.id}.jpg` ||
      photo.thumbPath !== `thumbs/${photo.id}.jpg`
    ) {
      throw new Error(DATA_INVALID)
    }
  }

  const referentialBytes = entries.get('referential.json')
  if (!referentialBytes) {
    throw new Error(REFERENTIAL_MISSING)
  }

  let rawReferential: unknown
  try {
    rawReferential = JSON.parse(strFromU8(referentialBytes))
  } catch {
    throw new Error(REFERENTIAL_INVALID)
  }
  if (!isRecord(rawReferential) || typeof rawReferential.version !== 'string') {
    throw new Error(REFERENTIAL_INVALID)
  }

  const metadataById = new Map(
    data.photos.map((photo) => [photo.id, photo] as const),
  )

  for (const validation of data.validations) {
    if (
      validation.photoId !== undefined &&
      !metadataById.has(validation.photoId)
    ) {
      throw new Error(
        `La sauvegarde est incomplète : la photo de la réussite « ` +
          `${validation.snapshot.objectiveLabel} » est absente du fichier ZIP.`,
      )
    }
  }

  const photos: BackupPhotoFiles[] = []
  for (let index = 0; index < data.photos.length; index += 1) {
    const metadata = data.photos[index]!
    const full = entries.get(metadata.path)
    const thumb = entries.get(metadata.thumbPath)

    if (!full) {
      throw new Error(
        `La sauvegarde est incomplète : la photo « ${metadata.id} » est ` +
          'absente du fichier ZIP.',
      )
    }
    if (!thumb) {
      throw new Error(
        `La sauvegarde est incomplète : la vignette de la photo ` +
          `« ${metadata.id} » est absente du fichier ZIP.`,
      )
    }

    photos.push({
      id: metadata.id,
      validationId: metadata.validationId,
      full: new Blob([full], { type: metadata.mime }),
      thumb: new Blob([thumb], { type: metadata.mime }),
    })

    // Libère les octets bruts au fur et à mesure : sur une grosse sauvegarde,
    // les entrées déjà transformées en Blob ne restent pas une seconde fois
    // en mémoire.
    entries.delete(metadata.path)
    entries.delete(metadata.thumbPath)

    report(0.3 + (0.7 * (index + 1)) / data.photos.length)
  }

  report(1)

  return {
    data,
    referential: rawReferential,
    photos,
    summary: {
      students: data.students.length,
      years: data.schoolYears.length,
      validations: data.validations.length,
      photos: data.photos.length,
      exportedAt: data.exportedAt,
      schemaVersion: data.schemaVersion,
    },
  }
}

/**
 * Remplace intégralement le contenu de la base par la sauvegarde, dans une
 * seule transaction d'écriture : une erreur annule tout et laisse la base
 * précédente intacte. `ensureSeed` n'est jamais appelé dans la transaction.
 */
export async function restoreBackup(
  backup: BackupPackage,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const report = progressReporter(onProgress)
  report(0)

  const { data } = backup
  const filesById = new Map(
    backup.photos.map((photo) => [photo.id, photo] as const),
  )

  await db.transaction(
    'rw',
    [
      db.settings,
      db.schoolYears,
      db.students,
      db.validations,
      db.photos,
      db.drafts,
    ],
    async () => {
      await db.settings.clear()
      await db.schoolYears.clear()
      await db.students.clear()
      await db.validations.clear()
      await db.photos.clear()
      await db.drafts.clear()
      report(0.15)

      await db.settings.put({ ...data.settings, id: SETTINGS_ID })
      report(0.25)

      if (data.schoolYears.length > 0) {
        await db.schoolYears.bulkPut(data.schoolYears)
      }
      report(0.4)

      if (data.students.length > 0) {
        await db.students.bulkPut(data.students)
      }
      report(0.55)

      if (data.validations.length > 0) {
        await db.validations.bulkPut(data.validations)
      }
      report(0.7)

      const photoRecords: Photo[] = data.photos.map((metadata) => {
        const files = filesById.get(metadata.id)
        if (!files) {
          throw new Error(
            `La sauvegarde est incomplète : la photo « ${metadata.id} » ` +
              'est absente de la restauration.',
          )
        }

        return {
          id: metadata.id,
          validationId: metadata.validationId,
          full: files.full,
          thumb: files.thumb,
          width: metadata.width,
          height: metadata.height,
          mime: metadata.mime,
          createdAt: metadata.createdAt,
        }
      })

      if (photoRecords.length > 0) {
        await db.photos.bulkPut(photoRecords)
      }
      report(0.95)

      // Un brouillon de capture ne doit jamais survivre au remplacement.
      await db.drafts.clear()
    },
  )

  report(1)
}

/**
 * Vrai quand il est temps de proposer une sauvegarde.
 *
 * - Jamais sauvegardé : dès qu'une réussite existe, il y a quelque chose à
 *   perdre, donc rappel immédiat.
 * - Sinon : 30 jours calendaires ou 50 nouvelles réussites depuis la dernière
 *   sauvegarde. La comparaison se fait en jours locaux pour éviter les
 *   décalages de fuseau autour de minuit.
 */
export function shouldRemindBackup(
  settings: Settings,
  totalValidations: number,
): boolean {
  if (settings.lastBackupAt === undefined) {
    return totalValidations > 0
  }

  if (
    totalValidations - settings.lastBackupValidationCount >=
    REMIND_AFTER_NEW_VALIDATIONS
  ) {
    return true
  }

  const lastBackup = new Date(settings.lastBackupAt)
  if (Number.isNaN(lastBackup.getTime())) {
    return totalValidations > 0
  }

  return differenceInCalendarDays(new Date(), lastBackup) >= REMIND_AFTER_DAYS
}
