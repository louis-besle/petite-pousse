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
 * le minuteur de 2,6 s.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const showToast = useCallback(
    (message: string) => {
      clearTimer()
      idRef.current += 1
      setToast({ id: idRef.current, message })
      timerRef.current = setTimeout(() => {
        setToast(null)
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
      {toast !== null
        ? createPortal(<Toast key={toast.id} message={toast.message} />, document.body)
        : null}
    </ToastContext.Provider>
  )
}
