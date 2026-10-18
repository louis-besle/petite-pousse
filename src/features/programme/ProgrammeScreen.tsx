import { useState } from 'react'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useAllValidations, useValidationsForYear } from '@/db/validations'
import { referential } from '@/domain/referential'
import { schoolYearIdForDate } from '@/domain/schoolYear'
import type {
  AgeBand,
  Domain,
  Objective,
  Section,
  Student,
} from '@/domain/types'
import { todayIso } from '@/lib/date'
import { Chip } from '@/ui/Chip'
import { Field } from '@/ui/Field'
import { Icon, type IconName } from '@/ui/icons'
import { useToast } from '@/ui/useToast'
import { ObjectiveSheet } from './ObjectiveSheet'
import styles from './programme.module.css'

type LevelFilter = 'all' | Section

const LEVEL_FILTERS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'PS', label: 'PS' },
  { value: 'MS', label: 'MS' },
  { value: 'GS', label: 'GS' },
]

const AGE_BAND_BY_SECTION: Record<Section, AgeBand> = {
  PS: 'before4',
  MS: 'from4',
  GS: 'from5',
}

const SECTION_BY_AGE_BAND: Record<AgeBand, Section> = {
  before4: 'PS',
  from4: 'MS',
  from5: 'GS',
}

const DOMAIN_ICONS: Record<Domain['id'], IconName> = {
  langage: 'book',
  maths: 'shapes',
  corps: 'ball',
  arts: 'palette',
  temps: 'clock',
  vivant: 'leaf',
}

/** Recherche insensible à la casse et aux accents (« memoriser » trouve « mémoriser »). */
function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** « 1 élève », « 2 élèves ». */
function pupilLabel(count: number): string {
  return `${count} élève${count > 1 ? 's' : ''}`
}

/** « 1 objectif », « 2 objectifs ». */
function objectiveLabel(count: number): string {
  return `${count} objectif${count > 1 ? 's' : ''}`
}

/** « 1 validation », « 2 validations ». */
function validationLabel(count: number): string {
  return `${count} validation${count > 1 ? 's' : ''}`
}

/** Niveaux d'un objectif : « PS · MS » dans l'ordre officiel des tranches. */
function levelLabels(objective: Objective): string {
  return objective.ageBands.map((band) => SECTION_BY_AGE_BAND[band]).join(' · ')
}

/** Un objectif correspond-il au niveau sélectionné et à la recherche ? */
function matchesFilters(
  objective: Objective,
  domain: Domain,
  levelBand: AgeBand | undefined,
  normalizedQuery: string,
): boolean {
  if (levelBand !== undefined && !objective.ageBands.includes(levelBand)) {
    return false
  }
  if (normalizedQuery === '') return true

  return (
    normalizeSearch(objective.label).includes(normalizedQuery) ||
    normalizeSearch(domain.label).includes(normalizedQuery) ||
    normalizeSearch(domain.longLabel).includes(normalizedQuery)
  )
}

/**
 * Programme officiel : les six domaines, objectif par objectif.
 *
 * Chaque domaine est un accordéon qui compte les objectifs correspondant aux
 * filtres et les validations de la classe pour l'année sélectionnée. La barre
 * d'avancement d'un objectif se rapporte à l'effectif de la classe, ou à celui
 * du niveau filtré.
 */
