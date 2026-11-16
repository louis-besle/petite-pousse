import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  title: string
  text: string
  /** Classe supplémentaire du conteneur (marges propres à l'écran). */
  className?: string
  /** Action facultative (lien ou bouton), stylée par l'appelant. */
  children?: ReactNode
}

/**
 * État vide commun : un titre, un texte court et une action facultative.
 * L'appelant garde la main sur le style de son lien ou de son bouton.
 */
export function EmptyState({ title, text, className, children }: EmptyStateProps) {
  return (
    <div className={className === undefined ? styles.empty : `${styles.empty} ${className}`}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyText}>{text}</p>
      {children}
    </div>
  )
}

export interface EmptyStateLinkProps {
  to: string
  children: ReactNode
}

/** Lien d'action d'un état vide (navigation interne). */
export function EmptyStateLink({ to, children }: EmptyStateLinkProps) {
  return (
    <Link to={to} className={styles.emptyLink}>
      {children}
    </Link>
  )
}
