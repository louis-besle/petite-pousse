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
import { DOMAIN_IDS, referential } from '@/domain/referential'
import { schoolYearIdForDate } from '@/domain/schoolYear'
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

/** Taille des morceaux lus depuis le fichier, jamais tout le ZIP d'un coup. */
const READ_CHUNK_SIZE = 1024 * 1024

/** Part de la progression consacrée à la lecture/décompression du ZIP. */
const READ_PHASE_RATIO = 0.9

/**
 * Format du manifeste de chiffrement, premier fichier de l'archive. Il reste
 * en clair : il porte les paramètres KDF et le jeton de vérification.
 */
const BACKUP_FORMAT = 'carnet-de-reussites-backup'
const MANIFEST_ENTRY = 'manifest.json'
const ENCRYPTION_VERSION = 1
const KDF_NAME = 'PBKDF2'
const KDF_HASH = 'SHA-256'
const KDF_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12
const GCM_TAG_LENGTH = 128
const CHECK_TOKEN = 'carnet-de-reussites'

/** Longueur minimale du mot de passe, partagée avec le panneau. */
export const BACKUP_PASSWORD_MIN_LENGTH = 8

/**
 * Erreur de lecture/validation d'une sauvegarde. Le panneau peut afficher son
 * message français ; toute autre erreur inattendue reste générique.
 */
export class BackupReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupReadError'
  }
}

/** La sauvegarde est chiffrée : un mot de passe est nécessaire pour la lire. */
export class BackupPasswordRequiredError extends BackupReadError {
  constructor(
    message = 'Cette sauvegarde est chiffrée : son mot de passe est nécessaire pour la lire.',
  ) {
    super(message)
    this.name = 'BackupPasswordRequiredError'
  }
}

/**
 * WebCrypto n'est pas disponible : aucune sauvegarde chiffrée ne peut être
 * produite. Afficher ce message précis plutôt qu'une erreur de stockage.
 */
export class BackupEncryptionUnavailableError extends Error {
  constructor(
    message = 'Le chiffrement n’est pas disponible sur cet appareil : la sauvegarde chiffrée n’a pas été créée.',
  ) {
    super(message)
    this.name = 'BackupEncryptionUnavailableError'
  }
}

/** Le mot de passe fourni ne correspond pas au jeton de vérification. */
export class BackupWrongPasswordError extends BackupReadError {
  constructor(
    message = 'Le mot de passe est incorrect. Vérifie-le et réessaie.',
  ) {
    super(message)
    this.name = 'BackupWrongPasswordError'
  }
}

/** L'authentification GCM a échoué : le contenu chiffré a été altéré. */
export class BackupCorruptedError extends BackupReadError {
  constructor(
    message = 'La sauvegarde chiffrée est endommagée ou a été modifiée : elle ne peut pas être lue.',
  ) {
    super(message)
    this.name = 'BackupCorruptedError'
  }
}

const DATA_MISSING =
  'Ce fichier n’est pas une sauvegarde : le fichier data.json est absent.'
const DATA_CORRUPT =
  'La sauvegarde est illisible : data.json est endommagé.'
const DATA_INVALID =
  'La sauvegarde est invalide : data.json ne respecte pas le format attendu.'
const SCHEMA_TOO_RECENT =
  'Cette sauvegarde vient d’une version plus récente de l’application. ' +
  'Mets à jour l’application avant de la restaurer.'
const SCHEMA_TOO_OLD =
  'Cette sauvegarde a été créée par une version trop ancienne de l’application ' +
  'et ne peut pas être restaurée.'
const ZIP_UNREADABLE =
  'Le fichier ZIP est illisible ou endommagé. Vérifie que tu as choisi le bon fichier.'
const REFERENTIAL_MISSING =
  'La sauvegarde est incomplète : le fichier referential.json est absent.'
const REFERENTIAL_INVALID =
  'La sauvegarde est incomplète : referential.json est illisible.'
const MANIFEST_INVALID =
  'La sauvegarde est illisible : les informations de chiffrement sont invalides.'

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
  /** Vrai quand l'archive était chiffrée par mot de passe. */
  encrypted: boolean
}

