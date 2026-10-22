import { useId, useState, type FormEvent } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { updateSchoolYearPeriods } from '@/db/schoolYears'
import { countValidationsMovedByCutover } from '@/domain/bilan'
import type { SchoolYear, Validation } from '@/domain/types'
import { formatLongDate } from '@/lib/date'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/useToast'
import styles from './bilans.module.css'

const SAVED_MESSAGE = 'Date de changement enregistrée.'
const SAVE_ERROR = 'La date n’a pas pu être enregistrée. Réessaie.'
const INVALID_DATE_MESSAGE = 'Choisis une date valide.'

/** `YYYY-MM-DD` existant, jamais une date décalée par le fuseau. */
function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const parsed = parseISO(value)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value
}

/** « 1 réussite change de bilan », « 2 réussites changent de bilan ». */
function movedLabel(count: number): string {
  return `${count} réussite${count > 1 ? 's' : ''} change${count > 1 ? 'nt' : ''} de bilan`
}

export interface PeriodEditorProps {
  year: SchoolYear
  validations: Validation[]
  onClose: () => void
}

/**
 * Réglage de la date de changement de semestre pour une année. La date doit
 * rester strictement entre la rentrée et la fin du bilan 2 : les bornes sont
 * exclues, car le bilan 1 doit avoir au moins un jour et le bilan 2 aussi.
 *
 * Le récapitulatif compte les validations qui changent de bilan avant
 * l'enregistrement ; la feuille reste ouverte si l'écriture échoue.
 */
export function PeriodEditor({ year, validations, onClose }: PeriodEditorProps) {
  const { showToast } = useToast()
  // Date d'origine figée à l'ouverture : le récapitulatif ne doit pas se
  // recalculer sur la valeur déjà enregistrée pendant l'animation de fermeture.
  const [oldDate] = useState(year.period1End)
  const [value, setValue] = useState(year.period1End)
  const [saving, setSaving] = useState(false)
  const inputId = useId()
  const errorId = useId()
  const recapId = useId()

  const validDate = isDateString(value)
  const inBounds = validDate && year.start < value && value < year.period2End
  const error =
    validDate === false
      ? INVALID_DATE_MESSAGE
      : inBounds
        ? undefined
        : `La date doit être comprise entre le ${formatLongDate(year.start)} et le ${formatLongDate(year.period2End)} (bornes exclues).`

  const moved = validDate
    ? countValidationsMovedByCutover(validations, oldDate, value)
    : 0
  const canSave = inBounds && !saving
  const describedBy = [recapId, error === undefined ? undefined : errorId]
    .filter(Boolean)
    .join(' ')

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSave) return

    setSaving(true)
    try {
      await updateSchoolYearPeriods(year.id, { period1End: value })
      showToast(SAVED_MESSAGE)
      onClose()
    } catch (caught) {
      console.error('Enregistrement de la date de changement impossible.', caught)
      showToast(SAVE_ERROR)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open title="Modifier la date de changement" onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <p className={styles.formHint}>
          Le bilan 1 s’arrête le jour choisi. Le bilan 2 commence le lendemain et
          court jusqu’au {formatLongDate(year.period2End)}.
        </p>

        <div className={styles.formField}>
          <label className={styles.fieldLabel} htmlFor={inputId}>
            Date de changement de semestre
          </label>
          <input
            id={inputId}
            type="date"
            className={styles.dateInput}
            value={value}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        {error === undefined ? null : (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}

        <p id={recapId} className={styles.recap}>
          {movedLabel(moved)}
        </p>

        <div className={styles.formActions}>
          <Button type="submit" variant="dark" fullWidth disabled={!canSave}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
