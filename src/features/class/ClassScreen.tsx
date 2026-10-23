import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useAllValidations, useValidationsForYear } from '@/db/validations'
import { resolveCurrentSchoolYearId } from '@/domain/schoolYear'
import type { Section } from '@/domain/types'
import { shouldRemindBackup } from '@/features/settings/backup'
import { formatLongDate, todayIso } from '@/lib/date'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { FlowerMark } from '@/ui/FlowerMark'
import { Icon } from '@/ui/icons'
import styles from './ClassScreen.module.css'

type SectionFilter = 'all' | Section

const FILTERS: { value: SectionFilter; label: string }[] = [
  { value: 'all', label: 'Toute la classe' },
  { value: 'PS', label: 'PS' },
  { value: 'MS', label: 'MS' },
  { value: 'GS', label: 'GS' },
]

/** « 1 réussite », « 2 réussites ». */
function successLabel(count: number): string {
  return `${count} réussite${count > 1 ? 's' : ''}`
}

/**
 * Écran d'accueil : la classe entière, filtrable par section, avec le nombre
 * de réussites de l'année en cours pour chaque élève.
 *
 * Les compteurs sont dérivés de l'année qui contient la date du jour, en
 * priorité celle des réglages. Une réussite créée aujourd'hui est classée
 * d'après sa date : sans cet alignement, un passage d'année oublié ou anticipé
 * la rendrait invisible dans la classe.
 */
export function ClassScreen() {
  const students = useStudents()
  const settings = useSettings()
  const schoolYears = useSchoolYears()
  const currentYearId = resolveCurrentSchoolYearId(
    schoolYears ?? [],
    settings?.currentSchoolYearId,
    todayIso(),
  )
  const validations = useValidationsForYear(currentYearId ?? '')
  const allValidations = useAllValidations()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SectionFilter>('all')

  const teacherName = settings?.teacherName.trim() ?? ''
  const greeting = teacherName === '' ? 'Bonjour, Maîtresse' : `Bonjour, ${teacherName}`
  const teacherInitial = teacherName.charAt(0).toUpperCase() || 'M'
  const studentCount = students?.length ?? 0

  const counts = new Map<string, number>()
  for (const validation of validations ?? []) {
    counts.set(validation.studentId, (counts.get(validation.studentId) ?? 0) + 1)
  }

  const visibleStudents =
    students === undefined
      ? []
      : filter === 'all'
        ? students
        : students.filter((student) => student.section === filter)

  const hasStudents = studentCount > 0
  // Aucun rappel tant que les réglages ou les réussites ne sont pas chargés.
  const showBackupReminder =
    settings !== undefined &&
    allValidations !== undefined &&
    shouldRemindBackup(settings, allValidations.length)

  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brandline}>
          <FlowerMark size={19} />
          <span className={styles.brandWord}>Carnet de réussites</span>
          <Link to="/settings" className={styles.teacherLink}>
            <span>{teacherInitial}</span>
            <span className={styles.srOnly}>Ouvrir les réglages</span>
          </Link>
        </div>

        <h1 className={styles.greeting}>{greeting}</h1>

        <p className={styles.subtitle}>
          {formatLongDate(todayIso())} · {studentCount} {studentCount > 1 ? 'élèves' : 'élève'}
          {settings ? (
            <>
              {' · '}
              <span className={styles.year}>
                {currentYearId ?? settings.currentSchoolYearId}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {showBackupReminder ? (
        <Link to="/settings" className={styles.backupReminder}>
          <Icon name="download" size={16} />
          <span>
            <strong>Sauvegarde conseillée.</strong> Pense à exporter tes données
            depuis les réglages.
          </span>
        </Link>
      ) : null}

      {students === undefined ? (
        <p className={styles.loading} role="status">
          Chargement de la classe…
        </p>
      ) : students.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucun élève dans la classe</p>
          <p className={styles.emptyText}>
            Ajoute les enfants de ta classe pour commencer à noter leurs réussites.
          </p>
          <Link to="/students" className={styles.emptyLink}>
            Ajouter un élève
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.filters} role="group" aria-label="Filtrer par section">
            {FILTERS.map((item) => (
              <Chip
                key={item.value}
                active={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>

          {visibleStudents.length === 0 ? (
            <p className={styles.filterEmpty} role="status">
              Aucun élève en {filter}.
            </p>
          ) : (
            <ul className={styles.grid}>
              {visibleStudents.map((student) => {
                const count = counts.get(student.id) ?? 0
                const countLabel = successLabel(count)

                return (
                  <li key={student.id}>
                    <Link to={`/students/${student.id}`} className={styles.card}>
                      <span className={styles.srOnly}>
                        {`${student.firstName}, section ${student.section}, ${countLabel}`}
                      </span>
                      <span className={styles.cardTop} aria-hidden="true">
                        <Avatar name={student.firstName} section={student.section} />
                      </span>
                      <span className={styles.cardName} aria-hidden="true">
                        {student.firstName}
                      </span>
                      <span className={styles.count} aria-hidden="true">
                        <span className={styles.dot} aria-hidden="true" />
                        {countLabel}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <Link to="/students" className={styles.manageLink}>
            <Icon name="pencil" size={14} />
            Gérer les élèves
          </Link>
          <Link to="/settings" className={styles.settingsLink}>
            Réglages
          </Link>
        </>
      )}

      <Button
        variant="primary"
        className={styles.cta}
        disabled={!hasStudents}
        onClick={() => navigate('/capture')}
      >
        <Icon name="camera" size={20} />
        Prendre une photo
      </Button>
    </section>
  )
}
