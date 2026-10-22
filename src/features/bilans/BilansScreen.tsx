import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useValidationsForYear } from '@/db/validations'
import { countValidationsInPeriod } from '@/domain/bilan'
import { periodForDate, periodRange } from '@/domain/schoolYear'
import type { SchoolYear } from '@/domain/types'
import { formatShortDate, todayIso } from '@/lib/date'
import { Avatar } from '@/ui/Avatar'
import { Icon } from '@/ui/icons'
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

  const [yearChoice, setYearChoice] = useState<string>()
  const [periodChoice, setPeriodChoice] = useState<1 | 2>()
  const [editingCutover, setEditingCutover] = useState(false)

  const currentYearId = settings?.currentSchoolYearId
  const years = schoolYears ?? []
  const yearIds = years.map((year) => year.id)
  // Une année courante absente de la liste reste sélectionnable : le select ne
  // doit jamais basculer silencieusement sur une autre valeur.
  if (currentYearId !== undefined && !yearIds.includes(currentYearId)) {
    yearIds.push(currentYearId)
  }
  yearIds.sort((a, b) => b.localeCompare(a))

  const requestedYear = yearChoice ?? currentYearId ?? yearIds[0]
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
    year === undefined ||
    validations === undefined
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

  const today = todayIso()
  const periods = ([1, 2] as const).map((period) => {
    const range = periodRange(year, period)
    return {
      period,
      start: range.start,
      end: range.end,
      count: countValidationsInPeriod(validations, year, period),
      status: statusFor(year, range.start, range.end, today, currentYearId),
    }
  })

  const defaultPeriod = periodForDate(today, year) ?? 1
  const selectedPeriod = periodChoice ?? defaultPeriod
  const selectedRange = periodRange(year, selectedPeriod)

  // Compteurs de la période sélectionnée, regroupés en une seule passe.
  const counts = new Map<string, number>()
  for (const validation of validations) {
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
          onChange={(event) => handleYearChange(event.target.value)}
        >
          {yearIds.map((yearId) => (
            <option key={yearId} value={yearId}>
              {yearId}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.periods} role="group" aria-label="Périodes des bilans">
        {periods.map((item) => {
          const selected = item.period === selectedPeriod

          return (
            <button
              key={item.period}
              type="button"
              className={styles.periodCard}
              aria-pressed={selected}
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
          <p className={styles.eyebrow}>{studentCountLabel(students.length)}</p>

          <ul className={styles.list}>
            {students.map((student) => {
              const count = counts.get(student.id) ?? 0

              return (
                <li key={student.id}>
                  <Link
                    to={`/bilans/${student.id}?period=${selectedPeriod}&year=${encodeURIComponent(year.id)}`}
                    className={styles.studentRow}
                    aria-label={`${student.firstName}, section ${student.section}, ${successLabel(
                      count,
                    )} pour le bilan ${selectedPeriod}`}
                  >
                    <Avatar
                      name={student.firstName}
                      section={student.section}
                      size="sm"
                    />
                    <span className={styles.studentName}>{student.firstName}</span>
                    <span className={styles.studentMeta}>
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
    </section>
  )
}
