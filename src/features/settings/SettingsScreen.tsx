import { useId, useState, type FormEvent } from 'react'
import { PeriodEditor } from '@/features/bilans/PeriodEditor'
import {
  startNextSchoolYear,
  useSchoolYearsState,
} from '@/db/schoolYears'
import { updateSettings, useSettingsState } from '@/db/settings'
import { useValidationsForYearState } from '@/db/validations'
import {
  nextSchoolYearId,
  periodRange,
  resolveCurrentSchoolYearId,
} from '@/domain/schoolYear'
import type { SchoolYear, Settings, Validation } from '@/domain/types'
import { formatLongDate, todayIso } from '@/lib/date'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { InstallHint, isIosDevice, useIsStandalone } from '@/ui/InstallHint'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/useToast'
import { BackupPanel } from './BackupPanel'
import { StoragePanel } from './StoragePanel'
import styles from './settings.module.css'

/** Clé locale de la notice de confidentialité lue une première fois. */
const PRIVACY_KEY = 'privacy-ack'

const SAVED_MESSAGE = 'Réglages enregistrés.'
const SAVE_ERROR = 'Les réglages n’ont pas pu être enregistrés. Réessaie.'
const LOAD_ERROR =
  'Les réglages n’ont pas pu être chargés. Le stockage local de cet appareil est ' +
  'peut-être indisponible ou plein. Ferme puis rouvre l’application ; tes données ' +
  'déjà enregistrées ne sont pas effacées.'
const READ_ERROR =
  'Les données de l’année n’ont pas pu être lues. Le stockage local de cet appareil ' +
  'est peut-être indisponible. Le formulaire et le stockage restent utilisables ; ' +
  'ferme puis rouvre l’application pour réessayer.'

/** « 2026-09-01 » → « 1er septembre 2026 ». */
function dayLabel(date: string): string {
  const formatted = formatLongDate(date)
  return formatted.startsWith('1 ') ? `1er${formatted.slice(1)}` : formatted
}

function hasAcknowledgedPrivacy(): boolean {
  try {
    return localStorage.getItem(PRIVACY_KEY) !== null
  } catch {
    // Stockage local inaccessible : on préfère afficher la notice.
    return false
  }
}

function rememberPrivacy(): void {
  try {
    localStorage.setItem(PRIVACY_KEY, '1')
  } catch {
    // La notice reviendra à la prochaine visite ; le reste de l'écran reste utilisable.
  }
}

interface SettingsFormProps {
  settings: Settings
}

/**
 * Formulaire école / classe / enseignante. Le composant est remonté quand les
 * valeurs vivantes changent (`key` côté parent) : le formulaire reste ainsi
 * synchronisé avec la base sans écraser une saisie en cours par un simple
 * rafraîchissement du même contenu.
 */
