import { useState } from 'react'
import { createValidation } from '@/db/validations'
import { AlreadyValidatedError } from '@/domain/errors'
import { AGE_BAND_LABELS } from '@/features/dossier/labels'
import { REFERENTIAL_VERSION, ageBandForSection, domainById, referential } from '@/domain/referential'
import type { AgeBand, Objective, Section, Student, Validation } from '@/domain/types'
import { todayIso } from '@/lib/date'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Icon } from '@/ui/icons'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/useToast'
import styles from './programme.module.css'

type SectionFilter = 'all' | Section

const SECTION_FILTERS: { value: SectionFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'PS', label: 'PS' },
  { value: 'MS', label: 'MS' },
  { value: 'GS', label: 'GS' },
]

const SECTION_BY_AGE_BAND: Record<AgeBand, Section> = {
  before4: 'PS',
  from4: 'MS',
  from5: 'GS',
}

const ALREADY_VALIDATED_MESSAGE = 'Cet objectif est déjà validé pour cet élève.'
const STORAGE_ERROR_MESSAGE = 'La réussite n’a pas pu être enregistrée. Réessaie.'

/** Initiale du prénom + initiale du nom quand elle existe : « LM ». */
function pupilInitials(student: Student): string {
  const firstInitial = student.firstName.trim().charAt(0).toUpperCase()
  const lastInitial = student.lastNameInitial?.trim().charAt(0).toUpperCase() ?? ''

  return `${firstInitial}${lastInitial}`
}

/** Nom accessible complet : « Léa M. » quand l'initiale du nom est connue. */
function pupilFullName(student: Student): string {
  return student.lastNameInitial === undefined
    ? student.firstName
    : `${student.firstName} ${student.lastNameInitial}.`
}

export interface ObjectiveSheetProps {
  objective: Objective
  students: Student[]
  /** Toutes les validations : la liste « déjà validé » est globale aux années. */
  allValidations: Validation[]
  onClose: () => void
  onValidated: (student: Student) => void
}

/**
 * Fiche d'un objectif du programme : exemples par tranche d'âge, élèves qui
 * l'ont déjà validé (toutes années confondues, l'index Dexie étant unique par
 * élève et objectif) et validation rapide sans photo.
 */
export function ObjectiveSheet({
  objective,
  students,
  allValidations,
  onClose,
  onValidated,
}: ObjectiveSheetProps) {
  const { showToast } = useToast()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all')
  const [busyStudentId, setBusyStudentId] = useState<string>()

  const domain = domainById(referential, objective.domainId)
  const levels = objective.ageBands
    .map((band) => SECTION_BY_AGE_BAND[band])
    .join(' · ')

  const validatedStudentIds = new Set(
    allValidations
      .filter((validation) => validation.objectiveId === objective.id)
      .map((validation) => validation.studentId),
  )
  const validatedStudents = students.filter((student) =>
    validatedStudentIds.has(student.id),
  )
  const pickerStudents =
    sectionFilter === 'all'
      ? students
      : students.filter((student) => student.section === sectionFilter)

  const busy = busyStudentId !== undefined

  async function handleSelect(student: Student): Promise<void> {
    if (busy) return

    setBusyStudentId(student.id)
    const studentBand = ageBandForSection(student.section)
    const ageBand = objective.ageBands.includes(studentBand)
      ? studentBand
      : objective.ageBands[0]

    try {
      await createValidation({
        studentId: student.id,
        objective,
        ageBand,
        date: todayIso(),
        referentialVersion: REFERENTIAL_VERSION,
      })
      onValidated(student)
    } catch (error) {
      if (error instanceof AlreadyValidatedError) {
        showToast(ALREADY_VALIDATED_MESSAGE)
      } else {
        console.error('Enregistrement de la réussite impossible.', error)
        showToast(STORAGE_ERROR_MESSAGE)
      }
    } finally {
      setBusyStudentId(undefined)
    }
  }

  return (
    <Sheet open title={objective.label} onClose={onClose}>
      <p className={styles.sheetMeta}>
        <span className={styles.sheetDomain}>{domain.longLabel}</span>
        <span className={styles.sheetLevels}>{levels}</span>
      </p>

      <div className={styles.examples}>
        {objective.ageBands.map((band) => {
          const example = objective.examples[band]
          if (example === undefined) return null

          return (
            <div key={band} className={styles.exampleBlock}>
              <p className={styles.exampleLabel}>{AGE_BAND_LABELS[band]}</p>
              <p className={styles.exampleText}>{example}</p>
            </div>
          )
        })}
      </div>

      <div className={styles.validatedBlock}>
        <p className={styles.validatedTitle}>
          {validatedStudents.length === 0
            ? 'Aucun élève n’a encore validé cet objectif.'
            : `Déjà validé par ${validatedStudents.length} élève${
                validatedStudents.length > 1 ? 's' : ''
              }`}
        </p>

        {validatedStudents.length === 0 ? null : (
          <ul
            className={styles.validatedList}
            aria-label="Élèves ayant validé cet objectif"
          >
            {validatedStudents.map((student) => (
              <li key={student.id} className={styles.validatedItem}>
                <span
                  className={styles.initial}
                  data-section={student.section}
                  aria-hidden="true"
                >
                  {pupilInitials(student)}
                </span>
                <span className={styles.srOnly}>{pupilFullName(student)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pickerOpen ? (
        <section
          id="programme-picker"
          className={styles.picker}
          aria-label="Choisir un élève"
        >
          <p className={styles.pickerTitle}>Choisir un élève</p>

          <div
            className={styles.pickerFilters}
            role="group"
            aria-label="Filtrer les élèves par section"
          >
            {SECTION_FILTERS.map((item) => (
              <Chip
                key={item.value}
                active={sectionFilter === item.value}
                onClick={() => setSectionFilter(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>

          {pickerStudents.length === 0 ? (
            <p className={styles.pickerEmpty}>Aucun élève dans cette section.</p>
          ) : (
            <ul className={styles.pickerList}>
              {pickerStudents.map((student) => {
                const alreadyValidated = validatedStudentIds.has(student.id)

                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      className={styles.pickerRow}
                      disabled={alreadyValidated || busy}
                      aria-label={`${pupilFullName(student)}, section ${
                        student.section
                      }${alreadyValidated ? ', déjà validé' : ''}`}
                      onClick={() => {
                        void handleSelect(student)
                      }}
                    >
                      <Avatar
                        name={student.firstName}
                        section={student.section}
                        size="sm"
                      />
                      <span className={styles.pickerName}>{student.firstName}</span>
                      <span className={styles.pickerStatus}>
                        {alreadyValidated ? 'déjà validé' : 'Valider'}
                      </span>
                      {alreadyValidated ? null : <Icon name="plus" size={16} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      <div className={styles.sheetActions}>
        <Button
          variant="dark"
          fullWidth
          disabled={busy}
          aria-expanded={pickerOpen}
          aria-controls={pickerOpen ? 'programme-picker' : undefined}
          onClick={() => setPickerOpen((previous) => !previous)}
        >
          <Icon name="plus" size={18} />
          Valider pour un élève
        </Button>
        <Button variant="ghost" fullWidth onClick={onClose}>
          Fermer
        </Button>
      </div>
    </Sheet>
  )
}
