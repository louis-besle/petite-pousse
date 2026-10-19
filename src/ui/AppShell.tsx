import { Outlet, useLocation } from 'react-router-dom'
import { NavBar } from './NavBar'
import styles from './AppShell.module.css'

/** La capture et l'écran de succès occupent tout l'écran, sans navigation basse. */
const HIDDEN_NAV_PATTERN = /^\/(capture|success)(\/|$)/

function hidesNav(pathname: string): boolean {
  return HIDDEN_NAV_PATTERN.test(pathname)
}

/**
 * Coquille de l'application : lien d'évitement, contenu principal et navigation
 * basse masquée pendant la capture.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const withNav = !hidesNav(pathname)

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
