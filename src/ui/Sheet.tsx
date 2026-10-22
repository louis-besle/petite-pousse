import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './IconButton'
import { Icon } from './icons'
import styles from './Sheet.module.css'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * Verrou de défilement partagé par toutes les feuilles montées. Deux feuilles
 * empilées (fiche + confirmation) ne doivent pas se rendre le défilement quand
 * la seconde se démonte avant la première.
 */
let bodyScrollLockCount = 0
let bodyScrollOverflow = ''

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Feuille modale montée dans un portail.
 *
 * - `role="dialog"` + `aria-modal="true"`, nommée par son titre ;
 * - focus déplacé dans la feuille à l'ouverture, piégé dedans ;
 * - focus rendu au déclencheur à la fermeture ;
 * - fermeture par Échap ou par clic sur le fond.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const active = document.activeElement
    restoreFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null
    panelRef.current?.focus()

    return () => {
      const trigger = restoreFocusRef.current
      restoreFocusRef.current = null
      if (trigger?.isConnected) trigger.focus()
    }
  }, [open])

  // Échap ferme la feuille. Si deux feuilles sont empilées, seule celle qui
  // contient le focus (la plus haute) réagit.
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      const panel = panelRef.current
      if (!panel || !(event.target instanceof Node) || !panel.contains(event.target)) return
      event.preventDefault()
      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Empêche le contenu derrière la feuille de défiler. Le compteur de module
  // évite qu'une feuille empilée restaure « hidden » en se démontant.
  useEffect(() => {
    if (!open) return

    if (bodyScrollLockCount === 0) {
      bodyScrollOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    bodyScrollLockCount += 1

    return () => {
      bodyScrollLockCount -= 1
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = bodyScrollOverflow
      }
    }
  }, [open])

  if (!open) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return

    const panel = panelRef.current
    if (!panel) return

    const focusables = focusableElements(panel)
    if (focusables.length === 0) {
      event.preventDefault()
      return
    }

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement

    if (event.shiftKey) {
      if (active === first || active === panel || !panel.contains(active)) {
        event.preventDefault()
        last.focus()
      }
      return
    }

    if (active === last || active === panel || !panel.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className={styles.overlay}>
      <div
        className={styles.backdrop}
        data-testid="sheet-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.panel}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <IconButton label="Fermer" variant="plain" onClick={onClose}>
            <Icon name="close" size={20} />
          </IconButton>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
