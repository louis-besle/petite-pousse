import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCaptureDraft, saveCaptureDraft } from '@/db/drafts'
import { useStudents } from '@/db/students'
import type { CaptureDraft, Section, Student } from '@/domain/types'
import { Avatar } from '@/ui/Avatar'
import { Chip } from '@/ui/Chip'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { useToast } from '@/ui/useToast'
import styles from './capture.module.css'

type SectionFilter = 'all' | Section

const FILTERS: { value: SectionFilter; label: string }[] = [
  { value: 'all', label: 'Toute' },
  { value: 'PS', label: 'PS' },
  { value: 'MS', label: 'MS' },
  { value: 'GS', label: 'GS' },
]

/** Recherche insensible à la casse et aux accents (« lea » trouve « Léa »). */
function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

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
          <Field
            type="search"
            label="Rechercher un élève"
            icon={<Icon name="search" size={17} />}
            placeholder="Rechercher un élève…"
            value={query}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
          />

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
              Aucun élève trouvé.
            </p>
          ) : (
            <ul className={styles.grid}>
              {visibleStudents.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className={styles.studentCard}
                    aria-label={`${student.firstName}, section ${student.section}`}
                    aria-busy={savingId === student.id || undefined}
                    disabled={savingId !== undefined}
                    onClick={() => {
                      void chooseStudent(student)
                    }}
                  >
                    <Avatar
                      name={student.firstName}
                      section={student.section}
                      size="sm"
                    />
                    <span className={styles.studentName}>{student.firstName}</span>
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
