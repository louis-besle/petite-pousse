import type { ReactNode } from 'react'
import styles from './LoadingText.module.css'

/** Paragraphe de chargement annoncé aux lecteurs d'écran. */
export function LoadingText({ children }: { children: ReactNode }) {
  return (
    <p className={styles.loading} role="status">
      {children}
    </p>
  )
}