export function ProgrammeScreen() {
  const settings = useSettings()
  const schoolYears = useSchoolYears()
  const students = useStudents()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')
  const [yearChoice, setYearChoice] = useState<string>()
  const [openDomains, setOpenDomains] = useState<ReadonlySet<string>>(
    () => new Set(['langage']),
  )
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>()

  const currentYearId = settings?.currentSchoolYearId
  const years = schoolYears ?? []
  const yearIds = years.map((year) => year.id)
  // Une année courante absente de la liste reste sélectionnable : le select ne
  // doit jamais basculer silencieusement sur une autre valeur.
  if (currentYearId !== undefined && !yearIds.includes(currentYearId)) {
    yearIds.push(currentYearId)
  }
  yearIds.sort((a, b) => b.localeCompare(a))

  const requestedYear = yearChoice ?? currentYearId ?? yearIds[0] ?? 'all'
  const selectedYear =
    requestedYear === 'all' || yearIds.includes(requestedYear)
      ? requestedYear
      : (yearIds[0] ?? 'all')

  // Les deux requêtes vivantes sont montées en permanence : changer de mode
  // d'année ne remonte pas de hook et les compteurs restent synchronisés.
  const yearValidations = useValidationsForYear(selectedYear === 'all' ? '' : selectedYear)
  const allValidations = useAllValidations()
  const activeValidations = selectedYear === 'all' ? allValidations : yearValidations

  if (
    settings === undefined ||
    schoolYears === undefined ||
    students === undefined ||
    activeValidations === undefined ||
    allValidations === undefined
  ) {
    return (
      <section className={styles.screen}>
        <p className={styles.loading} role="status">
          Chargement du programme…
        </p>
      </section>
    )
  }

  const domains = [...referential.domains].sort((a, b) => a.order - b.order)
  const levelBand = level === 'all' ? undefined : AGE_BAND_BY_SECTION[level]
  const normalizedQuery = normalizeSearch(query)

  const sectionStudents =
    level === 'all' ? students : students.filter((student) => student.section === level)
  const denominator = sectionStudents.length
  const sectionStudentIds = new Set(sectionStudents.map((student) => student.id))

  // Nombre d'élèves distincts par objectif, pour l'année sélectionnée. Quand un
  // niveau est filtré, seuls les élèves de cette section comptent : la barre ne
  // peut donc jamais dépasser 100 %.
  const validatedPupils = new Map<string, Set<string>>()
  const domainValidationCounts = new Map<string, number>()

  for (const validation of activeValidations) {
    domainValidationCounts.set(
      validation.snapshot.domainId,
      (domainValidationCounts.get(validation.snapshot.domainId) ?? 0) + 1,
    )

    if (!sectionStudentIds.has(validation.studentId)) continue

    const pupils = validatedPupils.get(validation.objectiveId)
    if (pupils === undefined) {
      validatedPupils.set(validation.objectiveId, new Set([validation.studentId]))
    } else {
      pupils.add(validation.studentId)
    }
  }

  const groups = domains.map((domain) => ({
    domain,
    icon: DOMAIN_ICONS[domain.id],
    objectives: referential.objectives.filter(
      (objective) =>
        objective.domainId === domain.id &&
        matchesFilters(objective, domain, levelBand, normalizedQuery),
    ),
    validationCount: domainValidationCounts.get(domain.id) ?? 0,
  }))

  const totalVisibleObjectives = groups.reduce(
    (total, group) => total + group.objectives.length,
    0,
  )
  const selectedObjective =
    selectedObjectiveId === undefined
      ? undefined
      : referential.objectives.find((objective) => objective.id === selectedObjectiveId)

  function toggleDomain(domainId: string): void {
    setOpenDomains((previous) => {
      const next = new Set(previous)
      if (next.has(domainId)) {
        next.delete(domainId)
      } else {
        next.add(domainId)
      }
      return next
    })
  }

  /** Une recherche ouvre les domaines qui contiennent des résultats. */
  function handleQueryChange(value: string): void {
    setQuery(value)
    const normalized = normalizeSearch(value)
    if (normalized === '') return

    setOpenDomains((previous) => {
      const next = new Set(previous)
      for (const domain of domains) {
        const hasMatch = referential.objectives.some(
          (objective) =>
            objective.domainId === domain.id &&
            matchesFilters(objective, domain, levelBand, normalized),
        )
        if (hasMatch) next.add(domain.id)
      }
      return next
    })
  }

  /** La fiche est fermée par la validation rapide ; le compteur doit suivre. */
  function handleValidated(student: Student): void {
    setSelectedObjectiveId(undefined)
    showToast(`Réussite ajoutée à ${student.firstName}.`)

    if (selectedYear !== currentYearId) {
      setYearChoice(schoolYearIdForDate(todayIso()))
    }
  }

  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Programme</h1>
        <p className={styles.subtitle}>
          Les six domaines du programme 2026, objectif par objectif
        </p>
      </header>

      <Field
        type="search"
        label="Rechercher un objectif"
        icon={<Icon name="search" size={17} />}
        placeholder="Rechercher un objectif…"
        value={query}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => handleQueryChange(event.target.value)}
      />

      <div className={styles.levelRow} role="group" aria-label="Filtrer par niveau">
        {LEVEL_FILTERS.map((item) => (
          <Chip
            key={item.value}
            active={level === item.value}
            onClick={() => setLevel(item.value)}
          >
            {item.label}
          </Chip>
        ))}
      </div>

      <div className={styles.yearRow}>
        <label htmlFor="programme-year" className={styles.yearLabel}>
          Année scolaire
        </label>
        <select
          id="programme-year"
          className={styles.yearSelect}
          value={selectedYear}
          onChange={(event) => setYearChoice(event.target.value)}
        >
          {yearIds.map((yearId) => (
            <option key={yearId} value={yearId}>
              {yearId}
            </option>
          ))}
          <option value="all">Toutes les années</option>
        </select>
      </div>

      {totalVisibleObjectives === 0 ? (
        <p className={styles.emptyGlobal} role="status">
          Aucun objectif ne correspond.
        </p>
      ) : null}

      <div className={styles.domains}>
        {groups.map((group) => {
          const open = openDomains.has(group.domain.id)
          const regionId = `programme-domain-${group.domain.id}`

          return (
            <section
              key={group.domain.id}
              className={styles.domainBlock}
              data-domain={group.domain.id}
            >
              <h2 className={styles.domainHeading}>
                <button
                  type="button"
                  className={styles.domainHead}
                  aria-expanded={open}
                  aria-controls={open ? regionId : undefined}
                  onClick={() => toggleDomain(group.domain.id)}
                >
                  <span
                    className={styles.domainIcon}
                    data-domain={group.domain.id}
                    aria-hidden="true"
                  >
                    <Icon name={group.icon} size={17} />
                  </span>
                  <span className={styles.domainText}>
                    <span className={styles.domainTitle}>{group.domain.label}</span>
                    <span className={styles.domainCount}>
                      {objectiveLabel(group.objectives.length)} ·{' '}
                      {validationLabel(group.validationCount)}
                    </span>
                  </span>
                  <span className={styles.chevron} data-open={open} aria-hidden="true">
                    <Icon name="chevron" size={16} />
                  </span>
                </button>
              </h2>

              {open ? (
                <div
                  id={regionId}
                  className={styles.domainBody}
                  role="region"
                  aria-label={group.domain.label}
                >
                  {group.objectives.length === 0 ? (
                    <p className={styles.domainEmpty}>
                      Aucun objectif ne correspond à ces filtres.
                    </p>
                  ) : (
                    <ul className={styles.rows}>
                      {group.objectives.map((objective) => {
                        const numerator = validatedPupils.get(objective.id)?.size ?? 0
                        const percent =
                          denominator === 0
                            ? 0
                            : Math.round((numerator / denominator) * 100)

                        return (
                          <li
                            key={objective.id}
                            className={styles.rowItem}
                            data-domain={group.domain.id}
                          >
                            <button
                              type="button"
                              className={styles.rowAction}
                              aria-label={`Ouvrir l’objectif : ${objective.label}`}
                              onClick={() => setSelectedObjectiveId(objective.id)}
                            />
                            <span className={styles.rowTop}>
                              <span className={styles.rowLabel}>{objective.label}</span>
                              <span className={styles.rowChevron} aria-hidden="true">
                                <Icon name="chevron" size={14} />
                              </span>
                            </span>
                            <span className={styles.rowMeta}>
                              <span className={styles.levelTag}>
                                {levelLabels(objective)}
                              </span>
                              <span
                                className={styles.bar}
                                role="progressbar"
                                aria-valuenow={numerator}
                                aria-valuemin={0}
                                aria-valuemax={denominator}
                                aria-label={`${objective.label} : ${pupilLabel(numerator)} sur ${denominator}`}
                              >
                                <span
                                  className={styles.barFill}
                                  style={{ width: `${percent}%` }}
                                  aria-hidden="true"
                                />
                              </span>
                              <span className={styles.count}>{pupilLabel(numerator)}</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      {selectedObjective === undefined ? null : (
        <ObjectiveSheet
          objective={selectedObjective}
          students={students}
          allValidations={allValidations}
          onClose={() => setSelectedObjectiveId(undefined)}
          onValidated={handleValidated}
        />
      )}
    </section>
  )
}
