import { createContext, useContext } from 'react'

export interface ToastApi {
  showToast: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

/**
 * Accès au toast global. Vit dans son propre module pour que `ToastProvider.tsx`
 * n'exporte qu'un composant (Fast Refresh).
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (api === null) {
    throw new Error('useToast doit être utilisé à l’intérieur d’un ToastProvider.')
  }
  return api
}
