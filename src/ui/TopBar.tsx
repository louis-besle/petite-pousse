import type { ReactNode } from 'react'
import styles from './TopBar.module.css'

export interface TopBarProps {
  left?: ReactNode
  title: ReactNode
  right?: ReactNode
}

/** Barre haute d'un écran : action à gauche, titre tronqué, contenu à droite. */
export function TopBar({ left, title, right }: TopBarProps) {
  return (
    <div className={styles.topBar}>
      {left}
      <h1 className={styles.title}>{title}</h1>
      {right}
    </div>
  )
}
