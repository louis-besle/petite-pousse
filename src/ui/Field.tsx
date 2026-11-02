import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import styles from './ui.module.css'

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Libellé accessible, associé à l'input (visuellement masqué). */
  label: string
  icon?: ReactNode
  /** Référence de l'input, pour donner le focus au champ fautif. */
  inputRef?: Ref<HTMLInputElement>
}

export function Field({
  label,
  icon,
  id,
  className,
  inputRef,
  ...inputProps
}: FieldProps) {
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
        ref={inputRef}
        id={inputId}
        className={[styles.input, className].filter(Boolean).join(' ')}
      />
    </div>
  )
}
