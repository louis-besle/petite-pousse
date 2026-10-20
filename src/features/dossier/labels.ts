import type { AgeBand } from '@/domain/types'

/** Libellés des tranches d'âge, partagés par le dossier et la fiche. */
export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  before4: 'Avant 4 ans',
  from4: 'À partir de 4 ans',
  from5: 'À partir de 5 ans',
}
