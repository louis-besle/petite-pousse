import styles from './YearSelect.module.css'

export interface YearSelectProps {
  /** Id HTML du `select`, unique par écran. */
  id: string
  /** Années proposées, déjà triées. */
  yearIds: string[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Ajoute « Toutes les années » avec la valeur `all`. */
  includeAll?: boolean
  allLabel?: string
}

/**
 * Sélecteur d'année scolaire commun aux écrans (programme, dossier, bilans).
 * Composant purement contrôlé : la sélection appartient à l'appelant.
 */
export function YearSelect({
  id,
  yearIds,
  value,
  onChange,
  disabled = false,
  includeAll = false,
  allLabel = 'Toutes les années',
}: YearSelectProps) {
  return (
    <div className={styles.yearRow}>
      <label htmlFor={id} className={styles.yearLabel}>
        Année scolaire
      </label>
      <select
        id={id}
        className={styles.yearSelect}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {yearIds.map((yearId) => (
          <option key={yearId} value={yearId}>
            {yearId}
          </option>
        ))}
        {includeAll ? <option value="all">{allLabel}</option> : null}
      </select>
    </div>
  )
}
