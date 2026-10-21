import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Toast } from './Toast'
import { ToastContext } from './useToast'

/** Durée d'affichage d'un toast, alignée sur le prototype. */
const TOAST_DURATION_MS = 2600

export interface ToastProviderProps {
  children: ReactNode
}

/**
 * Un seul toast à la fois : un nouveau message remplace le courant et relance
 * le minuteur de 2,6 s. La région live est montée en permanence, seul son
 * texte change.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const showToast = useCallback(
    (nextMessage: string) => {
      clearTimer()
      setMessage(nextMessage)
      timerRef.current = setTimeout(() => {
        setMessage(null)
        timerRef.current = null
      }, TOAST_DURATION_MS)
    },
    [clearTimer],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  const api = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(<Toast message={message} />, document.body)}
    </ToastContext.Provider>
  )
}
