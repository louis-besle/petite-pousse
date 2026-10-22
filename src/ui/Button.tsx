import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'dark'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primary` (terre cuite) : action principale.
   * `dark` (encre) : action secondaire forte.
   * `ghost` : action discrète sur carte.
   * `danger` : action destructive (rose).
   */
  variant?: ButtonVariant
  fullWidth?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      data-variant={variant}
      className={[styles.button, fullWidth ? styles.fullWidth : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
