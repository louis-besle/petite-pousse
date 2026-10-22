import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { clearCaptureDraft, getCaptureDraft } from '@/db/drafts'
import { createValidation, useValidationsForStudent } from '@/db/validations'
import { AlreadyValidatedError } from '@/domain/errors'
import {
  REFERENTIAL_VERSION,
  ageBandForSection,
  referential,
} from '@/domain/referential'
import type {
  AgeBand,
  CaptureDraft,
  Domain,
  Objective,
  Section,
  Student,
  Validation,
} from '@/domain/types'
import { formatShortDate, todayIso } from '@/lib/date'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { useToast } from '@/ui/useToast'
import styles from './capture.module.css'

type DomainFilter = 'all' | Domain['id']

const SECTION_BY_AGE_BAND: Record<AgeBand, Section> = {
  before4: 'PS',
  from4: 'MS',
  from5: 'GS',
}

const ALREADY_VALIDATED_MESSAGE = 'Cet objectif est déjà validé pour cet élève.'
const STORAGE_ERROR_MESSAGE = 'La réussite n’a pas pu être enregistrée. Réessaie.'

/** Recherche insensible à la casse et aux accents (« coordonnee » trouve « coordonnée »). */
function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Tranche retenue pour un objectif : celle de l'élève quand l'objectif la
 * propose, sinon la première du référentiel. Elle sert à la fois à l'affichage
 * du niveau et à l'instantané de la validation.
 */
function bandForObjective(objective: Objective, studentBand: AgeBand): AgeBand {
  return objective.ageBands.includes(studentBand)
    ? studentBand
    : objective.ageBands[0]
}

interface ObjectiveSnapshot {
  draft: CaptureDraft | null
  student: Student | null
}

/**
 * Étape 3 de la capture : choisir l'objectif et valider la réussite.
 *
 * Le brouillon `current` désigne l'élève et porte éventuellement la photo. Il
 * n'est effacé qu'après l'écriture effective de la validation : un échec de
 * stockage laisse donc le parcours reprenable.
 */
