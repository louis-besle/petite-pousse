import { useState } from 'react'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useAllValidations, useValidationsForYear } from '@/db/validations'
import { ageBandForSection, referential, sectionForAgeBand } from '@/domain/referential'
import { schoolYearIdForDate } from '@/domain/schoolYear'
import type { AgeBand, Domain, Objective, Section, Student } from '@/domain/types'
import { todayIso } from '@/lib/date'
import { sortedSchoolYearIds } from '@/lib/schoolYearSelection'
import {
  normalizeSearch,
  objectiveCountLabel,
  studentCountLabel,
  validationCountLabel,
} from '@/lib/text'
import {
  DomainAccordion,
  DomainAccordionEmpty,
  DomainAccordionList,
  DomainAccordionRows,
} from '@/ui/DomainAccordion'
import { domainIcon } from '@/ui/domainIcon'
import { Icon } from '@/ui/icons'
import { LoadingText } from '@/ui/LoadingText'
import { SearchField } from '@/ui/SearchField'
import { SectionFilterChips } from '@/ui/SectionFilterChips'
import uiStyles from '@/ui/ui.module.css'
import { useToast } from '@/ui/useToast'
import { YearSelect } from '@/ui/YearSelect'
import { ObjectiveSheet } from './ObjectiveSheet'
import styles from './programme.module.css'

type LevelFilter = 'all' | Section

/** Niveaux d'un objectif : « PS · MS » dans l'ordre officiel des tranches. */
function levelLabels(objective: Objective): string {
  return objective.ageBands.map((band) => sectionForAgeBand(band)).join(' · ')
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
 * Programme officiel : les six domaines du programme 2026 et le programme EVAR,
 * objectif par objectif.
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
  // Le helper conserve l'année courante absente de la liste : le select ne doit
  // jamais basculer silencieusement sur une autre valeur.
  const yearIds = sortedSchoolYearIds(years, currentYearId)

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
        <LoadingText>Chargement du programme…</LoadingText>
      </section>
    )
  }

  const domains = [...referential.domains].sort((a, b) => a.order - b.order)
  const levelBand = level === 'all' ? undefined : ageBandForSection(level)
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
    icon: domainIcon(domain.id),
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

  /** La fiche reste ouverte : on peut valider plusieurs élèves d'affilée. */
  function handleValidated(student: Student): void {
    showToast(`Réussite ajoutée à ${student.firstName}.`)

    // `ensureSeed` ne fait jamais avancer `settings.currentSchoolYearId` : la
    // validation est classée dans l'année de sa date, pas dans celle des
    // réglages. On ne bascule donc que vers cette année-là, et seulement si le
    // sélecteur peut la proposer.
    const validationYearId = schoolYearIdForDate(todayIso())
    if (selectedYear === 'all' || selectedYear === validationYearId) return
    if (yearIds.includes(validationYearId)) {
      setYearChoice(validationYearId)
    }
  }

  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Programme</h1>
        <p className={styles.subtitle}>
          Les six domaines du programme 2026 et le programme EVAR, objectif par objectif
        </p>
      </header>

      <SearchField
        label="Rechercher un objectif"
        placeholder="Rechercher un objectif…"
        value={query}
        onChange={handleQueryChange}
      />

      <SectionFilterChips
        value={level}
        onChange={setLevel}
        ariaLabel="Filtrer par niveau"
        className={styles.levelRow}
      />

      <YearSelect
        id="programme-year"
        yearIds={yearIds}
        value={selectedYear}
        onChange={setYearChoice}
        includeAll
      />

      {totalVisibleObjectives === 0 ? (
        <p className={styles.emptyGlobal} role="status">
          Aucun objectif ne correspond.
        </p>
      ) : null}

      <DomainAccordionList>
        {groups.map((group) => {
          const open = openDomains.has(group.domain.id)

          return (
            <DomainAccordion
              key={group.domain.id}
              id={group.domain.id}
              title={group.domain.label}
              icon={group.icon}
              meta={`${objectiveCountLabel(group.objectives.length)} · ${validationCountLabel(group.validationCount)}`}
              open={open}
              onToggle={() => toggleDomain(group.domain.id)}
              regionPrefix="programme"
            >
              {group.objectives.length === 0 ? (
                <DomainAccordionEmpty>
                  Aucun objectif ne correspond à ces filtres.
                </DomainAccordionEmpty>
              ) : (
                <DomainAccordionRows>
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
                          onClick={() => setSelectedObjectiveId(objective.id)}
                        >
                          <span className={uiStyles.srOnly}>Ouvrir l’objectif : </span>
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
                              aria-label={`${objective.label} : ${studentCountLabel(numerator)} sur ${denominator}`}
                            >
                              <span
                                className={styles.barFill}
                                style={{ width: `${percent}%` }}
                                aria-hidden="true"
                              />
                            </span>
                            <span className={styles.count}>
                              {studentCountLabel(numerator)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </DomainAccordionRows>
              )}
            </DomainAccordion>
          )
        })}
      </DomainAccordionList>

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
