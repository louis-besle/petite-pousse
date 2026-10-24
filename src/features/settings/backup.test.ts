import { Blob as NodeBlob } from 'node:buffer'
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from 'fflate'
import { SETTINGS_ID, db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { getSettings, updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective } from '@/domain/types'
import { makeSchoolYear, makeSettings, makeStudent } from '@/test/fixtures'
import {
  exportBackup,
  readBackup,
  restoreBackup,
  shouldRemindBackup,
  type BackupPackage,
} from './backup'

/** En-tête JPEG minimal exigé par la validation des photos restaurées. */
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

/**
 * Le `Blob` de jsdom ne survit pas au clone structuré de fake-indexeddb ;
 * celui de Node est conservé (même procédé que les tests du dossier photo).
 */
function jpegBlob(content: string): Blob {
  return new NodeBlob([JPEG_MAGIC, content], {
    type: 'image/jpeg',
  }) as unknown as Blob
}

function objectiveAt(index: number): Objective {
  const objective = referential.objectives[index]
  if (!objective) {
    throw new Error(`Référentiel de test incomplet : pas d'objectif à l'index ${index}.`)
  }
  return objective
}

/** Le ZIP exporté est lu comme un fichier, exactement comme un import réel. */
async function asZipFile(blob: Blob, name = 'sauvegarde.zip'): Promise<File> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return new File([bytes], name, { type: 'application/zip' })
}

async function zipBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function rewriteZip(files: Unzipped): File {
  const bytes = zipSync(files)
  return new File([bytes], 'sauvegarde-modifiee.zip', { type: 'application/zip' })
}

/** Sous-ensemble modifiable de `data.json` pour les tests d'intégrité. */
interface EditableBackupData {
  schemaVersion: number
  settings: {
    currentSchoolYearId: string
    [key: string]: unknown
  }
  schoolYears: { id: string; [key: string]: unknown }[]
  students: { id: string; [key: string]: unknown }[]
  validations: {
    id: string
    studentId: string
    schoolYearId: string
    photoId?: string
    date: string
    createdAt: string
    [key: string]: unknown
  }[]
  photos: {
    id: string
    validationId: string
    [key: string]: unknown
  }[]
}

async function mutateBackupData(
  blob: Blob,
  mutate: (data: EditableBackupData) => void,
): Promise<File> {
  const files = unzipSync(await zipBytes(blob))
  const dataEntry = files['data.json']
  if (!dataEntry) throw new Error('data.json absent du ZIP de test.')

  const data = JSON.parse(strFromU8(dataEntry)) as EditableBackupData
  mutate(data)
  files['data.json'] = strToU8(JSON.stringify(data))
  return rewriteZip(files)
}

async function tableCounts() {
  return {
    students: await db.students.count(),
    years: await db.schoolYears.count(),
    validations: await db.validations.count(),
    photos: await db.photos.count(),
    settings: await db.settings.count(),
    drafts: await db.drafts.count(),
  }
}

function expectMonotonicProgress(ratios: number[]): void {
  expect(ratios.length).toBeGreaterThan(0)
  expect(ratios[0]).toBe(0)
  expect(ratios.at(-1)).toBe(1)

  for (let index = 0; index < ratios.length; index += 1) {
    const ratio = ratios[index]!
    expect(ratio).toBeGreaterThanOrEqual(0)
    expect(ratio).toBeLessThanOrEqual(1)
    if (index > 0) {
      expect(ratio).toBeGreaterThanOrEqual(ratios[index - 1]!)
    }
  }
}

