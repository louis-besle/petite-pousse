import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { saveCaptureDraft } from '@/db/drafts'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useValidationsForStudent } from '@/db/validations'
import { ageBandForSection, referential } from '@/domain/referential'
import { resolveCurrentSchoolYearId } from '@/domain/schoolYear'
import type { Section, Validation } from '@/domain/types'
import { formatShortDate, todayIso } from '@/lib/date'
import { sortedSchoolYearIds } from '@/lib/schoolYearSelection'
import { successLabel } from '@/lib/text'
import { usePhotoThumb } from '@/lib/usePhoto'
import { Avatar } from '@/ui/Avatar'
import {
  DomainAccordion,
  DomainAccordionEmpty,
  DomainAccordionList,
  DomainAccordionRows,
} from '@/ui/DomainAccordion'
import { domainIcon } from '@/ui/domainIcon'
import { FlowerMark } from '@/ui/FlowerMark'
import { Icon, type IconName } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { LoadingText } from '@/ui/LoadingText'
import { TopBar } from '@/ui/TopBar'
import { useToast } from '@/ui/useToast'
import { YearSelect } from '@/ui/YearSelect'
import styles from './dossier.module.css'
import { AGE_BAND_LABELS } from './labels'
import { ValidationSheet } from './ValidationSheet'

const DRAFT_ERROR_MESSAGE =
  'Le brouillon n’a pas pu être enregistré. Vérifie l’espace de stockage.'

interface DomainGroup {
  id: string
  label: string
  icon: IconName
  validations: Validation[]
}

/** Date la plus récente d'abord, puis intitulé (ordre stable et lisible). */
function compareValidations(a: Validation, b: Validation): number {
  const byDate = b.date.localeCompare(a.date)
  if (byDate !== 0) return byDate
  return a.snapshot.objectiveLabel.localeCompare(b.snapshot.objectiveLabel, 'fr')
}

function ValidationRow({
  validation,
  section,
  onOpen,
}: {
  validation: Validation
  section: Section
  onOpen: (validation: Validation) => void
}) {
  const thumbUrl = usePhotoThumb(validation.photoId)
  const hasPhoto = validation.photoId !== undefined
  const showAgeBand = validation.snapshot.ageBand !== ageBandForSection(section)

  return (
    <li>
      <button
        type="button"
        className={styles.row}
        onClick={() => onOpen(validation)}
      >
        {thumbUrl === undefined ? (
          <span className={styles.thumbEmpty} aria-hidden="true">
            <Icon name={hasPhoto ? 'camera' : 'file'} size={18} />
          </span>
        ) : (
          <img
            className={styles.thumb}
            src={thumbUrl}
            alt={`Photo de la réussite : ${validation.snapshot.objectiveLabel}`}
          />
        )}

        <span className={styles.rowText}>
          <span className={styles.rowLabel}>{validation.snapshot.objectiveLabel}</span>
          <span className={styles.rowMeta}>
            <span className={styles.rowMetaItem}>
              {formatShortDate(validation.date)} · {section}
            </span>
            {showAgeBand ? (
              <span className={styles.ageTag}>
                {AGE_BAND_LABELS[validation.snapshot.ageBand]}
              </span>
            ) : null}
            {hasPhoto ? null : (
              <>
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.rowMetaItem}>Observation en classe</span>
                <span className={styles.rowMetaItem}>sans photo</span>
              </>
            )}
          </span>
        </span>

        <span className={styles.rowCheck} aria-hidden="true">
          <Icon name="check" size={13} />
        </span>
      </button>
    </li>
  )
}

/**
 * Dossier d'un élève : réussites de l'année sélectionnée, réparties dans les
 * six domaines officiels et le programme EVAR. Changer d'année ne filtre que
 * l'affichage ; toutes les lignes restent en base.
 */
