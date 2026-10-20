import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/router'
import { ToastProvider } from '@/ui/ToastProvider'

export interface RenderAppOptions {
  /** Route initiale du routeur mémoire. */
  route: string
}

/**
 * Monte l'application complète (routeur, coquille et toasts) pour les tests.
 * Le routeur est recréé à chaque appel, sans table de routes parallèle.
 */
export function renderApp({ route }: RenderAppOptions) {
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  const result = render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )

  return { ...result, router }
}
