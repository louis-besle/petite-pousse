import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './ui.module.css'

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Libellé accessible, associé à l'input (visuellement masqué). */
  label: string
  icon?: ReactNode
}

export function Field({ label, icon, id, className, ...inputProps }: FieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={styles.field}>
      {icon ? (
        <span className={styles.fieldIcon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <label className={styles.srOnly} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        className={[styles.input, className].filter(Boolean).join(' ')}
      />
    </div>
  )
}