async function seedBackupData() {
  await ensureSeed()

  const year = makeSchoolYear()
  await db.schoolYears.put(year)
  await updateSettings({
    currentSchoolYearId: year.id,
    schoolName: 'École des Tilleuls',
    className: 'GS B',
    teacherName: 'Mme Perrin',
  })

  const lea = makeStudent({ firstName: 'Léa', section: 'MS' })
  const adam = makeStudent({ firstName: 'Adam', section: 'PS' })
  await db.students.bulkAdd([lea, adam])

  const fullText = 'photo-pleine-de-lea'
  const thumbText = 'vignette-de-lea'

  const leaValidation = await createValidation({
    studentId: lea.id,
    objective: objectiveAt(0),
    ageBand: 'from4',
    date: '2026-10-12',
    referentialVersion: REFERENTIAL_VERSION,
    photo: {
      full: jpegBlob(fullText),
      thumb: jpegBlob(thumbText),
      width: 800,
      height: 600,
      mime: 'image/jpeg',
    },
  })

  const adamValidation = await createValidation({
    studentId: adam.id,
    objective: objectiveAt(1),
    ageBand: 'before4',
    date: '2026-10-13',
    referentialVersion: REFERENTIAL_VERSION,
  })

  await db.drafts.put({
    id: 'current',
    studentId: lea.id,
    createdAt: '2026-10-12T10:00:00.000Z',
  })

  const photo = leaValidation.photoId
    ? await db.photos.get(leaValidation.photoId)
    : undefined
  if (!photo) {
    throw new Error('La photo de test n’a pas été créée.')
  }

  return {
    lea,
    adam,
    leaValidation,
    adamValidation,
    photo,
  }
}

/**
 * fake-indexeddb ne clône que les Blob de Node ; jsdom fournit le sien. On
 * convertit donc les Blobs relus par `readBackup` avant de les réinsérer,
 * comme les autres tests de photos le font pour leurs données d'entrée.
 */
async function withNodeBlobs(backup: BackupPackage): Promise<BackupPackage> {
  const photos = await Promise.all(
    backup.photos.map(async (photo) => ({
      ...photo,
      full: new NodeBlob([await photo.full.arrayBuffer()], {
        type: 'image/jpeg',
      }) as unknown as Blob,
      thumb: new NodeBlob([await photo.thumb.arrayBuffer()], {
        type: 'image/jpeg',
      }) as unknown as Blob,
    })),
  )

  return { ...backup, photos }
}

async function clearAllData(): Promise<void> {
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
    },
  )
}

// Les ZIP passent par de vrais Blobs et de vraies transactions IndexedDB :
// le délai par défaut de Vitest est trop court sur une machine chargée.
const ZIP_TIMEOUT_MS = 30_000

