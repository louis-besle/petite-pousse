import styles from './ScreenPlaceholder.module.css'

export interface ScreenPlaceholderProps {
  /** Titre principal de l'écran, repris tel quel dans le `h1`. */
  title: string
}

/**
 * Écran provisoire en attendant son implémentation : un seul titre de niveau 1
 * et une note discrète, dans la coquille fournie par `AppShell`.
 */
export function ScreenPlaceholder({ title }: ScreenPlaceholderProps) {
  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.note}>Cet écran sera disponible dans une prochaine étape.</p>
    </section>
  )
}
