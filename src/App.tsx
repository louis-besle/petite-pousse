import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ToastProvider } from './ui/ToastProvider'

/** Racine de l'application : toasts et routeur à hash, montés une seule fois. */
export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
