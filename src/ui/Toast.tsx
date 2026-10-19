import styles from './Toast.module.css'

export interface ToastProps {
  message: string
}

/** Message éphémère annoncé poliment aux lecteurs d'écran. */
export function Toast({ message }: ToastProps) {
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  )
}
