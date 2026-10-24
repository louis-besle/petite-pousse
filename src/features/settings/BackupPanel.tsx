import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { db } from '@/db/db'
import { useSettings } from '@/db/settings'
import { useAllValidations } from '@/db/validations'
import { todayIso } from '@/lib/date'
import { downloadBlob } from '@/lib/share'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/useToast'
import {
  BACKUP_PASSWORD_MIN_LENGTH,
  BackupEncryptionUnavailableError,
  BackupPasswordRequiredError,
  BackupReadError,
  BackupWrongPasswordError,
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
 * Carte de sauvegarde : export ZIP complet (en clair ou chiffré par mot de
 * passe), import avec résumé et confirmation du remplacement, date de la
 * dernière sauvegarde et rappel.
 *
 * L'import ne touche à la base qu'après lecture et validation complètes du ZIP,
 * puis confirmation explicite. Le fichier est décompressé en streaming et
 * validé avant la transaction de remplacement. Une archive chiffrée ouvre une
 * feuille de mot de passe ; un mauvais mot de passe laisse la feuille ouverte.
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
  const [largeImport, setLargeImport] = useState<File | undefined>()

  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [passwordRequest, setPasswordRequest] = useState<File | undefined>()
  const [importPassword, setImportPassword] = useState('')
  const [importError, setImportError] = useState<string | undefined>()
  const [showImportPassword, setShowImportPassword] = useState(false)

  const totalValidations = validations?.length ?? 0
  const loading = settings === undefined || validations === undefined
  const busy = phase !== 'idle'
  const reminder =
    settings !== undefined && shouldRemindBackup(settings, totalValidations)
  const percent = Math.round(progress * 100)

  const passwordTooShort =
    password !== '' && password.length < BACKUP_PASSWORD_MIN_LENGTH
  const passwordMismatch = confirmation !== '' && password !== confirmation
  const passwordReady =
    password.length >= BACKUP_PASSWORD_MIN_LENGTH &&
    password === confirmation
  const canExport = !protect || passwordReady

  async function runExport(exportPassword?: string): Promise<void> {
    setSizeWarning(false)
    setPhase('exporting')
    setProgress(0)

    try {
      const blob = await exportBackup(
        setProgress,
        exportPassword === undefined ? undefined : { password: exportPassword },
      )
      const suffix = exportPassword === undefined ? '' : '-chiffre'
      downloadBlob(
        blob,
        `carnet-de-reussites-backup-${todayIso()}${suffix}.zip`,
      )
      showToast('Sauvegarde téléchargée.')
      setProtect(false)
      setPassword('')
      setConfirmation('')
      setShowPassword(false)
    } catch (error) {
      console.error('Création de la sauvegarde impossible.', error)
      showToast(
        error instanceof BackupEncryptionUnavailableError
          ? error.message
          : EXPORT_ERROR,
      )
    } finally {
      setPhase('idle')
      setProgress(0)
    }
  }

  async function handleExportClick(): Promise<void> {
    if (busy) return
    if (protect && !passwordReady) return

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

    await runExport(protect ? password : undefined)
  }

  function closePasswordSheet(): void {
    setPasswordRequest(undefined)
    setImportPassword('')
    setImportError(undefined)
    setShowImportPassword(false)
  }

  async function readSelectedFile(
    file: File,
    importPasswordValue?: string,
  ): Promise<void> {
    setPhase('reading')
    setProgress(0)

    try {
      const backup = await readBackup(file, setProgress, importPasswordValue)
      closePasswordSheet()
      setPending(backup)
    } catch (error) {
      // L'erreur brute reste dans la console ; l'interface ne montre que du
      // français maîtrisé, même si le décodeur remonte un message anglais.
      console.error('Lecture de la sauvegarde impossible.', error)

      if (error instanceof BackupPasswordRequiredError) {
        setPasswordRequest(file)
        setImportPassword('')
        setImportError(undefined)
      } else if (error instanceof BackupWrongPasswordError) {
        // La feuille reste ouverte : le fichier choisi est conservé.
        setImportError(error.message)
      } else {
        closePasswordSheet()
        showToast(
          error instanceof BackupReadError ? error.message : READ_ERROR,
        )
      }
    } finally {
      setPhase('idle')
      setProgress(0)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    // Permet de réimporter le même fichier immédiatement après une annulation.
    event.target.value = ''

    if (file === undefined) return

    if (file.size > LARGE_BACKUP_BYTES) {
      setLargeImport(file)
      return
    }

    void readSelectedFile(file)
  }

  function confirmLargeImport(): void {
    const file = largeImport
    setLargeImport(undefined)
    if (file !== undefined) {
      void readSelectedFile(file)
    }
  }

  async function handlePasswordSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    const file = passwordRequest
    if (file === undefined || importPassword === '' || phase === 'reading') {
      return
    }
    await readSelectedFile(file, importPassword)
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
        <p className={styles.hint}>
          <strong>Sans mot de passe, le ZIP n’est pas chiffré.</strong> Il
          contient des données personnelles et les photos des enfants. Conserve-le
          dans un endroit protégé et supprime-le après le transfert.
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

        <div className={styles.passwordBlock}>
          <label className={styles.checkboxRow} htmlFor="backup-protect">
            <input
              id="backup-protect"
              className={styles.checkbox}
              type="checkbox"
              checked={protect}
              disabled={busy || loading}
              onChange={(event) => {
                setProtect(event.target.checked)
                if (!event.target.checked) {
                  setPassword('')
                  setConfirmation('')
                  setShowPassword(false)
                }
              }}
            />
            Protéger par un mot de passe
          </label>

          {protect ? (
            <>
              <div className={styles.passwordField}>
                <span className={styles.label} aria-hidden="true">
                  Mot de passe
                </span>
                <Field
                  label="Mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <div className={styles.passwordField}>
                <span className={styles.label} aria-hidden="true">
                  Confirmation du mot de passe
                </span>
                <Field
                  label="Confirmer le mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmation}
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>

              <div className={styles.passwordActions}>
                <Button
                  variant="ghost"
                  aria-pressed={showPassword}
                  disabled={busy}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                </Button>
              </div>

              {passwordTooShort ? (
                <p className={styles.passwordHint}>
                  Le mot de passe doit contenir au moins{' '}
                  {BACKUP_PASSWORD_MIN_LENGTH} caractères.
                </p>
              ) : null}
              {passwordMismatch ? (
                <p className={styles.passwordError} role="alert">
                  Les deux mots de passe ne correspondent pas.
                </p>
              ) : null}

              <p className={styles.warning}>
                Sans ce mot de passe, la sauvegarde est définitivement illisible.
                Il n’existe aucun moyen de le récupérer.
              </p>
            </>
          ) : null}
        </div>

        {phase === 'exporting' ||
        (phase === 'reading' && passwordRequest === undefined) ? (
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
          disabled={busy || loading || !canExport}
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
          aria-hidden="true"
          tabIndex={-1}
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
        onConfirm={() => void runExport(protect ? password : undefined)}
        onClose={() => setSizeWarning(false)}
      />

      <ConfirmSheet
        open={largeImport !== undefined}
        title="Importer une grosse sauvegarde ?"
        description={
          <>
            Cette sauvegarde dépasse 300 Mo. Sa lecture peut prendre plusieurs
            minutes et demander beaucoup de mémoire. Garde l’écran allumé et
            branche l’appareil.
          </>
        }
        confirmLabel="Continuer l’import"
        onConfirm={confirmLargeImport}
        onClose={() => setLargeImport(undefined)}
      />

      <Sheet
        open={passwordRequest !== undefined}
        title="Sauvegarde chiffrée"
        onClose={() => {
          if (phase !== 'reading') closePasswordSheet()
        }}
      >
        <form
          className={styles.passwordForm}
          onSubmit={(event) => void handlePasswordSubmit(event)}
        >
          <p className={styles.hint}>
            Cette sauvegarde est protégée par un mot de passe. Saisis-le pour
            pouvoir la lire.
          </p>

          <div className={styles.passwordField}>
            <span className={styles.label} aria-hidden="true">
              Mot de passe
            </span>
            <Field
              label="Mot de passe"
              type={showImportPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={importPassword}
              disabled={phase === 'reading'}
              onChange={(event) => {
                setImportPassword(event.target.value)
                setImportError(undefined)
              }}
            />
          </div>

          <div className={styles.passwordActions}>
            <Button
              variant="ghost"
              aria-pressed={showImportPassword}
              disabled={phase === 'reading'}
              onClick={() => setShowImportPassword((visible) => !visible)}
            >
              {showImportPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            </Button>
          </div>

          {importError !== undefined ? (
            <p className={styles.passwordError} role="alert">
              {importError}
            </p>
          ) : null}

          {phase === 'reading' ? (
            <div className={styles.backupProgress}>
              <progress
                className={styles.progress}
                value={percent}
                max={100}
                aria-label="Progression de la lecture"
                aria-valuetext={`${percent} %`}
              />
              <p className={styles.status} aria-live="polite">
                Lecture de la sauvegarde… {percent} %
              </p>
            </div>
          ) : null}

          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="dark"
              fullWidth
              disabled={importPassword === '' || phase === 'reading'}
            >
              Lire la sauvegarde
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={phase === 'reading'}
              onClick={closePasswordSheet}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Sheet>

      <ConfirmSheet
        open={pending !== undefined}
        title="Restaurer cette sauvegarde ?"
        tone="danger"
        description={
          pending === undefined ? null : (
            <>
              La sauvegarde contient {summaryText(pending.summary)}, exportée le{' '}
              {backupDateLabel(pending.summary.exportedAt)}.{' '}
              {pending.summary.encrypted ? (
                <strong>Sauvegarde chiffrée.</strong>
              ) : null}{' '}
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
