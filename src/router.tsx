import { createHashRouter, type RouteObject } from 'react-router-dom'
import { ClassScreen } from '@/features/class/ClassScreen'
import { AppShell } from '@/ui/AppShell'
import { ScreenPlaceholder } from '@/ui/ScreenPlaceholder'

/**
 * Table de routes unique de l'application. `AppShell` sert de layout parent :
 * il porte le lien d'évitement, `main#main` et la navigation basse.
 */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <ClassScreen /> },
      { path: '/capture', element: <ScreenPlaceholder title="Choisir un élève" /> },
      {
        path: '/capture/:studentId/photo',
        element: <ScreenPlaceholder title="Prendre une photo" />,
      },
      {
        path: '/capture/objective',
        element: <ScreenPlaceholder title="Choisir un objectif" />,
      },
      {
        path: '/success/:validationId',
        element: <ScreenPlaceholder title="Réussite enregistrée" />,
      },
      { path: '/students', element: <ScreenPlaceholder title="Gérer les élèves" /> },
      { path: '/students/:studentId', element: <ScreenPlaceholder title="Dossier élève" /> },
      { path: '/programme', element: <ScreenPlaceholder title="Programme" /> },
      { path: '/bilans', element: <ScreenPlaceholder title="Bilans" /> },
      { path: '/bilans/:studentId', element: <ScreenPlaceholder title="Bilan de l’élève" /> },
      { path: '/settings', element: <ScreenPlaceholder title="Réglages" /> },
      { path: '*', element: <ScreenPlaceholder title="Page introuvable" /> },
    ],
  },
]

export const router = createHashRouter(routes)
