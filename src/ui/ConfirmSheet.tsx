import type { ReactNode } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'
import styles from './Sheet.module.css'

export interface ConfirmSheetProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onClose: () => void
}

/**
 * Feuille de confirmation : action principale (destructive ou non) puis annulation.
 * `onConfirm` et `onClose` laissent l'appelant décider de refermer la feuille.
 */
export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className={styles.description}>{description}</p>
      <div className={styles.actions}>
        <Button fullWidth variant={tone} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button fullWidth variant="ghost" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </Sheet>
  )
}
