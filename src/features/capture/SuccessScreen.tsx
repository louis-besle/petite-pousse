import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '@/db/db'
import { domainById, referential } from '@/domain/referential'
import type { Student, Validation } from '@/domain/types'
import { formatShortDate } from '@/lib/date'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/icons'
import styles from './capture.module.css'

interface SuccessSnapshot {
  validation: Validation | null
  student: Student | null
}

/**
 * Confirmation d'une réussite enregistrée. L'écran relit la validation par son
 * identifiant : un lien partagé ou un rechargement iOS affiche donc le même
 * contenu, et une validation disparue est traitée sans planter.
 */
export function SuccessScreen() {
  const { validationId = '' } = useParams<{ validationId: string }>()
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<SuccessSnapshot>()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let active = true

    void db.validations.get(validationId).then(async (validation) => {
      const student =
        validation === undefined ? undefined : await db.students.get(validation.studentId)

      if (active) {
        setSnapshot({ validation: validation ?? null, student: student ?? null })
      }
    })

    return () => {
      active = false
    }
  }, [validationId])

  // L'annonce du résultat est portée par le titre, focalisé dès qu'il est monté.
  useEffect(() => {
    headingRef.current?.focus()
  }, [snapshot])

  if (snapshot === undefined) {
    return (
      <section className={styles.successScreen}>
        <p className={styles.loading} role="status">
          Chargement de la réussite…
        </p>
      </section>
    )
  }

  if (snapshot.validation === null || snapshot.student === null) {
    return (
      <section className={styles.successScreen}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.successTitle}>
          Réussite introuvable
        </h1>
        <p className={styles.successLead}>
          Cette réussite n’existe plus ou n’a pas pu être chargée.
        </p>
        <Link to="/" className={styles.successClassLink}>
          Retour à la classe
        </Link>
      </section>
    )
  }

  const { validation, student } = snapshot
  const domain = domainById(referential, validation.snapshot.domainId)
  const photoLabel = validation.photoId === undefined ? 'sans photo' : 'avec photo'

  return (
    <section className={styles.successScreen}>
      <div className={styles.successInner}>
        <span className={styles.successCheck} aria-hidden="true">
          <Icon name="check" size={48} />
        </span>

        <h1 ref={headingRef} tabIndex={-1} className={styles.successTitle}>
          C'est noté !
        </h1>
        <p className={styles.successLead}>
          La réussite est ajoutée au dossier de <strong>{student.firstName}</strong>.
        </p>

        <div className={styles.successCard}>
          <p className={styles.successKicker}>
            {domain.longLabel.toUpperCase()} · {student.section}
          </p>
          <p className={styles.successObjective}>{validation.snapshot.objectiveLabel}</p>
          <p className={styles.successMeta}>
            {formatShortDate(validation.date)} · {photoLabel}
          </p>
        </div>

        <div className={styles.successActions}>
          <Button
            variant="dark"
            fullWidth
            onClick={() => navigate(`/students/${student.id}`)}
          >
            <Icon name="users" size={18} />
            Voir le dossier de {student.firstName}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
            Retour à la classe
          </Button>
        </div>
      </div>
    </section>
  )
}
