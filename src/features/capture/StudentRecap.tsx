import type { ReactNode } from 'react'
import type { Student } from '@/domain/types'
import { Avatar } from '@/ui/Avatar'
import styles from './capture.module.css'

export interface StudentRecapProps {
  student: Student
  /** Suite du rappel, propre à l'écran (nom, état de la photo…). */
  children: ReactNode
}

/**
 * Rappel de l'élève en cours de capture : le groupe accessible et l'avatar
 * sont communs aux étapes photo et objectif, le reste dépend de l'écran.
 */
export function StudentRecap({ student, children }: StudentRecapProps) {
  return (
    <div
      className={styles.recap}
      role="group"
      aria-label={`Élève ${student.firstName}, section ${student.section}`}
    >
      <span className={styles.recapAvatar} aria-hidden="true">
        <Avatar name={student.firstName} section={student.section} size="md" />
      </span>
      {children}
    </div>
  )
}
