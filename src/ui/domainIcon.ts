import type { Domain } from '@/domain/types'
import type { IconName } from './icons'

/** Icône associée à chaque domaine du référentiel. */
export const DOMAIN_ICONS: Record<Domain['id'], IconName> = {
  langage: 'book',
  maths: 'shapes',
  corps: 'ball',
  arts: 'palette',
  temps: 'clock',
  vivant: 'leaf',
  evar: 'heart',
}

/** Icône d'un domaine, avec repli `file` pour un domaine retiré du référentiel. */
export function domainIcon(domainId: string): IconName {
  return DOMAIN_ICONS[domainId as Domain['id']] ?? 'file'
}
