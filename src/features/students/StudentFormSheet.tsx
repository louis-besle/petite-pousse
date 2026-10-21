import { useId, useState, type FormEvent } from 'react'
import { createStudent, updateStudent } from '@/db/students'
import type { Section, Student } from '@/domain/types'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/icons'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/useToast'
import styles from './students.module.css'

const SECTIONS: Section[] = ['PS', 'MS', 'GS']

const ADDED_MESSAGE = 'Élève ajouté.'
const UPDATED_MESSAGE = 'Modifications enregistrées.'
const ADD_ERROR = 'L’élève n’a pas pu être ajouté. Réessaie.'
const UPDATE_ERROR = 'Les modifications n’ont pas pu être enregistrées. Réessaie.'

export interface StudentFormSheetProps {
  open: boolean
  /** `null` pour un ajout, l'élève à corriger pour une édition. */
  student: Student | null
  onClose: () => void
}

/**
 * Feuille d'ajout et d'édition d'un élève. Elle est montée à chaque ouverture,
 * ce qui remet le formulaire à zéro sans effet de réinitialisation.
 *
 * L'initiale est toujours transmise, même vide : `updateStudent` supprime la
 * clé `lastNameInitial` dans ce cas (une valeur `undefined` la laisserait
 * intacte).
 */
export function StudentFormSheet({ open, student, onClose }: StudentFormSheetProps) {
  const { showToast } = useToast()
  const firstNameId = useId()
  const initialId = useId()

  const [firstName, setFirstName] = useState(student?.firstName ?? '')
  const [initialInput, setInitialInput] = useState(student?.lastNameInitial ?? '')
  const [section, setSection] = useState<Section>(student?.section ?? 'MS')
  const [saving, setSaving] = useState(false)

  const isEdit = student !== null
  const canSubmit = firstName.trim() !== '' && !saving
  const title = isEdit ? `Modifier ${student.firstName}` : 'Ajouter un élève'

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    try {
      if (student === null) {
        await createStudent({ firstName, lastNameInitial: initialInput, section })
        showToast(ADDED_MESSAGE)
      } else {
        await updateStudent(student.id, {
          firstName,
          lastNameInitial: initialInput,
          section,
        })
        showToast(UPDATED_MESSAGE)
      }
      onClose()
    } catch (error) {
      console.error(isEdit ? 'Modification de l’élève impossible.' : 'Ajout de l’élève impossible.', error)
      showToast(isEdit ? UPDATE_ERROR : ADD_ERROR)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <p className={styles.formEyebrow}>{isEdit ? 'Modifier l’élève' : 'Nouvel élève'}</p>

        {isEdit ? null : (
          <p className={styles.formHint}>
            Son dossier sera vide. Tu pourras y ajouter ses premières réussites.
          </p>
        )}

        <div className={styles.formField}>
          <span className={styles.label} aria-hidden="true">
            Prénom
          </span>
          <Field
            id={firstNameId}
            label="Prénom"
            value={firstName}
            autoComplete="off"
            placeholder="Prénom de l’élève"
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>

        <div className={styles.formField}>
          <span className={styles.label} aria-hidden="true">
            Initiale du nom (facultative)
          </span>
          <div className={styles.initialField}>
            <Field
              id={initialId}
              label="Initiale du nom (facultative)"
              value={initialInput}
              maxLength={1}
              autoComplete="off"
              placeholder="B"
              onChange={(event) => setInitialInput(event.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div className={styles.formField}>
          <span className={styles.label} aria-hidden="true">
            Section
          </span>
          <div className={styles.sectionChips} role="group" aria-label="Section">
            {SECTIONS.map((candidate) => (
              <Chip
                key={candidate}
                active={section === candidate}
                onClick={() => setSection(candidate)}
              >
                {candidate}
              </Chip>
            ))}
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="submit" variant="dark" fullWidth disabled={!canSubmit}>
            <Icon name={isEdit ? 'check' : 'plus'} size={18} />
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter l’élève'}
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