/** Options d'export ; `password` active le chiffrement de toutes les entrées. */
export interface BackupExportOptions {
  password?: string
}

/**
 * Manifeste en clair, toujours premier fichier d'une archive chiffrée. Le
 * jeton `check` prouve que le mot de passe dérive la bonne clé.
 */
interface BackupManifest {
  format: typeof BACKUP_FORMAT
  version: typeof ENCRYPTION_VERSION
  encrypted: true
  kdf: {
    name: typeof KDF_NAME
    hash: typeof KDF_HASH
    iterations: typeof KDF_ITERATIONS
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    tagLength: typeof GCM_TAG_LENGTH
  }
  check: {
    iv: string
    data: string
  }
}

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(ENCRYPTION_VERSION),
  encrypted: z.literal(true),
  kdf: z.object({
    name: z.literal(KDF_NAME),
    hash: z.literal(KDF_HASH),
    iterations: z.literal(KDF_ITERATIONS),
    salt: z.string().min(1),
  }),
  cipher: z.object({
    name: z.literal('AES-GCM'),
    tagLength: z.literal(GCM_TAG_LENGTH),
  }),
  check: z.object({
    iv: z.string().min(1),
    data: z.string().min(1),
  }),
})

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
  domainId: z.enum(DOMAIN_IDS),
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

/**
 * WebCrypto n'est pas garanti (navigateur ancien, contexte non sécurisé) :
 * l'export chiffré doit échouer clairement plutôt que produire un ZIP en
 * clair. Aucun repli silencieux n'est permis.
 */
function requireSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new BackupEncryptionUnavailableError()
  }
  return subtle
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = requireSubtle()
  const material = await subtle.importKey(
    'raw',
    new Uint8Array(strToU8(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: KDF_HASH },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Chiffre une entrée : IV aléatoire de 12 octets préfixé au chiffré GCM. */
async function encryptBytes(
  key: CryptoKey,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await requireSubtle().encrypt(
    { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH },
    key,
    bytes,
  )
  return concatBytes([iv, new Uint8Array(ciphertext)])
}

/** Déchiffre une entrée ; toute altération devient une erreur de corruption. */
async function decryptBytes(
  key: CryptoKey,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  if (bytes.length <= IV_BYTES) {
    throw new BackupCorruptedError()
  }

  const iv = bytes.slice(0, IV_BYTES)
  const ciphertext = bytes.subarray(IV_BYTES) as Uint8Array<ArrayBuffer>

  try {
    const plaintext = await requireSubtle().decrypt(
      { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH },
      key,
      ciphertext,
    )
    return new Uint8Array(plaintext)
  } catch {
    throw new BackupCorruptedError()
  }
}

async function createManifest(
  password: string,
): Promise<{ manifest: BackupManifest; key: CryptoKey }> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const key = await deriveKey(password, salt, KDF_ITERATIONS)
  const check = await encryptBytes(key, new Uint8Array(strToU8(CHECK_TOKEN)))

  return {
    manifest: {
      format: BACKUP_FORMAT,
      version: ENCRYPTION_VERSION,
      encrypted: true,
      kdf: {
        name: KDF_NAME,
        hash: KDF_HASH,
        iterations: KDF_ITERATIONS,
        salt: bytesToBase64(salt),
      },
      cipher: { name: 'AES-GCM', tagLength: GCM_TAG_LENGTH },
      check: {
        iv: bytesToBase64(check.slice(0, IV_BYTES)),
        data: bytesToBase64(check.slice(IV_BYTES)),
      },
    },
    key,
  }
}

/**
 * Vérifie le manifeste puis le jeton avant toute déchiffration : un mauvais
 * mot de passe est signalé comme tel, jamais comme un fichier corrompu.
 */
async function unlockManifest(
  manifestText: string,
  password: string,
): Promise<CryptoKey> {
  let raw: unknown
  try {
    raw = JSON.parse(manifestText)
  } catch {
    throw new BackupCorruptedError(MANIFEST_INVALID)
  }

  const parsed = manifestSchema.safeParse(raw)
  if (!parsed.success) {
    throw new BackupCorruptedError(MANIFEST_INVALID)
  }

  let salt: Uint8Array<ArrayBuffer>
  let iv: Uint8Array<ArrayBuffer>
  let data: Uint8Array<ArrayBuffer>
  try {
    salt = base64ToBytes(parsed.data.kdf.salt)
    iv = base64ToBytes(parsed.data.check.iv)
    data = base64ToBytes(parsed.data.check.data)
  } catch {
    throw new BackupCorruptedError(MANIFEST_INVALID)
  }

  // Le manifeste est en clair : ses longueurs doivent être exactes pour que
  // WebCrypto ne transforme pas un fichier malformé en « mauvais mot de passe ».
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || data.length === 0) {
    throw new BackupCorruptedError(MANIFEST_INVALID)
  }

  const key = await deriveKey(password, salt, parsed.data.kdf.iterations)

  let token: Uint8Array
  try {
    token = new Uint8Array(
      await requireSubtle().decrypt(
        { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH },
        key,
        data,
      ),
    )
  } catch {
    throw new BackupWrongPasswordError()
  }

  if (strFromU8(token) !== CHECK_TOKEN) {
    throw new BackupWrongPasswordError()
  }

  return key
}

