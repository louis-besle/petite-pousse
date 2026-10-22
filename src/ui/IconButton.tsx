import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './ui.module.css'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Libellé accessible, obligatoire pour un bouton icône seule. */
  label: string
  variant?: 'outlined' | 'plain'
  children?: ReactNode
}

export function IconButton({
  label,
  variant = 'outlined',
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      data-variant={variant}
      className={[styles.iconButton, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
