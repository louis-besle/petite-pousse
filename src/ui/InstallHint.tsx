/* eslint-disable react-refresh/only-export-components -- le hook, la détection
   d'appareil et la notice partagent volontairement le même module. */
import { useEffect, useState } from 'react'
import styles from './ui.module.css'

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined'
}

/** Vrai si la page tourne déjà comme une application installée. */
function readStandalone(): boolean {
  if (!isBrowserEnvironment()) return false

  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return true
  }

  return (window.navigator as NavigatorWithStandalone).standalone === true
}

/**
 * Détecte le mode « installé » : `display-mode: standalone` sur Android et
 * ordinateur, `navigator.standalone` sur iOS. La requête média est écoutée
 * quand le navigateur le permet, puis l'écoute est retirée au démontage.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(readStandalone)

  useEffect(() => {
    if (!isBrowserEnvironment() || typeof window.matchMedia !== 'function') return

    const query = window.matchMedia('(display-mode: standalone)')
    const update = () => setStandalone(readStandalone())

    // L'état a pu changer entre le rendu et l'effet.
    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }

    // Safari 13 et antérieurs : API héritée.
    if (typeof query.addListener === 'function') {
      query.addListener(update)
      return () => query.removeListener(update)
    }

    return
  }, [])

  return standalone
}

/**
 * iPhone, iPod, iPad, et iPadOS 13+ qui se présente comme un Mac tactile.
 */
export function isIosDevice(): boolean {
  if (!isBrowserEnvironment()) return false

  const { userAgent, platform, maxTouchPoints } = window.navigator
  if (/iPad|iPhone|iPod/.test(userAgent)) return true

  return platform === 'MacIntel' && maxTouchPoints > 1
}

/**
 * Notice d'installation sur l'écran d'accueil, réservée à iOS/iPadOS tant que
 * l'application n'est pas déjà installée. Rien n'est rendu ailleurs : Android
 * et les ordinateurs installent depuis le menu du navigateur.
 */
export function InstallHint() {
  const standalone = useIsStandalone()

  if (standalone || !isIosDevice()) return null

  return (
    <div className={styles.installHint}>
      <p className={styles.installHintLead}>
        Pour installer l’application sur cet appareil :
      </p>
      <ol className={styles.installHintList}>
        <li>
          Touche <strong>Partager</strong> (le carré avec une flèche vers le
          haut).
        </li>
        <li>
          Choisis <strong>« Sur l’écran d’accueil »</strong>, puis confirme.
        </li>
      </ol>
      <p className={styles.installHintNote}>
        Une fois installée, l’application s’ouvre comme les autres et fonctionne
        hors ligne.
      </p>
    </div>
  )
}
