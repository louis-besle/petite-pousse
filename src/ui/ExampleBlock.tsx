import type { ReactNode } from 'react'
import styles from './ExampleBlock.module.css'

export interface ExampleBlockProps {
  label: string
  children: ReactNode
  /** Marge supérieure quand le bloc suit un autre contenu (fiche réussite). */
  spaced?: boolean
}

/** Exemple de réussite : petit intitulé en capitales puis le texte. */
export function ExampleBlock({ label, children, spaced = false }: ExampleBlockProps) {
  return (
    <div className={spaced ? `${styles.exampleBlock} ${styles.spaced}` : styles.exampleBlock}>
      <p className={styles.exampleLabel}>{label}</p>
      <p className={styles.exampleText}>{children}</p>
    </div>
  )
}
