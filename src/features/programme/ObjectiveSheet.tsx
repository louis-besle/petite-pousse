import { useState } from 'react'
import { createValidation } from '@/db/validations'
import { AlreadyValidatedError } from '@/domain/errors'
import { AGE_BAND_LABELS } from '@/features/dossier/labels'
import {
  REFERENTIAL_VERSION,
  ageBandForSection,
  domainById,
  referential,
  sectionForAgeBand,
} from '@/domain/referential'
import type { Objective, Student, Validation } from '@/domain/types'
import { todayIso } from '@/lib/date'
import { studentCountLabel, studentFullName, studentInitials } from '@/lib/text'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { ExampleBlock } from '@/ui/ExampleBlock'
import { Icon } from '@/ui/icons'
import { SectionFilterChips, type SectionFilter } from '@/ui/SectionFilterChips'
import { Sheet } from '@/ui/Sheet'
import { SheetActions } from '@/ui/SheetActions'
import uiStyles from '@/ui/ui.module.css'
import { useToast } from '@/ui/useToast'
import styles from './programme.module.css'

const ALREADY_VALIDATED_MESSAGE = 'Cet objectif est déjà validé pour cet élève.'
const STORAGE_ERROR_MESSAGE = 'La réussite n’a pas pu être enregistrée. Réessaie.'

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
    .map((band) => sectionForAgeBand(band))
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
            <ExampleBlock key={band} label={AGE_BAND_LABELS[band]}>
              {example}
            </ExampleBlock>
          )
        })}
      </div>

      <div className={styles.validatedBlock}>
        <p className={styles.validatedTitle}>
          {validatedStudents.length === 0
            ? 'Aucun élève n’a encore validé cet objectif.'
            : `Déjà validé par ${studentCountLabel(validatedStudents.length)}`}
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
                  {studentInitials(student)}
                </span>
                <span className={uiStyles.srOnly}>{studentFullName(student)}</span>
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

          <SectionFilterChips
            value={sectionFilter}
            onChange={setSectionFilter}
            ariaLabel="Filtrer les élèves par section"
            className={styles.pickerFilters}
          />

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
                      aria-label={`${studentFullName(student)}, section ${
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

      <SheetActions>
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
      </SheetActions>
    </Sheet>
  )
}
