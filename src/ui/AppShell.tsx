import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NavBar } from './NavBar'
import styles from './AppShell.module.css'

/** La capture et l'écran de succès occupent tout l'écran, sans navigation basse. */
const HIDDEN_NAV_PATTERN = /^\/(capture|success)(\/|$)/

const APP_NAME = 'Carnet de réussites'

function hidesNav(pathname: string): boolean {
  return HIDDEN_NAV_PATTERN.test(pathname)
}

/** Titre de page unique par route, pour l'onglet et les lecteurs d'écran. */
function titleFor(pathname: string): string {
  if (pathname === '/') return 'La classe'
  if (pathname === '/capture') return 'Nouvelle réussite'
  if (/^\/capture\/[^/]+\/photo$/.test(pathname)) return 'Nouvelle réussite'
  if (pathname === '/capture/objective') return 'Choisir l’objectif'
  if (/^\/success\/[^/]+$/.test(pathname)) return 'Réussite enregistrée'
  if (pathname === '/students') return 'Gérer les élèves'
  if (/^\/students\/[^/]+$/.test(pathname)) return 'Dossier de l’élève'
  if (pathname === '/programme') return 'Programme'
  if (pathname === '/bilans') return 'Bilans'
  if (/^\/bilans\/[^/]+$/.test(pathname)) return 'Aperçu du bilan'
  if (pathname === '/settings') return 'Réglages'
  return 'Page introuvable'
}

/**
 * Coquille de l'application : lien d'évitement, contenu principal et navigation
 * basse masquée pendant la capture.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const withNav = !hidesNav(pathname)
  const previousPathname = useRef(pathname)

  useEffect(() => {
    document.title = `${titleFor(pathname)} · ${APP_NAME}`

    // À chaque changement de route, le focus suit le contenu : un lecteur
    // d'écran annonce le nouvel écran au lieu de rester sur l'ancien lien.
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname
      document.getElementById('main')?.focus()
    }
  }, [pathname])

  function focusMain() {
    document.getElementById('main')?.focus()
  }

  return (
    <div className={[styles.shell, withNav ? styles.withNav : ''].filter(Boolean).join(' ')}>
      <a
        className={styles.skipLink}
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          focusMain()
        }}
      >
        Aller au contenu principal
      </a>
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      {withNav ? <NavBar /> : null}
    </div>
  )
}
