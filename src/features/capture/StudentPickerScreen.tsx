import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCaptureDraft, saveCaptureDraft } from '@/db/drafts'
import { useStudents } from '@/db/students'
import type { CaptureDraft, Student } from '@/domain/types'
import { normalizeSearch } from '@/lib/text'
import { Avatar } from '@/ui/Avatar'
import { EmptyState, EmptyStateLink } from '@/ui/EmptyState'
import { Icon } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { LoadingText } from '@/ui/LoadingText'
import { SearchField } from '@/ui/SearchField'
import { SectionFilterChips, type SectionFilter } from '@/ui/SectionFilterChips'
import uiStyles from '@/ui/ui.module.css'
import { useToast } from '@/ui/useToast'
import styles from './capture.module.css'

/**
 * Étape 1 de la capture : choisir l'élève. La sélection écrit le brouillon
 * `current` avant de naviguer, pour que l'écran photo trouve toujours son
 * élève même après un rechargement.
 */
export function StudentPickerScreen() {
  const students = useStudents()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SectionFilter>('all')
  const [savingId, setSavingId] = useState<string>()

  const normalizedQuery = normalizeSearch(query)
  const visibleStudents =
    students === undefined
      ? []
      : students.filter((student) => {
          const matchesSection = filter === 'all' || student.section === filter
          const matchesQuery =
            normalizedQuery === '' ||
            normalizeSearch(student.firstName).includes(normalizedQuery)
          return matchesSection && matchesQuery
        })

  async function chooseStudent(student: Student): Promise<void> {
    if (savingId !== undefined) return

    setSavingId(student.id)
    try {
      const existing = await getCaptureDraft()
      const createdAt = new Date().toISOString()

      // Même élève : on garde la photo déjà prise. Élève différent : nouveau
      // brouillon, sans les champs photo de l'élève précédent.
      const draft: CaptureDraft =
        existing?.studentId === student.id
          ? { ...existing, createdAt }
          : { id: 'current', studentId: student.id, createdAt }

      await saveCaptureDraft(draft)
      navigate(`/capture/${student.id}/photo`)
    } catch {
      showToast("Le brouillon n’a pas pu être enregistré. Vérifie l’espace de stockage.")
    } finally {
      setSavingId(undefined)
    }
  }

  return (
    <section className={styles.screen}>
      <div className={styles.topBar}>
        <IconButton label="Retour" onClick={() => navigate('/')}>
          <Icon name="back" size={18} />
        </IconButton>
        <span className={styles.topTitle}>Nouvelle réussite</span>
        <span className={styles.stepPill}>1 / 3</span>
      </div>

      <div className={styles.intro}>
        <h1 className={styles.pickerTitle}>Pour qui ?</h1>
        <p className={styles.pickerSub}>Cherche l’élève, puis prends la photo.</p>
      </div>

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
          <SearchField
            label="Rechercher un élève"
            placeholder="Rechercher un élève…"
            value={query}
            onChange={setQuery}
          />

          <SectionFilterChips
            value={filter}
            onChange={setFilter}
            ariaLabel="Filtrer par section"
            allLabel="Toute"
            className={styles.filters}
          />

          {visibleStudents.length === 0 ? (
            <p className={styles.filterEmpty} role="status">
              Aucun élève trouvé.
            </p>
          ) : (
            <ul className={styles.grid}>
              {visibleStudents.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className={styles.studentCard}
                    aria-busy={savingId === student.id || undefined}
                    disabled={savingId !== undefined}
                    onClick={() => {
                      void chooseStudent(student)
                    }}
                  >
                    <span className={uiStyles.srOnly}>
                      {`${student.firstName}, section ${student.section}`}
                    </span>
                    <span className={styles.studentAvatar} aria-hidden="true">
                      <Avatar
                        name={student.firstName}
                        section={student.section}
                        size="sm"
                      />
                    </span>
                    <span className={styles.studentName} aria-hidden="true">
                      {student.firstName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
