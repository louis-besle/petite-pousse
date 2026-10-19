import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '@/db/db'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useValidationsForYear } from '@/db/validations'
import { countValidationsInPeriod } from '@/domain/bilan'
import { referential } from '@/domain/referential'
import {
  periodForDate,
  periodRange,
  resolveCurrentSchoolYearId,
} from '@/domain/schoolYear'
import type { Photo, SchoolYear } from '@/domain/types'
import { formatShortDate, todayIso } from '@/lib/date'
import { downloadBlob } from '@/lib/share'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/icons'
import { useToast } from '@/ui/useToast'
import type { BatchProgress } from './batch'
import styles from './bilans.module.css'
import { PeriodEditor } from './PeriodEditor'

type PeriodTone = 'current' | 'upcoming' | 'done' | 'past'

interface PeriodStatus {
  label: string
  tone: PeriodTone
}

/** « 1 réussite », « 2 réussites ». */
function successLabel(count: number): string {
  return `${count} réussite${count > 1 ? 's' : ''}`
}

/** « 1 élève », « 2 élèves ». */
function studentCountLabel(count: number): string {
  return `${count} élève${count > 1 ? 's' : ''}`
}

/**
 * « 1 sept. 2026 → 31 janv. 2027 ». L'année est répétée quand les bornes
 * changent d'année civile, ce qui est le cas des deux bilans.
 */
function formatRange(start: string, end: string): string {
  return `${formatShortDate(start)} ${start.slice(0, 4)} → ${formatShortDate(end)} ${end.slice(0, 4)}`
}

/**
 * Statut d'une période. Une année antérieure à l'année courante est « Passé »
 * pour ses deux bilans, même si ses dates sont dépassées depuis longtemps.
 */
function statusFor(
  year: SchoolYear,
  start: string,
  end: string,
  today: string,
  currentYearId: string | undefined,
): PeriodStatus {
  if (currentYearId !== undefined && year.id < currentYearId) {
    return { label: 'Passé', tone: 'past' }
  }
  if (today < start) return { label: 'À venir', tone: 'upcoming' }
  if (today > end) return { label: 'Terminé', tone: 'done' }
  return { label: 'En cours', tone: 'current' }
}

const BATCH_ERROR_MESSAGE = 'Les bilans n’ont pas pu être générés. Réessaie.'

/** « 1 bilan téléchargé. », « 2 bilans téléchargés. » */
function downloadedLabel(count: number): string {
  if (count === 1) return '1 bilan téléchargé.'
  return `${count} bilans téléchargés.`
}

/** « Générer les 2 bilans (ZIP) », au singulier pour un seul élève. */
function batchActionLabel(count: number): string {
  return count === 1
    ? 'Générer le bilan (ZIP)'
    : `Générer les ${count} bilans (ZIP)`
}

/**
 * Charge en une passe les photos des réussites de l'année : le modèle de bilan
 * les retrouve par identifiant, sans requête par élève.
 */
async function loadPhotos(
  validations: readonly { photoId?: string }[],
): Promise<Map<string, Photo>> {
  const photoIds: string[] = []
  for (const validation of validations) {
    if (validation.photoId !== undefined) photoIds.push(validation.photoId)
  }

  const photos = new Map<string, Photo>()
  if (photoIds.length === 0) return photos

  for (const photo of await db.photos.bulkGet(photoIds)) {
    if (photo !== undefined) photos.set(photo.id, photo)
  }
  return photos
}

function BilansHeader() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Bilans</h1>
      <p className={styles.subtitle}>Deux fois par an, une feuille A4 par élève</p>
    </header>
  )
}

/**
 * Vue d'ensemble des bilans : sélecteur d'année, deux périodes sélectionnables
 * et la liste de tous les élèves avec leur nombre de réussites pour la période.
 *
 * Les compteurs viennent d'une seule requête (`useValidationsForYear`) : aucune
 * requête par élève. La date de changement est réglable ici, pour l'année
 * sélectionnée uniquement.
 */
