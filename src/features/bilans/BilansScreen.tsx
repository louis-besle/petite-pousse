import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadPhotosForValidations } from '@/db/photos'
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
import type { SchoolYear } from '@/domain/types'
import { formatPeriodRange, todayIso } from '@/lib/date'
import { sortedSchoolYearIds } from '@/lib/schoolYearSelection'
import { downloadBlob } from '@/lib/share'
import { studentCountLabel, successLabel } from '@/lib/text'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { CardList } from '@/ui/CardList'
import { EmptyState, EmptyStateLink } from '@/ui/EmptyState'
import { Icon } from '@/ui/icons'
import { LoadingText } from '@/ui/LoadingText'
import { ScreenHeader } from '@/ui/ScreenHeader'
import uiStyles from '@/ui/ui.module.css'
import { useToast } from '@/ui/useToast'
import { YearSelect } from '@/ui/YearSelect'
import type { BatchProgress } from './batch'
import styles from './bilans.module.css'
import { PeriodEditor } from './PeriodEditor'
import { parsePeriodParam } from './period'

type PeriodTone = 'current' | 'upcoming' | 'done' | 'past'

interface PeriodStatus {
  label: string
  tone: PeriodTone
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
  const [searchParams, setSearchParams] = useSearchParams()

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
  const yearIds = sortedSchoolYearIds(years)

  // L'année et la période vivent dans l'URL : revenir depuis un bilan, par le
  // lien de retour ou par l'historique du navigateur, restaure la sélection.
  // Si l'année des réglages n'existe plus dans la base, on retombe sur l'année
  // connue la plus récente au lieu de rester bloqué sur le chargement.
  const requestedYear = searchParams.get('year') ?? currentYearId
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
        <ScreenHeader
          title="Bilans"
          subtitle="Deux fois par an, une feuille A4 par élève"
        />
        <LoadingText>Chargement des bilans…</LoadingText>
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
  const selectedPeriod = parsePeriodParam(searchParams.get('period')) ?? defaultPeriod
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
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('year', nextYearId)
    // La période par défaut appartient à l'année : on la laisse recalculer.
    nextParams.delete('period')
    setSearchParams(nextParams)
  }

  function handlePeriodChange(nextPeriod: 1 | 2): void {
    if (
      searchParams.get('period') === String(nextPeriod) &&
      searchParams.get('year') === batchYear.id
    ) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('period', String(nextPeriod))
    nextParams.set('year', batchYear.id)
    setSearchParams(nextParams)
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
      const photos = await loadPhotosForValidations(validations ?? [])
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
      <ScreenHeader
        title="Bilans"
        subtitle="Deux fois par an, une feuille A4 par élève"
      />

      <YearSelect
        id="bilans-year"
        yearIds={yearIds}
        value={year.id}
        disabled={batchBusy}
        onChange={handleYearChange}
      />

      {validations === undefined ? (
        <LoadingText>Chargement des bilans…</LoadingText>
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
                  onClick={() => handlePeriodChange(item.period)}
                >
                  <span className={styles.periodMarker} aria-hidden="true">
                    {selected ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className={styles.periodText}>
                    <span className={styles.periodTitle}>Bilan {item.period}</span>
                    <span className={styles.periodRange}>
                      {formatPeriodRange(item.start, item.end)}
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
            <EmptyState
              title="Aucun élève dans la classe"
              text="Ajoute les enfants de ta classe pour préparer leurs bilans."
            >
              <EmptyStateLink to="/students">Ajouter un élève</EmptyStateLink>
            </EmptyState>
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

              <CardList>
                {students.map((student) => {
                  const count = counts.get(student.id) ?? 0

                  return (
                    <li key={student.id}>
                      <Link
                        to={`/bilans/${student.id}?period=${selectedPeriod}&year=${encodeURIComponent(year.id)}`}
                        className={styles.studentRow}
                      >
                        <span className={uiStyles.srOnly}>
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
              </CardList>
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
