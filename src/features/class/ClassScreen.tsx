import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useValidationsForYear } from '@/db/validations'
import { resolveCurrentSchoolYearId } from '@/domain/schoolYear'
import { formatLongDate, todayIso } from '@/lib/date'
import { successLabel } from '@/lib/text'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { EmptyState, EmptyStateLink } from '@/ui/EmptyState'
import { FlowerMark } from '@/ui/FlowerMark'
import { Icon } from '@/ui/icons'
import { LoadingText } from '@/ui/LoadingText'
import { SectionFilterChips, type SectionFilter } from '@/ui/SectionFilterChips'
import uiStyles from '@/ui/ui.module.css'
import styles from './ClassScreen.module.css'

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

  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brandline}>
          <FlowerMark size={19} />
          <span className={styles.brandWord}>Petite pousse</span>
          <Link
            to="/settings"
            className={styles.teacherLink}
            aria-label="Ouvrir le profil"
          >
            <span aria-hidden="true">{teacherInitial}</span>
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

      {students === undefined ? (
        <LoadingText>Chargement de la classe…</LoadingText>
      ) : students.length === 0 ? (
        <EmptyState
          title="Aucun élève dans la classe"
          text="Ajoute les enfants de ta classe pour commencer à noter leurs réussites."
        >
          <EmptyStateLink to="/students">Ajouter un élève</EmptyStateLink>
        </EmptyState>
      ) : (
        <>
          <SectionFilterChips
            value={filter}
            onChange={setFilter}
            ariaLabel="Filtrer par section"
            allLabel="Toute la classe"
            className={styles.filters}
          />

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
                      <span className={uiStyles.srOnly}>
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
