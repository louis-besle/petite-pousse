import type { Section } from '@/domain/types'
import { Chip } from './Chip'

/** `all` affiche toute la classe ; les autres valeurs filtrent une section. */
export type SectionFilter = 'all' | Section

export interface SectionFilterChipsProps {
  value: SectionFilter
  onChange: (value: SectionFilter) => void
  /** Nom du groupe pour les lecteurs d'écran (ex. « Filtrer par section »). */
  ariaLabel: string
  /** Libellé de l'option « toutes les sections » (défaut « Tous »). */
  allLabel?: string
  /** Classe du conteneur : chaque écran garde ses marges. */
  className?: string
}

const FILTERS: { value: SectionFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'PS', label: 'PS' },
  { value: 'MS', label: 'MS' },
  { value: 'GS', label: 'GS' },
]

/**
 * Filtre par section commun à la classe, au choix d'élève, au programme et à
 * la fiche d'objectif. Le conteneur (`className`) reste à la charge de l'écran.
 */
export function SectionFilterChips({
  value,
  onChange,
  ariaLabel,
  allLabel = 'Tous',
  className,
}: SectionFilterChipsProps) {
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {FILTERS.map((item) => (
        <Chip
          key={item.value}
          active={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.value === 'all' ? allLabel : item.label}
        </Chip>
      ))}
    </div>
  )
}
