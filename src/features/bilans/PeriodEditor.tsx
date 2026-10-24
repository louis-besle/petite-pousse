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

/** « 1 septembre 2026 » → « 1er septembre 2026 ». */
function dayLabel(date: string): string {
  const formatted = formatLongDate(date)
  return formatted.startsWith('1 ') ? `1er${formatted.slice(1)}` : formatted
}

/** « 1 réussite change de bilan », « 2 réussites changent de bilan ». */
function movedLabel(count: number): string {
  return `${count} réussite${count > 1 ? 's' : ''} change${count > 1 ? 'nt' : ''} de bilan`
}

export interface PeriodEditorProps {
  year: SchoolYear
  validations: Validation[]
  /**
   * Affiche aussi la fin du bilan 2. Réservé aux réglages : l'écran Bilans ne
   * règle que la date de changement de semestre.
   */
  allowPeriod2End?: boolean
  onClose: () => void
}

/**
 * Réglage des dates de bilan d'une année. La date de changement doit rester
 * strictement entre la rentrée et la fin du bilan 2 : les bornes sont exclues,
 * car le bilan 1 doit avoir au moins un jour et le bilan 2 aussi. Quand
 * `allowPeriod2End` est vrai, la fin du bilan 2 est réglable dans le même
 * formulaire, avec la même contrainte.
 *
 * Le récapitulatif compte les validations qui changent de bilan avant
 * l'enregistrement ; il ne dépend que de la date de changement. La feuille
 * reste ouverte si l'écriture échoue.
 */
export function PeriodEditor({
  year,
  validations,
  allowPeriod2End = false,
  onClose,
}: PeriodEditorProps) {
  const { showToast } = useToast()
  // Date d'origine figée à l'ouverture : le récapitulatif ne doit pas se
  // recalculer sur la valeur déjà enregistrée pendant l'animation de fermeture.
  const [oldDate] = useState(year.period1End)
  const [value, setValue] = useState(year.period1End)
  const [endValue, setEndValue] = useState(year.period2End)
  const [saving, setSaving] = useState(false)
  const inputId = useId()
  const endInputId = useId()
  const errorId = useId()
  const endErrorId = useId()
  const recapId = useId()

  const validDate = isDateString(value)
  const validEnd = allowPeriod2End ? isDateString(endValue) : true
  const cutoverInBounds =
    validDate &&
    year.start < value &&
    (allowPeriod2End ? validEnd && value < endValue : value < year.period2End)
  const endInBounds = allowPeriod2End ? validEnd && value < endValue : true

  const upperBound = allowPeriod2End && validEnd ? endValue : year.period2End
  const error = !validDate
    ? INVALID_DATE_MESSAGE
    : cutoverInBounds
      ? undefined
      : `La date doit être comprise entre le ${dayLabel(year.start)} et le ${dayLabel(upperBound)} (bornes exclues).`

  const endError =
    allowPeriod2End && !validEnd
      ? INVALID_DATE_MESSAGE
      : allowPeriod2End && !endInBounds
        ? 'La fin du bilan 2 doit être postérieure à la date de changement.'
        : undefined

  // Le récapitulatif n'a de sens que pour une date de changement valide, dans
  // les bornes et différente de la date déjà enregistrée.
  const showRecap = validDate && cutoverInBounds && value !== oldDate
  const moved = showRecap
    ? countValidationsMovedByCutover(validations, oldDate, value)
    : 0
  const canSave = cutoverInBounds && endInBounds && !saving
  const describedBy = [showRecap ? recapId : undefined, error === undefined ? undefined : errorId]
    .filter(Boolean)
    .join(' ')
  const endDescribedBy = endError === undefined ? undefined : endErrorId

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSave) return

    setSaving(true)
    try {
      await updateSchoolYearPeriods(
        year.id,
        allowPeriod2End
          ? { period1End: value, period2End: endValue }
          : { period1End: value },
      )
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
          Le bilan 1 commence le {dayLabel(year.start)} et s’arrête le jour choisi.
          Le bilan 2 commence le lendemain et court jusqu’au {dayLabel(upperBound)}.
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

        {allowPeriod2End ? (
          <>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor={endInputId}>
                Fin du bilan 2
              </label>
              <input
                id={endInputId}
                type="date"
                className={styles.dateInput}
                value={endValue}
                aria-invalid={endError !== undefined}
                aria-describedby={endDescribedBy}
                onChange={(event) => setEndValue(event.target.value)}
              />
            </div>

            {endError === undefined ? null : (
              <p id={endErrorId} className={styles.error} role="alert">
                {endError}
              </p>
            )}
          </>
        ) : null}

        {showRecap ? (
          <p id={recapId} className={styles.recap}>
            {movedLabel(moved)}
          </p>
        ) : null}

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