describe('exportBackup / readBackup / restoreBackup', () => {
  it(
    'exporte puis restaure élèves, années, réussites, réglages et octets des photos',
    async () => {
      const {
        lea,
        adam,
        leaValidation,
        adamValidation,
        photo,
      } = await seedBackupData()
      const settingsBeforeExport = await getSettings()

      const exportProgress: number[] = []
      const blob = await exportBackup((ratio) => exportProgress.push(ratio))

      expect(blob.size).toBeGreaterThan(0)
      expect(blob.type).toBe('application/zip')
      expectMonotonicProgress(exportProgress)

      const settingsAfterExport = await getSettings()
      expect(settingsAfterExport.lastBackupAt).toBeDefined()
      expect(settingsAfterExport.lastBackupValidationCount).toBe(2)

      await clearAllData()
      expect(await db.students.count()).toBe(0)
      expect(await db.validations.count()).toBe(0)
      expect(await db.photos.count()).toBe(0)
      expect(await db.settings.count()).toBe(0)

      const readProgress: number[] = []
      const backup = await readBackup(await asZipFile(blob), (ratio) =>
        readProgress.push(ratio),
      )

      expect(backup.summary.students).toBe(2)
      expect(backup.summary.validations).toBe(2)
      expect(backup.summary.photos).toBe(1)
      expect(backup.summary.years).toBe(backup.data.schoolYears.length)
      expect(backup.summary.years).toBeGreaterThanOrEqual(1)
      expect(backup.data.exportedAt).toBe(settingsAfterExport.lastBackupAt)
      expectMonotonicProgress(readProgress)

      const restoreProgress: number[] = []
      await restoreBackup(await withNodeBlobs(backup), (ratio) =>
        restoreProgress.push(ratio),
      )
      expectMonotonicProgress(restoreProgress)

      expect(await db.students.get(lea.id)).toEqual(lea)
      expect(await db.students.get(adam.id)).toEqual(adam)
      expect(await db.validations.get(leaValidation.id)).toEqual(leaValidation)
      expect(await db.validations.get(adamValidation.id)).toEqual(adamValidation)
      expect(await db.photos.count()).toBe(1)

      const restoredPhoto = await db.photos.get(photo.id)
      expect(restoredPhoto).toBeDefined()
      expect(restoredPhoto?.mime).toBe('image/jpeg')
      expect(restoredPhoto?.width).toBe(photo.width)
      expect(restoredPhoto?.height).toBe(photo.height)
      expect(
        new Uint8Array(await restoredPhoto!.full.arrayBuffer()),
      ).toEqual(new Uint8Array(await photo.full.arrayBuffer()))
      expect(
        new Uint8Array(await restoredPhoto!.thumb.arrayBuffer()),
      ).toEqual(new Uint8Array(await photo.thumb.arrayBuffer()))

      expect(await db.schoolYears.get(makeSchoolYear().id)).toBeDefined()
      expect(await db.schoolYears.count()).toBe(backup.data.schoolYears.length)

      const restoredSettings = await getSettings()
      expect(restoredSettings.schoolName).toBe(settingsBeforeExport.schoolName)
      expect(restoredSettings.className).toBe(settingsBeforeExport.className)
      expect(restoredSettings.teacherName).toBe(settingsBeforeExport.teacherName)
      expect(restoredSettings.lastBackupValidationCount).toBe(2)
      expect(restoredSettings.lastBackupAt).toBe(settingsAfterExport.lastBackupAt)

      // Les brouillons de capture ne font pas partie de la sauvegarde.
      expect(await db.drafts.count()).toBe(0)
      expect((await db.settings.get(SETTINGS_ID))?.id).toBe(SETTINGS_ID)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse un ZIP sans data.json et laisse la base intacte',
    async () => {
      await ensureSeed()
      await db.students.add(makeStudent({ firstName: 'Léa' }))
      const before = await tableCounts()

      const file = new File(
        [zipSync({ 'referential.json': strToU8('{"version":"2026.1.0"}') })],
        'sans-data.zip',
        { type: 'application/zip' },
      )

      await expect(readBackup(file, () => {})).rejects.toThrow(/data\.json/)
      expect(await tableCounts()).toEqual(before)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse une sauvegarde d’une version de schéma plus récente',
    async () => {
      await seedBackupData()
      const before = await tableCounts()

      const blob = await exportBackup(() => {})
      const files = unzipSync(await zipBytes(blob))
      const dataEntry = files['data.json']
      if (!dataEntry) throw new Error('data.json absent du ZIP de test.')

      const data = JSON.parse(strFromU8(dataEntry)) as { schemaVersion: number }
      data.schemaVersion = 2
      files['data.json'] = strToU8(JSON.stringify(data))

      await expect(readBackup(rewriteZip(files), () => {})).rejects.toThrow(
        /version plus récente/,
      )
      expect(await tableCounts()).toEqual(before)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse une photo référencée absente du ZIP avant toute restauration',
    async () => {
      const { photo } = await seedBackupData()
      const before = await tableCounts()

      const blob = await exportBackup(() => {})
      const files = unzipSync(await zipBytes(blob))
      const photoPath = `photos/${photo.id}.jpg`
      expect(files[photoPath]).toBeDefined()
      delete files[photoPath]

      await expect(readBackup(rewriteZip(files), () => {})).rejects.toThrow(
        /incomplète|photo/i,
      )
      expect(await tableCounts()).toEqual(before)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse une réussite dont l’élève est absent et laisse la base intacte',
    async () => {
      const { leaValidation } = await seedBackupData()
      const before = await tableCounts()

      const file = await mutateBackupData(await exportBackup(() => {}), (data) => {
        const validation = data.validations.find(
          (candidate) => candidate.id === leaValidation.id,
        )
        if (!validation) throw new Error('Réussite absente du ZIP de test.')
        validation.studentId = 'student-absent'
      })

      await expect(readBackup(file, () => {})).rejects.toThrow(/élève absent/)
      expect(await tableCounts()).toEqual(before)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse une année en cours absente des années et laisse la base intacte',
    async () => {
      await seedBackupData()
      const before = await tableCounts()

      const file = await mutateBackupData(await exportBackup(() => {}), (data) => {
        data.settings.currentSchoolYearId = '2099-2100'
      })

      await expect(readBackup(file, () => {})).rejects.toThrow(
        /année scolaire en cours/,
      )
      expect(await tableCounts()).toEqual(before)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse une photo vide et laisse la base intacte',
    async () => {
      const { photo } = await seedBackupData()
      const before = await tableCounts()

      const blob = await exportBackup(() => {})
      const files = unzipSync(await zipBytes(blob))
      files[`photos/${photo.id}.jpg`] = new Uint8Array(0)

      await expect(readBackup(rewriteZip(files), () => {})).rejects.toThrow(
        /vide/,
      )
      expect(await tableCounts()).toEqual(before)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse une photo qui n’est pas un JPEG et laisse la base intacte',
    async () => {
      const { photo } = await seedBackupData()
      const before = await tableCounts()

      const blob = await exportBackup(() => {})
      const files = unzipSync(await zipBytes(blob))
      files[`thumbs/${photo.id}.jpg`] = strToU8('pas une image JPEG')

      await expect(readBackup(rewriteZip(files), () => {})).rejects.toThrow(
        /JPEG/,
      )
      expect(await tableCounts()).toEqual(before)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'lit un ZIP de plus de 1 Mio par morceaux avec une progression intermédiaire',
    async () => {
      await ensureSeed()
      const student = makeStudent({ firstName: 'Léa' })
      await db.students.add(student)

      const largeBytes = new Uint8Array(1_500_000)
      largeBytes.set(JPEG_MAGIC)
      const largePhoto = new NodeBlob([largeBytes], {
        type: 'image/jpeg',
      }) as unknown as Blob

      await createValidation({
        studentId: student.id,
        objective: objectiveAt(0),
        ageBand: 'from4',
        date: '2026-10-12',
        referentialVersion: REFERENTIAL_VERSION,
        photo: {
          full: largePhoto,
          thumb: jpegBlob('vignette'),
          width: 800,
          height: 600,
          mime: 'image/jpeg',
        },
      })

      const blob = await exportBackup(() => {})
      expect(blob.size).toBeGreaterThan(1024 * 1024)

      const ratios: number[] = []
      const backup = await readBackup(await asZipFile(blob), (ratio) =>
        ratios.push(ratio),
      )

      expect(backup.summary.photos).toBe(1)
      expectMonotonicProgress(ratios)
      // La lecture par morceaux produit au moins une valeur intermédiaire
      // avant la fin de la phase de décompression (0 à 0,9).
      expect(ratios.some((ratio) => ratio > 0 && ratio < 0.9)).toBe(true)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'met à jour lastBackupAt et lastBackupValidationCount après une exportation',
    async () => {
      await ensureSeed()
      await db.students.add(makeStudent({ firstName: 'Léa' }))
      await createValidation({
        studentId: (await db.students.toArray())[0]!.id,
        objective: objectiveAt(0),
        ageBand: 'from4',
        date: '2026-10-12',
        referentialVersion: REFERENTIAL_VERSION,
      })

      const before = Date.now()
      await exportBackup(() => {})
      const after = Date.now()

      const stored = await db.settings.get(SETTINGS_ID)
      expect(stored?.lastBackupValidationCount).toBe(1)
      expect(stored?.lastBackupAt).toBeDefined()

      const stamp = new Date(stored!.lastBackupAt!).getTime()
      expect(stamp).toBeGreaterThanOrEqual(before)
      expect(stamp).toBeLessThanOrEqual(after)
    },
    ZIP_TIMEOUT_MS,
  )
})

describe('shouldRemindBackup', () => {
  const now = new Date(2026, 10, 7, 12, 0, 0)

  function daysAgo(days: number): string {
    const date = new Date(now)
    date.setDate(date.getDate() - days)
    return date.toISOString()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rappelle dès la première réussite quand aucune sauvegarde n’existe', () => {
    expect(shouldRemindBackup(makeSettings(), 0)).toBe(false)
    expect(shouldRemindBackup(makeSettings(), 1)).toBe(true)
  })

  it('rappelle après 30 jours sans sauvegarde', () => {
    expect(
      shouldRemindBackup(makeSettings({ lastBackupAt: daysAgo(29) }), 10),
    ).toBe(false)
    expect(
      shouldRemindBackup(makeSettings({ lastBackupAt: daysAgo(31) }), 10),
    ).toBe(true)
  })

  it('rappelle à partir de 50 nouvelles réussites', () => {
    const recent = makeSettings({
      lastBackupAt: daysAgo(0),
      lastBackupValidationCount: 10,
    })

    expect(shouldRemindBackup(recent, 59)).toBe(false)
    expect(shouldRemindBackup(recent, 60)).toBe(true)
  })
})
