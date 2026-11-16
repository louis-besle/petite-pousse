import type { ReactNode } from 'react'
import styles from './CardList.module.css'

export interface CardListProps {
  children: ReactNode
  /** Classe supplémentaire du conteneur (marges propres à l'écran). */
  className?: string
  /** Filet entre les lignes (défaut : vrai). Certaines listes le portent déjà. */
  divided?: boolean
}

/** Liste de cartes empilées, séparées par un filet. */
export function CardList({ children, className, divided = true }: CardListProps) {
  return (
    <ul
      className={[styles.list, divided ? styles.divided : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </ul>
  )
}
