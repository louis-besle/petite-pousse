import { useRef, useState, type ChangeEvent } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { db } from '@/db/db'
import { useSettings } from '@/db/settings'
import { useAllValidations } from '@/db/validations'
import { todayIso } from '@/lib/date'
import { downloadBlob } from '@/lib/share'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { useToast } from '@/ui/useToast'
import {
  exportBackup,
  readBackup,
  restoreBackup,
  shouldRemindBackup,
  type BackupPackage,
  type BackupSummary,
} from './backup'
import styles from './settings.module.css'

/** Au-delà, l'export est confirmé explicitement avant de démarrer. */
const LARGE_BACKUP_BYTES = 300 * 1024 * 1024

/** Estimation prudente du JSON de `data.json` pour le calcul de taille. */
const JSON_BASE_BYTES = 50_000
const JSON_BYTES_PER_VALIDATION = 600
const JSON_BYTES_PER_PHOTO = 300

const EXPORT_ERROR =
  'La sauvegarde n’a pas pu être créée. Le stockage local est peut-être plein. Réessaie.'
const READ_ERROR =
  'La sauvegarde n’a pas pu être lue. Vérifie que tu as choisi le bon fichier ZIP.'
const RESTORE_ERROR =
  'La restauration a échoué. Tes données actuelles n’ont pas été modifiées. Réessaie.'

type BackupPhase = 'idle' | 'estimating' | 'exporting' | 'reading' | 'restoring'

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

function summaryText(summary: BackupSummary): string {
  return [
    plural(summary.students, 'élève', 'élèves'),
    plural(summary.years, 'année scolaire', 'années scolaires'),
    plural(summary.validations, 'réussite', 'réussites'),
    plural(summary.photos, 'photo', 'photos'),
  ].join(', ')
}

/** Date lisible d'un horodatage ISO, dans le fuseau local de l'appareil. */
function backupDateLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'date inconnue'
  }
  return format(date, 'd MMMM yyyy', { locale: fr })
}

/**
 * Carte de sauvegarde : export ZIP complet, import avec résumé et confirmation
 * du remplacement, date de la dernière sauvegarde et rappel.
 *
 * L'import ne touche à la base qu'après lecture et validation complètes du ZIP,
 * puis confirmation explicite. Le fichier est relu entièrement en mémoire avant
 * la transaction de remplacement.
 */
