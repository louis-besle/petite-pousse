import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './ui.module.css'

export interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  active?: boolean
  children?: ReactNode
}

export function Chip({
  active = false,
  className,
  type = 'button',
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-pressed={active}
      className={[styles.chip, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