export function ObjectiveScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [snapshot, setSnapshot] = useState<ObjectiveSnapshot>()
  const [query, setQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all')
  const [showAllLevels, setShowAllLevels] = useState(false)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>()
  const [busy, setBusy] = useState(false)

  // Lecture explicite : elle distingue « chargement » de « aucun brouillon ».
  useEffect(() => {
    let active = true

    void getCaptureDraft().then(async (draft) => {
      const student = draft === undefined ? undefined : await db.students.get(draft.studentId)

      if (active) {
        setSnapshot({ draft: draft ?? null, student: student ?? null })
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (snapshot === undefined) return

    if (snapshot.draft === null || snapshot.student === null) {
      navigate('/capture', { replace: true })
    }
  }, [snapshot, navigate])

  const studentId = snapshot?.student?.id ?? ''
  const validations = useValidationsForStudent(studentId)

  if (snapshot === undefined) {
    return (
      <section className={styles.screen}>
        <p className={styles.loading} role="status">
          Chargement des objectifs…
        </p>
      </section>
    )
  }

  if (snapshot.draft === null || snapshot.student === null) {
    return (
      <section className={styles.screen}>
        <p className={styles.loading} role="status">
          Retour au choix de l’élève…
        </p>
      </section>
    )
  }

  const { draft, student } = snapshot
  const studentBand = ageBandForSection(student.section)
  const photo =
    draft.full !== undefined &&
    draft.thumb !== undefined &&
    draft.width !== undefined &&
    draft.height !== undefined
      ? {
          full: draft.full,
          thumb: draft.thumb,
          width: draft.width,
          height: draft.height,
          mime: 'image/jpeg' as const,
        }
      : undefined
  const hasPhoto = photo !== undefined

  const validatedByObjective = new Map<string, Validation>()
  for (const validation of validations ?? []) {
    validatedByObjective.set(validation.objectiveId, validation)
  }

  const domains = [...referential.domains].sort((a, b) => a.order - b.order)
  const domainOrder = new Map(domains.map((domain) => [domain.id, domain.order]))

  const normalizedQuery = normalizeSearch(query)
  const visibleObjectives = referential.objectives
    .filter((objective) => {
      const matchesLevel = showAllLevels || objective.ageBands.includes(studentBand)
      const matchesDomain = domainFilter === 'all' || objective.domainId === domainFilter
      const matchesQuery =
        normalizedQuery === '' ||
        normalizeSearch(objective.label).includes(normalizedQuery) ||
        normalizeSearch(
          domains.find((domain) => domain.id === objective.domainId)?.label ?? '',
        ).includes(normalizedQuery)

      return matchesLevel && matchesDomain && matchesQuery
    })
    .sort((a, b) => {
      // Les objectifs déjà validés passent en dernier, puis le domaine
      // officiel, puis l'intitulé. Le tri est stable.
      const aValidated = validatedByObjective.has(a.id) ? 1 : 0
      const bValidated = validatedByObjective.has(b.id) ? 1 : 0
      if (aValidated !== bValidated) return aValidated - bValidated

      const aOrder = domainOrder.get(a.domainId) ?? 0
      const bOrder = domainOrder.get(b.domainId) ?? 0
      if (aOrder !== bOrder) return aOrder - bOrder

      return a.label.localeCompare(b.label, 'fr')
    })

  // Une validation apparue entre-temps (autre onglet) rend le choix indisponible.
  const selectedObjective =
    selectedObjectiveId === undefined || validatedByObjective.has(selectedObjectiveId)
      ? undefined
      : referential.objectives.find(
          (objective) => objective.id === selectedObjectiveId,
        )

  async function handleValidate(): Promise<void> {
    if (selectedObjective === undefined || busy) return

    setBusy(true)
    const ageBand = bandForObjective(selectedObjective, studentBand)

    try {
      const validation = await createValidation({
        studentId: student.id,
        objective: selectedObjective,
        ageBand,
        date: todayIso(),
        referentialVersion: REFERENTIAL_VERSION,
        ...(photo === undefined ? {} : { photo }),
      })

      // Le brouillon n'est effacé qu'une fois la validation réellement écrite.
      await clearCaptureDraft()
      navigate(`/success/${validation.id}`, { replace: true })
    } catch (error) {
      if (error instanceof AlreadyValidatedError) {
        showToast(ALREADY_VALIDATED_MESSAGE)
      } else {
        console.error('Enregistrement de la réussite impossible.', error)
        showToast(STORAGE_ERROR_MESSAGE)
      }
      setBusy(false)
    }
  }

  return (
    <section
      className={`${styles.screen} ${styles.objectiveScreen}`}
      aria-busy={busy}
    >
      <div className={styles.topBar}>
        <IconButton label="Retour" onClick={() => navigate(`/capture/${student.id}/photo`)}>
          <Icon name="back" size={18} />
        </IconButton>
        <h1 className={styles.topTitle}>Choisir l'objectif</h1>
        <span className={styles.stepPill}>3 / 3</span>
      </div>

      <div
        className={styles.recap}
        role="group"
        aria-label={`Élève ${student.firstName}, section ${student.section}`}
      >
        <span className={styles.recapAvatar} aria-hidden="true">
          <Avatar name={student.firstName} section={student.section} size="md" />
        </span>
        <span className={styles.recapText}>
          <span className={styles.recapName}>
            {student.firstName} · {student.section}
          </span>
          <span className={styles.recapMeta}>
            <span className={styles.recapDot} aria-hidden="true" />
            {hasPhoto ? 'Photo ajoutée' : 'Validation sans photo'}
          </span>
        </span>
      </div>

      {hasPhoto ? null : (
        <div className={`${styles.infoStrip} ${styles.infoStripNoPhoto}`}>
          <Icon name="file" size={18} />
          <p>
            Tu peux valider sans photo.
            <span>Tu pourras en ajouter une plus tard depuis le dossier.</span>
          </p>
        </div>
      )}

      <Field
        type="search"
        label="Rechercher un objectif"
        icon={<Icon name="search" size={17} />}
        placeholder="Rechercher un objectif…"
        value={query}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => {
          setQuery(event.target.value)
          setSelectedObjectiveId(undefined)
        }}
      />

      <div
        className={styles.domainScroller}
        role="group"
        aria-label="Filtrer par domaine"
      >
        <Chip
          active={domainFilter === 'all'}
          onClick={() => {
            setDomainFilter('all')
            setSelectedObjectiveId(undefined)
          }}
        >
          Tous
        </Chip>
        {domains.map((domain) => (
          <Chip
            key={domain.id}
            active={domainFilter === domain.id}
            onClick={() => {
              setDomainFilter(domain.id)
              setSelectedObjectiveId(undefined)
            }}
          >
            {domain.label}
          </Chip>
        ))}
      </div>

      <div className={styles.levelRow}>
        <Chip
          active={showAllLevels}
          onClick={() => {
            setShowAllLevels((value) => !value)
            setSelectedObjectiveId(undefined)
          }}
        >
          Tous les niveaux
        </Chip>
      </div>

      {visibleObjectives.length === 0 ? (
        <p className={styles.filterEmpty} role="status">
          Aucun objectif ne correspond.
        </p>
      ) : (
        <ul className={styles.objectiveList}>
          {visibleObjectives.map((objective) => {
            const validation = validatedByObjective.get(objective.id)
            const isDone = validation !== undefined
            const selected = selectedObjectiveId === objective.id && !isDone
            const band = bandForObjective(objective, studentBand)
            const domain = domains.find((candidate) => candidate.id === objective.domainId)

            return (
              <li key={objective.id}>
                <button
                  type="button"
                  className={[
                    styles.objectiveCard,
                    selected ? styles.objectiveCardSelected : '',
                    isDone ? styles.objectiveCardDone : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={selected}
                  disabled={isDone}
                  onClick={() => setSelectedObjectiveId(objective.id)}
                >
                  <span className={styles.objectiveCheck} aria-hidden="true">
                    {selected || isDone ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className={styles.objectiveText}>
                    <span className={styles.objectiveLabel}>{objective.label}</span>
                    <span className={styles.objectiveMeta}>
                      {isDone
                        ? `Déjà validé · ${formatShortDate(validation.date)}`
                        : selected
                          ? 'Prêt à valider'
                          : `${SECTION_BY_AGE_BAND[band]} · ${domain?.label ?? ''}`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className={styles.ctaBar}>
        <Button
          variant="primary"
          fullWidth
          className={styles.cta}
          disabled={selectedObjective === undefined || busy}
          onClick={() => {
            void handleValidate()
          }}
        >
          {busy ? (
            'Enregistrement…'
          ) : (
            <>
              <Icon name="check" size={19} />
              Valider la réussite
            </>
          )}
        </Button>
      </div>
    </section>
  )
}
