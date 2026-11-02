import { useRef, useState } from 'react'
import {
  MAX_OBJECTIVE_EXAMPLE_LENGTH,
  MAX_OBJECTIVE_LABEL_LENGTH,
  createCustomObjective,
  updateCustomObjective,
} from '@/db/customObjectives'
import {
  AGE_BANDS,
  ageBandForSection,
  referential,
  sectionForAgeBand,
} from '@/domain/referential'
import type {
  AgeBand,
  CustomObjective,
  Domain,
  Section,
} from '@/domain/types'
import { SECTIONS } from '@/domain/types'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/icons'
import { Sheet } from '@/ui/Sheet'
import { SheetActions } from '@/ui/SheetActions'
import { useToast } from '@/ui/useToast'
import styles from './programme.module.css'

const ERROR_ID = 'custom-objective-error'

type ErrorField = 'label' | AgeBand

/** Champ fautif d’après le message métier, pour y placer le focus. */
function errorFieldFor(message: string): ErrorField {
  if (
    message.startsWith('L’intitulé') ||
    message.startsWith('Un objectif porte déjà cet intitulé')
  ) {
    return 'label'
  }

  const example = /^L’exemple en (PS|MS|GS)/.exec(message)
  return example === null ? 'label' : ageBandForSection(example[1] as Section)
}

export interface CustomObjectiveSheetProps {
  open: boolean
  objective: CustomObjective | null
  onClose: () => void
  onRequestDelete: (objective: CustomObjective) => void
}

/**
 * Formulaire d'ajout ou de modification d'un objectif personnalisé. L'intitulé
 * est libre, le domaine et les niveaux se choisissent par puces, et un exemple
 * est saisi pour chaque niveau coché.
 */
export function CustomObjectiveSheet({
  open,
  objective,
  onClose,
  onRequestDelete,
}: CustomObjectiveSheetProps) {
  const { showToast } = useToast()
  const [label, setLabel] = useState(objective?.label ?? '')
  const [domainId, setDomainId] = useState<Domain['id']>(
    objective?.domainId ?? 'langage',
  )
  const [ageBands, setAgeBands] = useState<AgeBand[]>(objective?.ageBands ?? [])
  const [examples, setExamples] = useState<Partial<Record<AgeBand, string>>>(
    objective?.examples ?? {},
  )
  const [error, setError] = useState<{ message: string; field: ErrorField }>()
  const [saving, setSaving] = useState(false)
  const labelRef = useRef<HTMLInputElement>(null)
  const exampleRefs = useRef<Partial<Record<AgeBand, HTMLInputElement | null>>>({})

  const title = objective === null ? 'Ajouter un objectif' : 'Modifier l’objectif'
  const domains = [...referential.domains].sort((a, b) => a.order - b.order)

  function toggleBand(band: AgeBand): void {
    setAgeBands((previous) =>
      previous.includes(band)
        ? previous.filter((candidate) => candidate !== band)
        : [...previous, band],
    )
  }

  async function handleSubmit(): Promise<void> {
    if (label.trim() === '' || ageBands.length === 0 || saving) return

    setSaving(true)
    setError(undefined)
    try {
      const input = { label, domainId, ageBands, examples }
      if (objective === null) {
        await createCustomObjective(input)
        showToast('Objectif ajouté.')
      } else {
        await updateCustomObjective(objective.id, input)
        showToast('Modifications enregistrées.')
      }
      onClose()
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Une erreur est survenue.'
      const field = errorFieldFor(message)
      setError({ message, field })

      if (field === 'label') {
        labelRef.current?.focus()
      } else {
        exampleRefs.current[field]?.focus()
      }
    } finally {
      setSaving(false)
    }
  }

  const submitLabel = objective === null ? 'Ajouter l’objectif' : 'Enregistrer'

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <div className={styles.formField}>
          <Field
            label="Intitulé"
            value={label}
            maxLength={MAX_OBJECTIVE_LABEL_LENGTH}
            autoComplete="off"
            inputRef={labelRef}
            aria-invalid={error?.field === 'label' ? true : undefined}
            aria-describedby={error?.field === 'label' ? ERROR_ID : undefined}
            onChange={(event) => {
              setLabel(event.target.value)
              if (error?.field === 'label') setError(undefined)
            }}
          />
          {error === undefined ? null : (
            <p id={ERROR_ID} className={styles.formError} role="alert">
              {error.message}
            </p>
          )}
        </div>

        <div role="group" aria-label="Domaine" className={styles.chipRow}>
          {domains.map((domain) => (
            <Chip
              key={domain.id}
              active={domainId === domain.id}
              onClick={() => setDomainId(domain.id)}
            >
              {domain.label}
            </Chip>
          ))}
        </div>

        <div role="group" aria-label="Niveaux" className={styles.chipRow}>
          {SECTIONS.map((section) => {
            const band = ageBandForSection(section)
            return (
              <Chip
                key={section}
                active={ageBands.includes(band)}
                onClick={() => toggleBand(band)}
              >
                {section}
              </Chip>
            )
          })}
        </div>

        {AGE_BANDS.filter((band) => ageBands.includes(band)).map((band) => {
          const section = sectionForAgeBand(band)
          return (
            <div key={band} className={styles.formField}>
              <Field
                label={`Exemple en ${section}`}
                value={examples[band] ?? ''}
                maxLength={MAX_OBJECTIVE_EXAMPLE_LENGTH}
                autoComplete="off"
                inputRef={(element) => {
                  exampleRefs.current[band] = element
                }}
                aria-invalid={error?.field === band ? true : undefined}
                aria-describedby={error?.field === band ? ERROR_ID : undefined}
                onChange={(event) => {
                  setExamples((previous) => ({
                    ...previous,
                    [band]: event.target.value,
                  }))
                  if (error?.field === band) setError(undefined)
                }}
              />
            </div>
          )
        })}

        <SheetActions>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={label.trim() === '' || ageBands.length === 0 || saving}
          >
            {submitLabel}
          </Button>
          {objective === null ? null : (
            <Button
              variant="danger"
              fullWidth
              disabled={saving}
              onClick={() => onRequestDelete(objective)}
            >
              <Icon name="trash" size={18} />
              Supprimer l’objectif
            </Button>
          )}
          <Button variant="ghost" fullWidth disabled={saving} onClick={onClose}>
            Annuler
          </Button>
        </SheetActions>
      </form>
    </Sheet>
  )
}