function SettingsForm({ settings }: SettingsFormProps) {
  const { showToast } = useToast()
  const schoolId = useId()
  const classId = useId()
  const teacherId = useId()

  const [schoolName, setSchoolName] = useState(settings.schoolName)
  const [className, setClassName] = useState(settings.className)
  const [teacherName, setTeacherName] = useState(settings.teacherName)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    try {
      await updateSettings({
        schoolName: schoolName.trim(),
        className: className.trim(),
        teacherName: teacherName.trim(),
      })
      showToast(SAVED_MESSAGE)
    } catch (error) {
      console.error('Enregistrement des réglages impossible.', error)
      showToast(SAVE_ERROR)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={styles.card} onSubmit={(event) => void handleSubmit(event)}>
      <h2 className={styles.sectionTitle}>École et classe</h2>
      <p className={styles.hint}>
        Ces informations apparaissent sur l’en-tête des bilans PDF.
      </p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={schoolId}>
          Nom de l’école
        </label>
        <input
          id={schoolId}
          className={styles.input}
          value={schoolName}
          autoComplete="organization"
          onChange={(event) => setSchoolName(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={classId}>
          Classe
        </label>
        <input
          id={classId}
          className={styles.input}
          value={className}
          autoComplete="off"
          onChange={(event) => setClassName(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={teacherId}>
          Prénom de l’enseignante
        </label>
        <input
          id={teacherId}
          className={styles.input}
          value={teacherName}
          autoComplete="name"
          onChange={(event) => setTeacherName(event.target.value)}
        />
      </div>

      <Button type="submit" variant="dark" fullWidth disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}

interface SchoolYearSectionProps {
  currentYearId: string
}

/** Année en cours et passage explicite à l'année suivante. */
function SchoolYearSection({ currentYearId }: SchoolYearSectionProps) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const nextId = nextSchoolYearId(currentYearId)

  async function handleConfirm(): Promise<void> {
    if (busy) return

    setBusy(true)
    try {
      const year = await startNextSchoolYear(currentYearId)
      setConfirming(false)
      showToast(`Année ${year.id} ouverte.`)
    } catch (error) {
      console.error('Passage à l’année suivante impossible.', error)
      showToast('Le passage à l’année suivante a échoué. Réessaie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className={styles.card} aria-labelledby="year-heading">
        <h2 id="year-heading" className={styles.sectionTitle}>
          Année scolaire
        </h2>
        <p className={styles.yearValue}>{currentYearId}</p>
        <p className={styles.hint}>
          Le passage à l’année suivante ouvre de nouvelles dates de bilan. La
          classe, les dossiers et les photos restent en place.
        </p>
        <Button variant="ghost" fullWidth onClick={() => setConfirming(true)}>
          Passer à l’année suivante
        </Button>
      </section>

      <ConfirmSheet
        open={confirming}
        title="Passer à l’année suivante ?"
        description={
          <>
            L’année <strong>{nextId}</strong> devient l’année en cours. Tes élèves,
            leurs réussites et leurs photos restent en place.{' '}
            <strong>Aucune réussite ne sera supprimée.</strong>
          </>
        }
        confirmLabel={`Ouvrir ${nextId}`}
        onConfirm={() => void handleConfirm()}
        onClose={() => {
          if (!busy) setConfirming(false)
        }}
      />
    </>
  )
}

interface BilanDatesSectionProps {
  year: SchoolYear
  validations: Validation[]
}

/** Bornes des deux bilans de l'année en cours, avec la date de changement. */
function BilanDatesSection({ year, validations }: BilanDatesSectionProps) {
  const [editing, setEditing] = useState(false)
  const period1 = periodRange(year, 1)
  const period2 = periodRange(year, 2)

  return (
    <>
      <section className={styles.card} aria-labelledby="bilan-dates-heading">
        <h2 id="bilan-dates-heading" className={styles.sectionTitle}>
          Dates des bilans
        </h2>
        <p className={styles.hint}>Année {year.id}</p>

        <dl className={styles.ranges}>
          <div className={styles.rangeRow}>
            <dt className={styles.rangeLabel}>Bilan 1</dt>
            <dd className={styles.rangeValue}>
              {dayLabel(period1.start)} → {dayLabel(period1.end)}
            </dd>
          </div>
          <div className={styles.rangeRow}>
            <dt className={styles.rangeLabel}>Bilan 2</dt>
            <dd className={styles.rangeValue}>
              {dayLabel(period2.start)} → {dayLabel(period2.end)}
            </dd>
          </div>
        </dl>

        <Button variant="ghost" fullWidth onClick={() => setEditing(true)}>
          Modifier la date de changement
        </Button>
      </section>

      {editing ? (
        <PeriodEditor
          year={year}
          validations={validations}
          allowPeriod2End
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}

/**
 * Installation sur l'écran d'accueil : notice iOS détaillée, ou renvoi vers le
 * menu du navigateur sur Android et ordinateur.
 */
function InstallSection() {
  const standalone = useIsStandalone()

  return (
    <section className={styles.card} aria-labelledby="install-heading">
      <h2 id="install-heading" className={styles.sectionTitle}>
        Installer l’application
      </h2>

      {standalone ? (
        <p className={styles.hint}>
          L’application est déjà installée sur cet appareil.
        </p>
      ) : (
        <>
          <InstallHint />
          {isIosDevice() ? null : (
            <p className={styles.hint}>
              Sur Android ou sur ordinateur, ouvre le menu du navigateur puis
              choisis « Installer l’application ».
            </p>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Réglages : école et classe, année scolaire, dates de bilan, stockage,
 * confidentialité et version. La notice de confidentialité s'ouvre au premier
 * lancement, puis uniquement via « Relire la notice ».
 */
export function SettingsScreen() {
  const { settings, error } = useSettingsState()
  const {
    years: schoolYears,
    error: schoolYearsError,
  } = useSchoolYearsState()
  const { validations, error: validationsError } = useValidationsForYearState(
    settings?.currentSchoolYearId ?? '',
  )
  const [privacyOpen, setPrivacyOpen] = useState(() => !hasAcknowledgedPrivacy())

  function acknowledgePrivacy(): void {
    rememberPrivacy()
    setPrivacyOpen(false)
  }

  const readError = schoolYearsError || validationsError
  const currentYear =
    settings === undefined
      ? undefined
      : (schoolYears ?? []).find((year) => year.id === settings.currentSchoolYearId)
  // Année dans laquelle une réussite datée d'aujourd'hui serait réellement
  // classée ; elle diffère des réglages pendant un passage d'année décalé.
  const effectiveYearId =
    settings === undefined || schoolYears === undefined
      ? undefined
      : resolveCurrentSchoolYearId(
          schoolYears,
          settings.currentSchoolYearId,
          todayIso(),
        )

  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Réglages</h1>
        <p className={styles.subtitle}>
          Ta classe, ton année et les données gardées sur cet appareil.
        </p>
      </header>

      {settings === undefined ? (
        error ? (
          <p className={styles.errorCard} role="alert">
            {LOAD_ERROR}
          </p>
        ) : (
          <p className={styles.loading} role="status">
            Chargement des réglages…
          </p>
        )
      ) : (
        <>
          <SettingsForm
            key={JSON.stringify([
              settings.schoolName,
              settings.className,
              settings.teacherName,
            ])}
            settings={settings}
          />

          <SchoolYearSection currentYearId={settings.currentSchoolYearId} />

          {effectiveYearId !== undefined &&
          effectiveYearId !== settings.currentSchoolYearId ? (
            <p className={styles.warning}>
              Les nouvelles réussites sont enregistrées dans l’année{' '}
              {effectiveYearId} tant que l’année des réglages (
              {settings.currentSchoolYearId}) n’est pas alignée sur cette date.
            </p>
          ) : null}

          {readError ? (
            <p className={styles.errorCard} role="alert">
              {READ_ERROR}
            </p>
          ) : schoolYears === undefined ? (
            <p className={styles.loading} role="status">
              Chargement des dates de bilan…
            </p>
          ) : currentYear === undefined ? (
            <p className={styles.warning}>
              Les dates de l’année en cours sont introuvables. Vérifie l’année
              scolaire ci-dessus.
            </p>
          ) : (
            <BilanDatesSection
              year={currentYear}
              validations={validations ?? []}
            />
          )}
        </>
      )}

      <StoragePanel />

      <BackupPanel />

      <InstallSection />

      <section className={styles.card} aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className={styles.sectionTitle}>
          Confidentialité
        </h2>
        <p className={styles.hint}>
          Aucun compte, aucun envoi sur Internet. Les réussites et les photos
          restent dans ce navigateur, sur cet appareil.
        </p>
        <Button variant="ghost" fullWidth onClick={() => setPrivacyOpen(true)}>
          Relire la notice
        </Button>
      </section>

      <p className={styles.version}>Version {__APP_VERSION__}</p>

      <Sheet
        open={privacyOpen}
        title="Tes données restent sur ton appareil"
        onClose={() => setPrivacyOpen(false)}
      >
        <div className={styles.privacyBody}>
          <p>L’application ne crée aucun compte et n’envoie rien sur Internet.</p>
          <p>
            Les photos et les réussites sont enregistrées uniquement dans ce
            navigateur, sur cet appareil.
          </p>
          <p>
            Aucune copie n’existe ailleurs : pense à faire une sauvegarde ZIP
            régulière et à la conserver dans un endroit protégé.
          </p>
          <p>
            La sauvegarde ZIP n’est pas chiffrée : elle contient les données
            personnelles et les photos des enfants. Conserve-la dans un endroit
            protégé et supprime-la après le transfert.
          </p>
          <p>
            Supprimer un élève efface définitivement son dossier, ses réussites et
            ses photos.
          </p>
        </div>
        <div className={styles.privacyActions}>
          <Button variant="dark" fullWidth onClick={acknowledgePrivacy}>
            J’ai compris
          </Button>
        </div>
      </Sheet>
    </section>
  )
}