export function BackupPanel() {
  const { showToast } = useToast()
  const settings = useSettings()
  const validations = useAllValidations()
  const inputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<BackupPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [pending, setPending] = useState<BackupPackage | undefined>()
  const [sizeWarning, setSizeWarning] = useState(false)

  const totalValidations = validations?.length ?? 0
  const loading = settings === undefined || validations === undefined
  const busy = phase !== 'idle'
  const reminder =
    settings !== undefined && shouldRemindBackup(settings, totalValidations)
  const percent = Math.round(progress * 100)

  async function runExport(): Promise<void> {
    setSizeWarning(false)
    setPhase('exporting')
    setProgress(0)

    try {
      const blob = await exportBackup(setProgress)
      downloadBlob(blob, `carnet-de-reussites-backup-${todayIso()}.zip`)
      showToast('Sauvegarde téléchargée.')
    } catch (error) {
      console.error('Création de la sauvegarde impossible.', error)
      showToast(EXPORT_ERROR)
    } finally {
      setPhase('idle')
      setProgress(0)
    }
  }

  async function handleExportClick(): Promise<void> {
    if (busy) return

    setPhase('estimating')
    let tooLarge = false

    try {
      const photos = await db.photos.toArray()
      const photoBytes = photos.reduce(
        (total, photo) => total + photo.full.size + photo.thumb.size,
        0,
      )
      const jsonBytes =
        JSON_BASE_BYTES +
        totalValidations * JSON_BYTES_PER_VALIDATION +
        photos.length * JSON_BYTES_PER_PHOTO

      tooLarge = photoBytes + jsonBytes > LARGE_BACKUP_BYTES
    } catch (error) {
      // Une estimation impossible ne doit pas empêcher de sauvegarder.
      console.error('Estimation de la taille de la sauvegarde impossible.', error)
    }

    setPhase('idle')

    if (tooLarge) {
      setSizeWarning(true)
      return
    }

    await runExport()
  }

  async function readSelectedFile(file: File): Promise<void> {
    setPhase('reading')
    setProgress(0)

    try {
      const backup = await readBackup(file, setProgress)
      setPending(backup)
    } catch (error) {
      console.error('Lecture de la sauvegarde impossible.', error)
      showToast(error instanceof Error ? error.message : READ_ERROR)
    } finally {
      setPhase('idle')
      setProgress(0)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    // Permet de réimporter le même fichier immédiatement après une annulation.
    event.target.value = ''

    if (file !== undefined) {
      void readSelectedFile(file)
    }
  }

  async function handleRestore(): Promise<void> {
    if (pending === undefined || phase === 'restoring') return

    setPhase('restoring')
    setProgress(0)

    try {
      await restoreBackup(pending, setProgress)
      setPending(undefined)
      showToast('Sauvegarde restaurée.')
    } catch (error) {
      console.error('Restauration de la sauvegarde impossible.', error)
      showToast(RESTORE_ERROR)
    } finally {
      setPhase('idle')
      setProgress(0)
    }
  }

  const lastBackupLabel =
    settings === undefined
      ? 'Chargement…'
      : settings.lastBackupAt === undefined
        ? 'Jamais sauvegardé'
        : backupDateLabel(settings.lastBackupAt)

  return (
    <>
      <section className={styles.card} aria-labelledby="backup-heading">
        <h2 id="backup-heading" className={styles.sectionTitle}>
          Sauvegarde
        </h2>
        <p className={styles.hint}>
          Un fichier ZIP contient toutes les années, les réussites et les photos.
          Il permet de retrouver tes données sur un autre appareil.
        </p>

        <dl className={styles.backupSummary}>
          <div className={styles.rangeRow}>
            <dt className={styles.rangeLabel}>Dernière sauvegarde</dt>
            <dd className={styles.rangeValue}>{lastBackupLabel}</dd>
          </div>
          <div className={styles.rangeRow}>
            <dt className={styles.rangeLabel}>Réussites enregistrées</dt>
            <dd className={styles.rangeValue}>
              {validations === undefined
                ? 'Chargement…'
                : plural(totalValidations, 'réussite', 'réussites')}
            </dd>
          </div>
        </dl>

        {reminder ? (
          <p className={styles.warning} role="status">
            Il est temps de sauvegarder tes données pour ne pas les perdre.
            Exporte un fichier ZIP et conserve-le dans un endroit protégé.
          </p>
        ) : null}

        {phase === 'exporting' || phase === 'reading' ? (
          <div className={styles.backupProgress}>
            <div className={styles.progressRow}>
              <progress
                className={styles.progress}
                value={percent}
                max={100}
                aria-label={
                  phase === 'exporting'
                    ? 'Progression de la sauvegarde'
                    : 'Progression de la lecture'
                }
                aria-valuetext={`${percent} %`}
              />
              <span className={styles.progressValue}>{percent} %</span>
            </div>
            <p className={styles.status} aria-live="polite">
              {phase === 'exporting'
                ? `Sauvegarde en cours… ${percent} %`
                : `Lecture de la sauvegarde… ${percent} %`}
            </p>
          </div>
        ) : null}

        <Button
          variant="dark"
          fullWidth
          disabled={busy || loading}
          onClick={() => void handleExportClick()}
        >
          {phase === 'estimating' ? 'Préparation…' : 'Exporter une sauvegarde'}
        </Button>

        <Button
          variant="ghost"
          fullWidth
          disabled={busy || loading}
          onClick={() => inputRef.current?.click()}
        >
          Importer une sauvegarde
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          aria-label="Fichier de sauvegarde ZIP"
          className={styles.fileInput}
          onChange={handleFileChange}
        />
      </section>

      <ConfirmSheet
        open={sizeWarning}
        title="Sauvegarde volumineuse"
        description={
          <>
            Cette sauvegarde dépasse 300 Mo. Garde l’écran allumé et branche
            l’appareil pendant l’export : le fichier peut prendre plusieurs
            minutes.
          </>
        }
        confirmLabel="Continuer l’export"
        onConfirm={() => void runExport()}
        onClose={() => setSizeWarning(false)}
      />

      <ConfirmSheet
        open={pending !== undefined}
        title="Restaurer cette sauvegarde ?"
        description={
          pending === undefined ? null : (
            <>
              La sauvegarde contient {summaryText(pending.summary)}, exportée le{' '}
              {backupDateLabel(pending.summary.exportedAt)}.{' '}
              <strong>Toutes les données actuelles seront remplacées.</strong>
              {phase === 'restoring' ? (
                <span className={styles.backupDialogProgress}>
                  <progress
                    value={percent}
                    max={100}
                    aria-label="Progression de la restauration"
                    aria-valuetext={`${percent} %`}
                  />
                  <span aria-live="polite">Restauration… {percent} %</span>
                </span>
              ) : null}
            </>
          )
        }
        confirmLabel="Restaurer la sauvegarde"
        onConfirm={() => void handleRestore()}
        onClose={() => {
          if (phase !== 'restoring') setPending(undefined)
        }}
      />
    </>
  )
}
