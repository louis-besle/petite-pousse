import type { ReactNode } from 'react'
import styles from './ScreenHeader.module.css'

export interface ScreenHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Contenu placé au-dessus du titre (ex. ligne de marque). */
  children?: ReactNode
}

/**
 * En-tête d'écran partagé : contenu libre au-dessus du titre (marque, retour),
 * titre principal et sous-titre facultatif.
 */
export function ScreenHeader({ title, subtitle, children }: ScreenHeaderProps) {
  return (
    <header className={styles.header}>
      {children}
      <h1 className={styles.title}>{title}</h1>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    </header>
  )
}
