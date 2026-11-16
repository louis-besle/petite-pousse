import type { ReactNode } from 'react'
import styles from './SheetActions.module.css'

/** Actions empilées en bas d'une fiche (pleine largeur, espacement régulier). */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className={styles.sheetActions}>{children}</div>
}
