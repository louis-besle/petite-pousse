import type { Section } from '@/domain/types'
import styles from './ui.module.css'

export interface SectionPillProps {
  section: Section
}

/**
 * Pastille de section : la lettre est toujours affichée,
 * l'information ne repose donc jamais sur la couleur seule.
 */
export function SectionPill({ section }: SectionPillProps) {
  return (
    <span className={styles.sectionPill} data-section={section}>
      {section}
    </span>
  )
}
