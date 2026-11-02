import { useEffect, useRef, useState } from 'react'
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
/** Clé du bouton de fermeture dans la carte des éléments focalisables. */
const TERMINER_KEY = 'terminer'

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
 * élève et objectif) et validation rapide sans photo, élève après élève.
 *
 * La fiche reste ouverte après chaque validation : la liste des élèves se met
 * à jour en direct et l'enseignant enchaîne sur les suivants avant de fermer.
 */
export function ObjectiveSheet({
  objective,
  students,
  allValidations,
  onClose,
  onValidated,
}: ObjectiveSheetProps) {
  const { showToast } = useToast()
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all')
  const [busyStudentId, setBusyStudentId] = useState<string>()
  const [focusTick, setFocusTick] = useState(0)

  // Le bouton d'un élève validé se désactive : sans reprise de focus, le clavier
  // et les lecteurs d'écran perdraient leur position dans la fiche. La cible est
  // mémorisée dans une référence et appliquée après le rendu qui réactive les
  // lignes (`busy` retombé), d'où le compteur qui déclenche l'effet.
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const focusRequest = useRef<string | null>(null)

  useEffect(() => {
    const target = focusRequest.current
    if (target === null) return
    focusRequest.current = null
    rowRefs.current.get(target)?.focus()
  }, [focusTick])

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

  /** Élève suivant encore à valider, en repartant du début de la liste. */
  function nextStudentAfter(student: Student): string | undefined {
    const index = pickerStudents.findIndex((candidate) => candidate.id === student.id)
    if (index === -1) return undefined

    const ordered = [
      ...pickerStudents.slice(index + 1),
      ...pickerStudents.slice(0, index),
    ]

    return ordered.find(
      (candidate) =>
        candidate.id !== student.id && !validatedStudentIds.has(candidate.id),
    )?.id
  }

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
      focusRequest.current = nextStudentAfter(student) ?? TERMINER_KEY
      setFocusTick((tick) => tick + 1)
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

      <section className={styles.picker} aria-label="Choisir un ou plusieurs élèves">
        <p className={styles.pickerTitle}>Valider des élèves</p>

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
                    ref={(node) => {
                      if (node === null) rowRefs.current.delete(student.id)
                      else rowRefs.current.set(student.id, node)
                    }}
                    disabled={alreadyValidated || busy}
                    aria-busy={busyStudentId === student.id || undefined}
                    onClick={() => {
                      void handleSelect(student)
                    }}
                  >
                    <span className={uiStyles.srOnly}>
                      {`${studentFullName(student)}, section ${student.section}${
                        alreadyValidated ? ', déjà validé' : ''
                      }`}
                    </span>
                    {/* Le contenu visible est décoratif : le nom accessible est
                        porté une seule fois par la ligne ci-dessus. */}
                    <span className={styles.pickerAvatar} aria-hidden="true">
                      <Avatar
                        name={student.firstName}
                        section={student.section}
                        size="sm"
                      />
                    </span>
                    <span className={styles.pickerName} aria-hidden="true">
                      {student.firstName}
                    </span>
                    <span className={styles.pickerStatus} aria-hidden="true">
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

      <SheetActions>
        <Button
          ref={(node) => {
            if (node === null) rowRefs.current.delete(TERMINER_KEY)
            else rowRefs.current.set(TERMINER_KEY, node)
          }}
          variant="ghost"
          fullWidth
          onClick={onClose}
        >
          Terminer
        </Button>
      </SheetActions>
    </Sheet>
  )
}
