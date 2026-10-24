import { useEffect, useState } from 'react'
import { Button } from '@/ui/Button'
import styles from './settings.module.css'

const UNITS = ['o', 'Ko', 'Mo', 'Go', 'To'] as const

/** `1536` → `1,5 Ko`. Unités binaires, séparateur décimal français. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o'

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  )
  const value = bytes / 1024 ** unitIndex
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)

  return `${formatted} ${UNITS[unitIndex]}`
}

type EstimateState =
  | { status: 'loading' }
  | { status: 'ready'; usage: number; quota: number }
  | { status: 'unsupported' }
  | { status: 'error' }

type PersistenceState =
  | 'checking'
  | 'unknown'
  | 'requesting'
  | 'granted'
  | 'refused'
  | 'error'

/**
 * Estimation de l'espace utilisé et demande de stockage persistant.
 *
 * Les API `navigator.storage` ne sont pas garanties : chaque accès est testé,
 * chaque promesse est rattrapée. Un navigateur sans API affiche un repli en
 * français plutôt qu'un bouton inerte.
 */
export function StoragePanel() {
  const [manager] = useState<StorageManager | undefined>(() => {
    try {
      return navigator.storage
    } catch {
      return undefined
    }
  })

  const [estimate, setEstimate] = useState<EstimateState>(() =>
    typeof manager?.estimate === 'function'
      ? { status: 'loading' }
      : { status: 'unsupported' },
  )
  const [persistence, setPersistence] = useState<PersistenceState>(() =>
    typeof manager?.persisted === 'function' ? 'checking' : 'unknown',
  )

  const canPersist = typeof manager?.persist === 'function'
  const canRequestPersistence =
    canPersist &&
    (persistence === 'unknown' ||
      persistence === 'refused' ||
      persistence === 'error')

  useEffect(() => {
    let cancelled = false

    if (manager && typeof manager.estimate === 'function') {
      Promise.resolve()
        .then(() => manager.estimate())
        .then((result) => {
          if (cancelled) return
          setEstimate({
            status: 'ready',
            usage: typeof result.usage === 'number' ? result.usage : 0,
            quota: typeof result.quota === 'number' ? result.quota : 0,
          })
        })
        .catch((error) => {
          console.error('Estimation du stockage impossible.', error)
          if (!cancelled) setEstimate({ status: 'error' })
        })
    }

    if (manager && typeof manager.persisted === 'function') {
      Promise.resolve()
        .then(() => manager.persisted())
        .then((persisted) => {
          if (!cancelled) setPersistence(persisted ? 'granted' : 'unknown')
        })
        .catch(() => {
          if (!cancelled) setPersistence('unknown')
        })
    }

    return () => {
      cancelled = true
    }
  }, [manager])

  async function handlePersist(): Promise<void> {
    if (!manager || typeof manager.persist !== 'function') return
    if (persistence === 'requesting') return

    setPersistence('requesting')
    try {
      const granted = await manager.persist()
      // `persisted()` est la source de vérité quand elle est disponible : le
      // navigateur peut accorder sans que `persist()` le reflète immédiatement.
      const persistent =
        typeof manager.persisted === 'function' ? await manager.persisted() : granted
      setPersistence(persistent ? 'granted' : 'refused')
    } catch (error) {
      console.error('Demande de stockage persistant impossible.', error)
      setPersistence('error')
    }
  }

  const percent =
    estimate.status === 'ready' && estimate.quota > 0
      ? Math.min(100, Math.round((estimate.usage / estimate.quota) * 100))
      : 0

  return (
    <section className={styles.card} aria-labelledby="storage-heading">
      <h2 id="storage-heading" className={styles.sectionTitle}>
        Stockage
      </h2>
      <p className={styles.hint}>Tout reste dans ce navigateur, sur cet appareil.</p>

      {estimate.status === 'loading' ? (
        <p className={styles.loading} role="status">
          Estimation de l’espace utilisé…
        </p>
      ) : null}

      {estimate.status === 'unsupported' ? (
        <p className={styles.hint}>
          Ce navigateur ne fournit pas d’estimation de l’espace utilisé.
        </p>
      ) : null}

      {estimate.status === 'error' ? (
        <p className={styles.warning} role="status">
          L’espace utilisé n’a pas pu être mesuré.
        </p>
      ) : null}

      {estimate.status === 'ready' ? (
        <div className={styles.storageMeter}>
          <p className={styles.storageText}>
            {estimate.quota > 0
              ? `${formatBytes(estimate.usage)} utilisés sur ${formatBytes(estimate.quota)}`
              : `${formatBytes(estimate.usage)} utilisés`}
          </p>
          {estimate.quota > 0 && estimate.usage <= estimate.quota ? (
            <div className={styles.progressRow}>
              <progress
                className={styles.progress}
                value={estimate.usage}
                max={estimate.quota}
                aria-label="Espace de stockage utilisé"
              />
              <span className={styles.progressValue}>{percent} %</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {canPersist ? (
        <>
          {canRequestPersistence ? (
            <Button
              variant="ghost"
              fullWidth
              onClick={() => void handlePersist()}
            >
              Demander un stockage persistant
            </Button>
          ) : null}
          <p className={styles.status} role="status">
            {persistence === 'requesting'
              ? 'Demande envoyée au navigateur…'
              : persistence === 'granted'
                ? 'Stockage persistant accordé : le navigateur ne devrait pas effacer tes données.'
                : persistence === 'refused'
                  ? 'Le navigateur n’a pas accordé le stockage persistant. Pense à faire une sauvegarde régulière.'
                  : persistence === 'error'
                    ? 'La demande de stockage persistant n’a pas abouti. Réessaie plus tard.'
                    : null}
          </p>
        </>
      ) : (
        <p className={styles.warning}>
          Ce navigateur ne permet pas de demander un stockage persistant. Installe
          l’application sur l’écran d’accueil pour limiter l’effacement automatique.
        </p>
      )}
    </section>
  )
}
