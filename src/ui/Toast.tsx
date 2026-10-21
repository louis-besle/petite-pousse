import styles from './Toast.module.css'
import uiStyles from './ui.module.css'

export interface ToastProps {
  /** `null` quand aucun toast n'est affiché : la région reste montée et vide. */
  message: string | null
}

/**
 * Région live persistante : seul son texte change quand un toast apparaît.
 * Le nœud `role="status"` n'est jamais remonté, pour que les lecteurs d'écran
 * (notamment Safari/VoiceOver) annoncent bien chaque message.
 */
export function Toast({ message }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={message === null ? uiStyles.srOnly : styles.toast}
    >
      {message ?? ''}
    </div>
  )
}
