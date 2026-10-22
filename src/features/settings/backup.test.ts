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

/**
 * Le `Blob` de jsdom ne survit pas au clone structuré de fake-indexeddb ;
 * celui de Node est conservé (même procédé que les tests du dossier photo).
 */
function jpegBlob(content: string): Blob {
  return new NodeBlob([content], { type: 'image/jpeg' }) as unknown as Blob
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
    fullText,
    thumbText,
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
        fullText,
        thumbText,
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
        new TextDecoder().decode(
          new Uint8Array(await restoredPhoto!.full.arrayBuffer()),
        ),
      ).toBe(fullText)
      expect(
        new TextDecoder().decode(
          new Uint8Array(await restoredPhoto!.thumb.arrayBuffer()),
        ),
      ).toBe(thumbText)

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
