import type { Section } from '@/domain/types'
import { SectionPill } from './SectionPill'
import styles from './ui.module.css'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  name: string
  section: Section
  size?: AvatarSize
}

export function Avatar({ name, section, size = 'md' }: AvatarProps) {
  const trimmedName = name.trim()
  const initial = trimmedName.charAt(0).toUpperCase() || '?'

  return (
    <span className={styles.avatar} data-section={section} data-size={size}>
      <span className={styles.avatarCircle}>
        <span aria-hidden="true">{initial}</span>
        <span className={styles.srOnly}>{trimmedName}</span>
      </span>
      <SectionPill section={section} />
    </span>
  )
}