interface ZipContents {
  /** Photos et vignettes déjà converties en Blob, sans octets bruts doublés. */
  photos: Map<string, Blob>
  /** `data.json` et `referential.json` décodés une fois leur entrée terminée. */
  json: Map<string, string>
  /** Manifeste de chiffrement, présent uniquement dans une archive chiffrée. */
  manifest?: string
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isValidCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function isValidTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime())
}

function assertUniqueIds(ids: string[], label: string): void {
  const seen = new Set<string>()

  for (const id of ids) {
    if (seen.has(id)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : plusieurs ${label} partagent ` +
          `l’identifiant « ${id} ».`,
      )
    }
    seen.add(id)
  }
}

/**
 * Vérifie les liens entre entités avant toute écriture : année en cours,
 * élèves et années référencés, cohérence des photos, dates et doublons.
 */
function assertBackupIntegrity(data: BackupData): void {
  if (data.settings.id !== SETTINGS_ID) {
    throw new BackupReadError(
      'La sauvegarde est invalide : les réglages ne portent pas l’identifiant attendu.',
    )
  }

  assertUniqueIds(
    data.schoolYears.map((year) => year.id),
    'années scolaires',
  )
  assertUniqueIds(
    data.students.map((student) => student.id),
    'élèves',
  )
  assertUniqueIds(
    data.validations.map((validation) => validation.id),
    'réussites',
  )
  assertUniqueIds(
    data.photos.map((photo) => photo.id),
    'photos',
  )

  const yearIds = new Set(data.schoolYears.map((year) => year.id))
  const studentIds = new Set(data.students.map((student) => student.id))
  const validationIds = new Set(
    data.validations.map((validation) => validation.id),
  )
  const photoById = new Map(data.photos.map((photo) => [photo.id, photo]))

  if (!yearIds.has(data.settings.currentSchoolYearId)) {
    throw new BackupReadError(
      `La sauvegarde est invalide : l’année scolaire en cours ` +
        `« ${data.settings.currentSchoolYearId} » est absente du fichier.`,
    )
  }

  for (const year of data.schoolYears) {
    if (
      !isValidCalendarDate(year.start) ||
      !isValidCalendarDate(year.period1End) ||
      !isValidCalendarDate(year.period2End)
    ) {
      throw new BackupReadError(
        `La sauvegarde est invalide : les bornes de l’année scolaire ` +
          `« ${year.id} » sont invalides.`,
      )
    }

    // Mêmes invariants que `updateSchoolYearPeriods` : une année acceptée ici
    // doit rester affichable après restauration, sans faire lever `periodRange`.
    if (!(year.start < year.period1End && year.period1End < year.period2End)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : l’année scolaire « ${year.id} » a des ` +
          'dates incohérentes.',
      )
    }
  }

  for (const validation of data.validations) {
    if (!studentIds.has(validation.studentId)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : la réussite « ${validation.id} » ` +
          'référence un élève absent.',
      )
    }

    if (!yearIds.has(validation.schoolYearId)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : la réussite « ${validation.id} » ` +
          'référence une année scolaire absente.',
      )
    }

    if (!isValidCalendarDate(validation.date)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : la date de la réussite ` +
          `« ${validation.id} » est invalide.`,
      )
    }

    // L'application classe toujours une réussite par sa date : une sauvegarde
    // qui pointe vers une autre année serait ensuite invisible ou incohérente.
    if (schoolYearIdForDate(validation.date) !== validation.schoolYearId) {
      throw new BackupReadError(
        'La sauvegarde est invalide : une réussite de la sauvegarde est ' +
          'datée hors de son année scolaire.',
      )
    }

    if (!isValidTimestamp(validation.createdAt)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : la date de création de la réussite ` +
          `« ${validation.id} » est invalide.`,
      )
    }

    if (validation.photoId !== undefined) {
      const photo = photoById.get(validation.photoId)
      if (!photo) {
        throw new BackupReadError(
          `La sauvegarde est invalide : la photo de la réussite ` +
            `« ${validation.id} » est absente des métadonnées.`,
        )
      }
      if (photo.validationId !== validation.id) {
        throw new BackupReadError(
          `La sauvegarde est invalide : la photo « ${photo.id} » ne ` +
            `correspond pas à la réussite « ${validation.id} ».`,
        )
      }
    }
  }

  for (const photo of data.photos) {
    if (!validationIds.has(photo.validationId)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : la photo « ${photo.id} » référence ` +
          'une réussite absente.',
      )
    }
    if (!isValidTimestamp(photo.createdAt)) {
      throw new BackupReadError(
        `La sauvegarde est invalide : la date de création de la photo ` +
          `« ${photo.id} » est invalide.`,
      )
    }
  }
}

/**
 * Lit un ZIP en streaming, par morceaux de 1 Mio. Chaque entrée est accumulée
 * seulement jusqu'à son `final`, puis convertie immédiatement en Blob (photos)
 * ou en chaîne JSON : les octets bruts ne sont jamais conservés en double.
 *
 * Les entrées chiffrées sont déchiffrées une par une : au plus un lot de
 * 1 Mio de chiffré attend pendant qu'une entrée est déchiffrée. Le manifeste
 * est écrit en premier par l'export ; dès qu'il est lu, le mot de passe est
 * vérifié avant de déchiffrer quoi que ce soit.
 */
async function readZipEntries(
  file: File,
  onReadProgress: (ratio: number) => void,
  password: string | undefined,
): Promise<ZipContents> {
  const photos = new Map<string, Blob>()
  const json = new Map<string, string>()
  let manifest: string | undefined
  let failure: unknown
  let pending: { name: string; bytes: Uint8Array<ArrayBuffer> }[] = []
  let key: CryptoKey | undefined

  const unzip = new Unzip((entry) => {
    const isPhoto =
      entry.name.startsWith('photos/') || entry.name.startsWith('thumbs/')
    const isJson =
      entry.name === 'data.json' || entry.name === 'referential.json'

    if (!isPhoto && !isJson && entry.name !== MANIFEST_ENTRY) {
      entry.ondata = () => {}
      entry.start()
      return
    }

    const chunks: Uint8Array<ArrayBuffer>[] = []
    entry.ondata = (error, chunk, final) => {
      if (error) {
        failure = error
        return
      }
      if (chunk.length > 0) chunks.push(chunk)
      if (!final) return

      pending.push({ name: entry.name, bytes: concatBytes(chunks) })
      // Les références aux morceaux sont libérées dès la conversion.
      chunks.length = 0
    }

    entry.start()
  })
  unzip.register(UnzipInflate)

  async function flushPending(): Promise<void> {
    if (pending.length === 0) return

    const batch = pending
    pending = []

    for (const item of batch) {
      if (item.name === MANIFEST_ENTRY) {
        if (key !== undefined) continue
        if (password === undefined || password === '') {
          throw new BackupPasswordRequiredError()
        }
        let text: string
        try {
          text = strFromU8(item.bytes)
        } catch {
          throw new BackupCorruptedError(MANIFEST_INVALID)
        }
        key = await unlockManifest(text, password)
        manifest = text
        continue
      }

      const bytes =
        key === undefined ? item.bytes : await decryptBytes(key, item.bytes)

      if (item.name.startsWith('photos/') || item.name.startsWith('thumbs/')) {
        photos.set(item.name, new Blob([bytes], { type: 'image/jpeg' }))
      } else {
        json.set(item.name, strFromU8(bytes))
      }
    }
  }

  const size = file.size
  if (size <= 0) {
    throw new BackupReadError(ZIP_UNREADABLE)
  }

  let offset = 0
  while (offset < size) {
    const end = Math.min(offset + READ_CHUNK_SIZE, size)
    let chunk: Uint8Array
    try {
      chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer())
    } catch {
      throw new BackupReadError(ZIP_UNREADABLE)
    }
    offset = end

    try {
      unzip.push(chunk, false)
    } catch {
      throw new BackupReadError(ZIP_UNREADABLE)
    }

    await flushPending()
    onReadProgress(offset / size)
  }

  try {
    unzip.push(new Uint8Array(0), true)
  } catch {
    throw new BackupReadError(ZIP_UNREADABLE)
  }

  await flushPending()

  if (failure !== undefined) {
    throw new BackupReadError(ZIP_UNREADABLE)
  }

  return manifest === undefined ? { photos, json } : { photos, json, manifest }
}

async function assertJpegBlob(blob: Blob, label: string): Promise<void> {
  if (blob.size === 0) {
    throw new BackupReadError(
      `La sauvegarde est incomplète : ${label} est vide.`,
    )
  }

  const head = new Uint8Array(await blob.slice(0, 3).arrayBuffer())
  if (head.length < 3 || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    throw new BackupReadError(
      `La sauvegarde est corrompue : ${label} n’est pas une image JPEG.`,
    )
  }
}

/**
 * Exporte toutes les données dans un ZIP complet, en streaming :
 * `data.json`, `referential.json`, `photos/<id>.jpg`, `thumbs/<id>.jpg`.
 *
 * Sans mot de passe, les JPEG passent sans recompression et les JSON sont
 * dégonflés. Avec un mot de passe, `manifest.json` est écrit en clair puis
 * chaque entrée est chiffrée en AES-256-GCM et stockée sans compression.
 * Chaque photo est lue puis poussée immédiatement dans l'archive : aucune
 * collection de tous les octets n'est conservée en mémoire.
 */
export async function exportBackup(
  onProgress: (ratio: number) => void,
  options?: BackupExportOptions,
): Promise<Blob> {
  const report = progressReporter(onProgress)
  report(0)

  const password = options?.password
  const encryptionPassword =
    password !== undefined && password !== '' ? password : undefined
  const encrypting = encryptionPassword !== undefined

  if (
    encryptionPassword !== undefined &&
    encryptionPassword.length < BACKUP_PASSWORD_MIN_LENGTH
  ) {
    throw new Error(
      `Le mot de passe doit contenir au moins ${BACKUP_PASSWORD_MIN_LENGTH} caractères.`,
    )
  }

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

  const totalFiles = 2 + (encrypting ? 1 : 0) + photoRows.length * 2
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

  let encryption: { manifest: BackupManifest; key: CryptoKey } | undefined
  if (encryptionPassword !== undefined) {
    encryption = await createManifest(encryptionPassword)
  }

  // Le chiffrement n'est pas compressé : `ZipPassThrough` évite un second
  // passage sur les octets et garde une empreinte mémoire bornée.
  async function addJson(
    name: string,
    bytes: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    if (encryption === undefined) {
      addDeflated(name, bytes)
      return
    }
    const key = encryption.key
    addStored(name, await encryptBytes(key, bytes))
  }

  async function addBinary(
    name: string,
    bytes: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    if (encryption === undefined) {
      addStored(name, bytes)
      return
    }
    const key = encryption.key
    addStored(name, await encryptBytes(key, bytes))
  }

  try {
    if (encryption !== undefined) {
      addStored(MANIFEST_ENTRY, strToU8(JSON.stringify(encryption.manifest)))
    }
    await addJson('data.json', new Uint8Array(strToU8(JSON.stringify(data))))
    await addJson(
      'referential.json',
      new Uint8Array(strToU8(JSON.stringify(referential))),
    )

    for (const photo of photoRows) {
      await addBinary(
        `photos/${photo.id}.jpg`,
        new Uint8Array(await photo.full.arrayBuffer()),
      )
      await addBinary(
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
 *
 * Un manifeste impose le mot de passe ; un mot de passe fourni pour une
 * ancienne sauvegarde en clair est simplement ignoré.
 */
export async function readBackup(
  file: File,
  onProgress: (ratio: number) => void,
  password?: string,
): Promise<BackupPackage> {
  const report = progressReporter(onProgress)
  report(0)

  const contents = await readZipEntries(
    file,
    (ratio) => report(READ_PHASE_RATIO * ratio),
    password,
  )
  report(READ_PHASE_RATIO)

  const dataText = contents.json.get('data.json')
  if (dataText === undefined) {
    throw new BackupReadError(DATA_MISSING)
  }

  let rawData: unknown
  try {
    rawData = JSON.parse(dataText)
  } catch {
    throw new BackupReadError(DATA_CORRUPT)
  }

  // La version est contrôlée avant le schéma complet : une sauvegarde future
  // peut avoir une forme différente et doit quand même recevoir un message clair.
  if (
    !isRecord(rawData) ||
    typeof rawData.schemaVersion !== 'number' ||
    !Number.isInteger(rawData.schemaVersion)
  ) {
    throw new BackupReadError(DATA_INVALID)
  }
  if (rawData.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupReadError(SCHEMA_TOO_RECENT)
  }
  if (rawData.schemaVersion < BACKUP_SCHEMA_VERSION) {
    throw new BackupReadError(SCHEMA_TOO_OLD)
  }

  const parsed = backupDataSchema.safeParse(rawData)
  if (!parsed.success) {
    throw new BackupReadError(DATA_INVALID)
  }
  const data = parsed.data

  for (const photo of data.photos) {
    if (
      photo.path !== `photos/${photo.id}.jpg` ||
      photo.thumbPath !== `thumbs/${photo.id}.jpg`
    ) {
      throw new BackupReadError(DATA_INVALID)
    }
  }

  assertBackupIntegrity(data)

  const referentialText = contents.json.get('referential.json')
  if (referentialText === undefined) {
    throw new BackupReadError(REFERENTIAL_MISSING)
  }

  let rawReferential: unknown
  try {
    rawReferential = JSON.parse(referentialText)
  } catch {
    throw new BackupReadError(REFERENTIAL_INVALID)
  }
  if (!isRecord(rawReferential) || typeof rawReferential.version !== 'string') {
    throw new BackupReadError(REFERENTIAL_INVALID)
  }

  const photos: BackupPhotoFiles[] = []
  for (let index = 0; index < data.photos.length; index += 1) {
    const metadata = data.photos[index]!
    const full = contents.photos.get(metadata.path)
    const thumb = contents.photos.get(metadata.thumbPath)

    if (!full) {
      throw new BackupReadError(
        `La sauvegarde est incomplète : la photo « ${metadata.id} » est ` +
          'absente du fichier ZIP.',
      )
    }
    if (!thumb) {
      throw new BackupReadError(
        `La sauvegarde est incomplète : la vignette de la photo ` +
          `« ${metadata.id} » est absente du fichier ZIP.`,
      )
    }

    await assertJpegBlob(full, `la photo « ${metadata.id} »`)
    await assertJpegBlob(thumb, `la vignette de la photo « ${metadata.id} »`)

    photos.push({
      id: metadata.id,
      validationId: metadata.validationId,
      full,
      thumb,
    })

    report(
      READ_PHASE_RATIO +
        ((1 - READ_PHASE_RATIO) * (index + 1)) / data.photos.length,
    )
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
      encrypted: contents.manifest !== undefined,
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
