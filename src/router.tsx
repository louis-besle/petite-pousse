import { createHashRouter, type RouteObject } from 'react-router-dom'
import { BilanPreviewScreen } from '@/features/bilans/BilanPreviewScreen'
import { BilansScreen } from '@/features/bilans/BilansScreen'
import { ClassScreen } from '@/features/class/ClassScreen'
import { ObjectiveScreen } from '@/features/capture/ObjectiveScreen'
import { DossierScreen } from '@/features/dossier/DossierScreen'
import { PhotoScreen } from '@/features/capture/PhotoScreen'
import { StudentPickerScreen } from '@/features/capture/StudentPickerScreen'
import { SuccessScreen } from '@/features/capture/SuccessScreen'
import { ManageStudentsScreen } from '@/features/students/ManageStudentsScreen'
import { ProgrammeScreen } from '@/features/programme/ProgrammeScreen'
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
      { path: '/capture', element: <StudentPickerScreen /> },
      {
        path: '/capture/:studentId/photo',
        element: <PhotoScreen />,
      },
      {
        path: '/capture/objective',
        element: <ObjectiveScreen />,
      },
      {
        path: '/success/:validationId',
        element: <SuccessScreen />,
      },
      { path: '/students', element: <ManageStudentsScreen /> },
      { path: '/students/:studentId', element: <DossierScreen /> },
      { path: '/programme', element: <ProgrammeScreen /> },
      { path: '/bilans', element: <BilansScreen /> },
      { path: '/bilans/:studentId', element: <BilanPreviewScreen /> },
      { path: '/settings', element: <ScreenPlaceholder title="Réglages" /> },
      { path: '*', element: <ScreenPlaceholder title="Page introuvable" /> },
    ],
  },
]

export const router = createHashRouter(routes)
