import type { ReactNode } from 'react'
import styles from './DomainAccordion.module.css'
import { Icon, type IconName } from './icons'

export interface DomainAccordionProps {
  id: string
  title: string
  icon: IconName
  /** Texte secondaire sous le titre (ex. « 3 objectifs · 7 validations »). */
  meta: ReactNode
  open: boolean
  onToggle: () => void
  /** Préfixe des ids de région : `${regionPrefix}-domain-${id}`. */
  regionPrefix: string
  children: ReactNode
}

/**
 * Accordéon d'un domaine : le titre porte le bouton, le corps n'est monté que
 * lorsque le domaine est ouvert. L'état d'ouverture reste chez l'appelant.
 */
export function DomainAccordion({
  id,
  title,
  icon,
  meta,
  open,
  onToggle,
  regionPrefix,
  children,
}: DomainAccordionProps) {
  const regionId = `${regionPrefix}-domain-${id}`

  return (
    <section className={styles.domainBlock} data-domain={id}>
      <h2 className={styles.domainHeading}>
        <button
          type="button"
          className={styles.domainHead}
          aria-expanded={open}
          aria-controls={open ? regionId : undefined}
          onClick={onToggle}
        >
          <span className={styles.domainIcon} data-domain={id} aria-hidden="true">
            <Icon name={icon} size={17} />
          </span>
          <span className={styles.domainText}>
            <span className={styles.domainTitle}>{title}</span>
            <span className={styles.domainCount}>{meta}</span>
          </span>
          <span className={styles.chevron} data-open={open} aria-hidden="true">
            <Icon name="chevron" size={16} />
          </span>
        </button>
      </h2>

      {open ? (
        <div id={regionId} className={styles.domainBody} role="region" aria-label={title}>
          {children}
        </div>
      ) : null}
    </section>
  )
}

/** Liste des accordéons de domaines. */
export function DomainAccordionList({ children }: { children: ReactNode }) {
  return <div className={styles.domains}>{children}</div>
}

/** Liste des lignes à l'intérieur d'un accordéon. */
export function DomainAccordionRows({ children }: { children: ReactNode }) {
  return <ul className={styles.rows}>{children}</ul>
}

/** Message affiché quand un domaine ouvert ne contient aucune ligne. */
export function DomainAccordionEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.domainEmpty}>{children}</p>
}