export function DossierScreen() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const students = useStudents()
  const validations = useValidationsForStudent(studentId)
  const schoolYears = useSchoolYears()
  const years = schoolYears ?? []
  const settings = useSettings()
  const [yearChoice, setYearChoice] = useState<string>()
  const [openDomain, setOpenDomain] = useState<string | null>(null)
  const [draftBusy, setDraftBusy] = useState(false)
  const [selectedValidationId, setSelectedValidationId] = useState<string>()

  // Bouton de retour commun aux deux en-têtes (dossier absent et dossier ouvert).
  const backButton = (
    <IconButton label="Retour" onClick={() => navigate('/')}>
      <Icon name="back" size={18} />
    </IconButton>
  )

  // Le sélecteur attend la liste réelle : sans elle, sa valeur ne correspondrait
  // à aucune option alors que le contenu est déjà filtré sur l'année courante.
  const waitingForYears = schoolYears === undefined

  if (students === undefined || validations === undefined || waitingForYears) {
    return (
      <section className={styles.screen}>
        <LoadingText>Chargement du dossier…</LoadingText>
      </section>
    )
  }

  const student = students.find((candidate) => candidate.id === studentId)

  if (student === undefined) {
    return (
      <section className={styles.screen}>
        <TopBar
          left={backButton}
          title="Élève introuvable"
        />
        <p className={styles.emptyText}>
          Ce dossier n’existe plus ou n’a pas pu être chargé.
        </p>
        <Link to="/" className={styles.classLink}>
          Retour à la classe
        </Link>
      </section>
    )
  }

  // L'année par défaut suit la date du jour, pas seulement les réglages : une
  // réussite tout juste validée est classée par sa date (`schoolYearIdForDate`)
  // et doit apparaître immédiatement, même si le passage d'année est décalé.
  const currentYearId = resolveCurrentSchoolYearId(
    years,
    settings?.currentSchoolYearId,
    todayIso(),
  )
  // Une année courante absente de la liste reste sélectionnable : le select ne
  // doit jamais basculer silencieusement sur une autre valeur.
  const yearIds = sortedSchoolYearIds(years, currentYearId)

  const requestedYear = yearChoice ?? currentYearId ?? yearIds[0] ?? 'all'
  const selectedYear =
    requestedYear === 'all' || yearIds.includes(requestedYear)
      ? requestedYear
      : (yearIds[0] ?? 'all')
  const isCurrentYear = currentYearId !== undefined && selectedYear === currentYearId
  const yearSuffix =
    selectedYear === 'all'
      ? 'toutes les années'
      : isCurrentYear
        ? 'cette année'
        : `en ${selectedYear}`
  const summaryMini =
    selectedYear === 'all'
      ? 'toutes les années'
      : isCurrentYear
        ? 'depuis septembre'
        : `en ${selectedYear}`

  const visibleValidations = validations.filter(
    (validation) => selectedYear === 'all' || validation.schoolYearId === selectedYear,
  )

  const domains = [...referential.domains].sort((a, b) => a.order - b.order)
  const groups: DomainGroup[] = domains.map((domain) => ({
    id: domain.id,
    label: domain.label,
    icon: domainIcon(domain.id),
    validations: visibleValidations
      .filter((validation) => validation.snapshot.domainId === domain.id)
      .sort(compareValidations),
  }))

  // Un domaine retiré du référentiel ne doit jamais faire disparaître une
  // réussite : on l'affiche à part, avec le libellé figé de son instantané.
  const knownDomainIds = new Set(domains.map((domain) => domain.id))
  const orphanValidations = visibleValidations
    .filter((validation) => !knownDomainIds.has(validation.snapshot.domainId))
    .sort(compareValidations)
  if (orphanValidations.length > 0) {
    groups.push({
      id: 'autres',
      label: orphanValidations[0]?.snapshot.domainLabel ?? 'Autres',
      icon: 'file',
      validations: orphanValidations,
    })
  }

  const total = visibleValidations.length
  const openDomainId =
    openDomain ?? groups.find((group) => group.validations.length > 0)?.id ?? 'langage'
  const bilanYear =
    selectedYear === 'all' ? (currentYearId ?? years[0]?.id ?? '') : selectedYear
  const bilanUrl = `/bilans/${student.id}?period=1&year=${encodeURIComponent(bilanYear)}`
  const selectedValidation =
    selectedValidationId === undefined
      ? undefined
      : validations.find((validation) => validation.id === selectedValidationId)
  // Copie rétrécie : TypeScript ne conserve pas le garde au fond d'une closure.
  const captureStudentId = student.id

  async function startCapture(target: 'photo' | 'objective'): Promise<void> {
    if (draftBusy) return

    setDraftBusy(true)
    try {
      // Nouvelle intention : le brouillon repart de zéro, sans l'ancienne photo.
      await saveCaptureDraft({
        id: 'current',
        studentId: captureStudentId,
        createdAt: new Date().toISOString(),
      })
      navigate(
        target === 'photo'
          ? `/capture/${captureStudentId}/photo`
          : '/capture/objective',
      )
    } catch (error) {
      console.error('Enregistrement du brouillon impossible.', error)
      showToast(DRAFT_ERROR_MESSAGE)
    } finally {
      setDraftBusy(false)
    }
  }

  return (
    <section className={styles.screen}>
      <TopBar
        left={backButton}
        title={student.firstName}
        right={
          <Link to={bilanUrl} className={styles.bilanLink}>
            <Icon name="file" size={14} />
            Bilan
          </Link>
        }
      />

      <p className={styles.subtitle}>
        {`${student.section} · ${successLabel(total)} ${yearSuffix}`}
      </p>

      <YearSelect
        id="dossier-year"
        yearIds={yearIds}
        value={selectedYear}
        onChange={setYearChoice}
        includeAll
      />

      <div
        className={styles.summary}
        role="group"
        aria-label="Résumé du dossier"
      >
        <span className={styles.summaryFlower} aria-hidden="true">
          <FlowerMark size={34} />
        </span>
        <div className={styles.summaryMain}>
          <Avatar name={student.firstName} section={student.section} size="lg" />
          <div className={styles.summaryCount}>
            <span className={styles.summaryBig}>{successLabel(total)}</span>
            <span className={styles.summaryMini}>{summaryMini}</span>
          </div>
        </div>
        <div className={styles.stats}>
          {total === 0 ? (
            <span className={styles.stat}>Première réussite à venir</span>
          ) : (
            groups
              .filter((group) => group.validations.length > 0)
              .map((group) => (
                <span key={group.id} className={styles.stat}>
                  {group.label} {group.validations.length}
                </span>
              ))
          )}
        </div>
      </div>

      <DomainAccordionList>
        {groups.map((group) => {
          const open = openDomainId === group.id

          return (
            <DomainAccordion
              key={group.id}
              id={group.id}
              title={group.label}
              icon={group.icon}
              meta={successLabel(group.validations.length)}
              open={open}
              onToggle={() => setOpenDomain(open ? '' : group.id)}
              regionPrefix="dossier"
            >
              {group.validations.length === 0 ? (
                <DomainAccordionEmpty>
                  Aucune réussite dans ce domaine pour l’instant.
                </DomainAccordionEmpty>
              ) : (
                <DomainAccordionRows>
                  {group.validations.map((validation) => (
                    <ValidationRow
                      key={validation.id}
                      validation={validation}
                      section={student.section}
                      onOpen={(opened) => setSelectedValidationId(opened.id)}
                    />
                  ))}
                </DomainAccordionRows>
              )}
            </DomainAccordion>
          )
        })}
      </DomainAccordionList>

      <button
        type="button"
        className={styles.noPhotoLink}
        disabled={draftBusy}
        onClick={() => {
          void startCapture('objective')
        }}
      >
        <Icon name="plus" size={16} />
        Ajouter une réussite sans photo
      </button>

      <button
        type="button"
        className={styles.fab}
        aria-label="Prendre une photo"
        aria-busy={draftBusy || undefined}
        disabled={draftBusy}
        onClick={() => {
          void startCapture('photo')
        }}
      >
        <Icon name="camera" size={22} />
      </button>

      {selectedValidation === undefined ? null : (
        <ValidationSheet
          validation={selectedValidation}
          onClose={() => setSelectedValidationId(undefined)}
        />
      )}
    </section>
  )
}
