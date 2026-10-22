import styles from './ui.module.css'

export interface FlowerMarkProps {
  size?: number
}

/** Marque florale décorative de l'application (quatre pétales + cœur encre). */
export function FlowerMark({ size = 18 }: FlowerMarkProps) {
  return (
    <svg
      className={styles.flower}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.petalTerra} cx="12" cy="6" r="4.2" />
      <circle className={styles.petalMustard} cx="18" cy="12" r="4.2" />
      <circle className={styles.petalSage} cx="12" cy="18" r="4.2" />
      <circle className={styles.petalSky} cx="6" cy="12" r="4.2" />
      <circle className={styles.petalCenter} cx="12" cy="12" r="2.6" />
    </svg>
  )
}