export function BilansScreen() {
  const settings = useSettings()
  const schoolYears = useSchoolYears()
  const students = useStudents()
  const { showToast } = useToast()

  const [yearChoice, setYearChoice] = useState<string>()
  const [periodChoice, setPeriodChoice] = useState<1 | 2>()
  const [editingCutover, setEditingCutover] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)

  const years = schoolYears ?? []
  // L'année par défaut et le statut « Passé » suivent l'année qui contient la
  // date du jour : une réussite datée d'aujourd'hui est classée par sa date.
  const currentYearId = resolveCurrentSchoolYearId(
    years,
    settings?.currentSchoolYearId,
    todayIso(),
  )
  const yearIds = years.map((year) => year.id)
  yearIds.sort((a, b) => b.localeCompare(a))

  // Si l'année des réglages n'existe plus dans la base, on retombe sur l'année
  // connue la plus récente au lieu de rester bloqué sur le chargement.
  const requestedYear = yearChoice ?? currentYearId
  const selectedYearId =
    requestedYear !== undefined && yearIds.includes(requestedYear)
      ? requestedYear
      : yearIds[0]
  const year = years.find((candidate) => candidate.id === selectedYearId)

  const validations = useValidationsForYear(selectedYearId ?? '')

  if (
    settings === undefined ||
    schoolYears === undefined ||
    students === undefined ||
    year === undefined
  ) {
    return (
      <section className={styles.screen}>
        <BilansHeader />
        <p className={styles.loading} role="status">
          Chargement des bilans…
        </p>
      </section>
    )
  }

  // Copies rétrécies pour la closure de génération : TypeScript ne conserve
  // pas les gardes du rendu au fond d'une fonction asynchrone.
  const batchStudents = students
  const batchYear = year
  const batchSettings = settings

  const today = todayIso()
  const periods = ([1, 2] as const).map((period) => {
    const range = periodRange(year, period)
    return {
      period,
      start: range.start,
      end: range.end,
      count:
        validations === undefined
          ? 0
          : countValidationsInPeriod(validations, year, period),
      status: statusFor(year, range.start, range.end, today, currentYearId),
    }
  })

  const defaultPeriod = periodForDate(today, year) ?? 1
  const selectedPeriod = periodChoice ?? defaultPeriod
  const selectedRange = periodRange(year, selectedPeriod)

  // Compteurs de la période sélectionnée, regroupés en une seule passe.
  const counts = new Map<string, number>()
  for (const validation of validations ?? []) {
    if (validation.date < selectedRange.start || validation.date > selectedRange.end) {
      continue
    }
    counts.set(validation.studentId, (counts.get(validation.studentId) ?? 0) + 1)
  }

  function handleYearChange(nextYearId: string): void {
    setYearChoice(nextYearId)
    // La période par défaut appartient à l'année : on la recalcule.
    setPeriodChoice(undefined)
  }

  /**
   * Génère le ZIP de tous les bilans de la période sélectionnée. `./batch` est
   * importé au clic : pdf-lib et fontkit ne pèsent pas sur l'affichage initial.
   */
  async function handleGenerateBundle(): Promise<void> {
    if (batchBusy || batchStudents.length === 0) return

    setBatchBusy(true)
    setBatchProgress(null)
    try {
      const { generateBilanBundle } = await import('./batch')
      const photos = await loadPhotos(validations ?? [])
      const bundle = await generateBilanBundle(
        {
          students: batchStudents,
          year: batchYear,
          period: selectedPeriod,
          validations: validations ?? [],
          photos,
          meta: {
            schoolName: batchSettings.schoolName ?? '',
            className: batchSettings.className ?? '',
            teacherName: batchSettings.teacherName ?? '',
          },
          referential,
        },
        (progress) => setBatchProgress(progress),
      )

      downloadBlob(bundle.blob, bundle.filename)
      showToast(downloadedLabel(bundle.count))
    } catch (error) {
      console.error('Génération des bilans impossible.', error)
      showToast(BATCH_ERROR_MESSAGE)
    } finally {
      setBatchBusy(false)
      setBatchProgress(null)
    }
  }

  return (
    <section className={styles.screen}>
      <BilansHeader />

      <div className={styles.yearRow}>
        <label htmlFor="bilans-year" className={styles.yearLabel}>
          Année scolaire
        </label>
        <select
          id="bilans-year"
          className={styles.yearSelect}
          value={year.id}
          disabled={batchBusy}
          onChange={(event) => handleYearChange(event.target.value)}
        >
          {yearIds.map((yearId) => (
            <option key={yearId} value={yearId}>
              {yearId}
            </option>
          ))}
        </select>
      </div>

      {validations === undefined ? (
        <p className={styles.loading} role="status">
          Chargement des bilans…
        </p>
      ) : (
        <>
          <div
            className={styles.periods}
            role="group"
            aria-label="Périodes des bilans"
          >
            {periods.map((item) => {
              const selected = item.period === selectedPeriod

              return (
                <button
                  key={item.period}
                  type="button"
                  className={styles.periodCard}
                  aria-pressed={selected}
                  disabled={batchBusy}
                  onClick={() => setPeriodChoice(item.period)}
                >
                  <span className={styles.periodMarker} aria-hidden="true">
                    {selected ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className={styles.periodText}>
                    <span className={styles.periodTitle}>Bilan {item.period}</span>
                    <span className={styles.periodRange}>
                      {formatRange(item.start, item.end)}
                    </span>
                    <span className={styles.periodCount}>
                      {successLabel(item.count)}
                    </span>
                  </span>
                  <span className={styles.statusPill} data-tone={item.status.tone}>
                    {item.status.label}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className={styles.cutoverButton}
            disabled={batchBusy}
            onClick={() => setEditingCutover(true)}
          >
            <Icon name="pencil" size={14} />
            Modifier la date de changement
          </button>

          {students.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Aucun élève dans la classe</p>
              <p className={styles.emptyText}>
                Ajoute les enfants de ta classe pour préparer leurs bilans.
              </p>
              <Link to="/students" className={styles.emptyLink}>
                Ajouter un élève
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.batch}>
                <Button
                  variant="dark"
                  fullWidth
                  disabled={batchBusy}
                  aria-busy={batchBusy || undefined}
                  onClick={() => {
                    void handleGenerateBundle()
                  }}
                >
                  <Icon name="download" size={18} />
                  {batchBusy
                    ? 'Préparation des bilans…'
                    : batchActionLabel(students.length)}
                </Button>
                <p className={styles.batchHint}>
                  Tous les élèves de la classe sont inclus, même ceux sans
                  réussite sur cette période.
                </p>

                {batchProgress === null ? null : (
                  <>
                    <progress
                      className={styles.batchProgress}
                      max={batchProgress.total}
                      value={batchProgress.done}
                      aria-label="Progression de la génération des bilans"
                    />
                    <p className={styles.batchStatus} role="status">
                      {`Bilan ${batchProgress.done} sur ${batchProgress.total} · ${batchProgress.student.firstName}`}
                    </p>
                  </>
                )}
              </div>

              <p className={styles.eyebrow}>
                {studentCountLabel(students.length)}
              </p>

              <ul className={styles.list}>
                {students.map((student) => {
                  const count = counts.get(student.id) ?? 0

                  return (
                    <li key={student.id}>
                      <Link
                        to={`/bilans/${student.id}?period=${selectedPeriod}&year=${encodeURIComponent(year.id)}`}
                        className={styles.studentRow}
                      >
                        <span className={styles.srOnly}>
                          {`${student.firstName}, section ${student.section}, ${successLabel(
                            count,
                          )} pour le bilan ${selectedPeriod}`}
                        </span>
                        <span className={styles.rowAvatar} aria-hidden="true">
                          <Avatar
                            name={student.firstName}
                            section={student.section}
                            size="sm"
                          />
                        </span>
                        <span className={styles.studentName} aria-hidden="true">
                          {student.firstName}
                        </span>
                        <span className={styles.studentMeta} aria-hidden="true">
                          {student.section} · {successLabel(count)}
                        </span>
                        <span className={styles.rowChevron} aria-hidden="true">
                          <Icon name="chevron" size={15} />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {editingCutover ? (
            <PeriodEditor
              year={year}
              validations={validations}
              onClose={() => setEditingCutover(false)}
            />
          ) : null}
        </>
      )}
    </section>
  )
}
