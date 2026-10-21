import { periodRange } from './schoolYear'
import type { Referential } from './referential'
import type {
  AgeBand,
  Domain,
  Photo,
  SchoolYear,
  Student,
  Validation,
} from './types'

export interface BilanEntry {
  validationId: string
  objectiveLabel: string
  domainId: Domain['id']
  domainLabel: string
  date: string
  photo?: Photo
  ageBand: AgeBand
  example?: string
}

export interface BilanModel {
  student: Student
  year: SchoolYear
  period: 1 | 2
  start: string
  end: string
  total: number
  domains: Array<{ domain: Domain; entries: BilanEntry[] }>
}

/**
 * Un domaine retiré du référentiel garde sa place, après les six domaines
 * officiels et l’EVAR, grâce au libellé figé dans l'instantané de la validation.
 */
const FALLBACK_DOMAIN_ORDER = 99

interface DomainGroup {
  domain: Domain
  entries: BilanEntry[]
}

/** Date croissante, puis intitulé : ordre stable et lisible sur la feuille A4. */
function compareEntries(a: BilanEntry, b: BilanEntry): number {
  const byDate = a.date.localeCompare(b.date)
  if (byDate !== 0) return byDate
  return a.objectiveLabel.localeCompare(b.objectiveLabel, 'fr')
}

function toEntry(validation: Validation, photos: Map<string, Photo>): BilanEntry {
  const photo =
    validation.photoId === undefined ? undefined : photos.get(validation.photoId)

  const entry: BilanEntry = {
    validationId: validation.id,
    objectiveLabel: validation.snapshot.objectiveLabel,
    domainId: validation.snapshot.domainId,
    domainLabel: validation.snapshot.domainLabel,
    date: validation.date,
    ageBand: validation.snapshot.ageBand,
  }

  if (photo !== undefined) entry.photo = photo
  if (validation.snapshot.example !== undefined) entry.example = validation.snapshot.example

  return entry
}

function domainFor(validation: Validation, referential: Referential): Domain {
  const live = referential.domains.find(
    (domain) => domain.id === validation.snapshot.domainId,
  )
  if (live !== undefined) return live

  return {
    id: validation.snapshot.domainId,
    label: validation.snapshot.domainLabel,
    longLabel: validation.snapshot.domainLabel,
    order: FALLBACK_DOMAIN_ORDER,
  }
}

/**
 * Modèle du bilan d'un élève pour une période : validations de l'élève dont la
 * date tombe dans les bornes incluses de la période, regroupées par domaine
 * officiel. Les domaines sans réussite ne produisent aucune entrée.
 *
 * `validations` peut contenir toute l'année (ou toute la classe) : le modèle
 * ne retient que celles de `student`.
 */
export function buildBilanModel(input: {
  student: Student
  year: SchoolYear
  period: 1 | 2
  validations: Validation[]
  photos: Map<string, Photo>
  referential: Referential
}): BilanModel {
  const { student, year, period, validations, photos, referential } = input
  const { start, end } = periodRange(year, period)
  const groups = new Map<Domain['id'], DomainGroup>()

  for (const validation of validations) {
    if (validation.studentId !== student.id) continue
    if (validation.date < start || validation.date > end) continue

    const domainId = validation.snapshot.domainId
    let group = groups.get(domainId)
    if (group === undefined) {
      group = { domain: domainFor(validation, referential), entries: [] }
      groups.set(domainId, group)
    }

    group.entries.push(toEntry(validation, photos))
  }

  const domains = [...groups.values()]
    .map((group) => ({
      domain: group.domain,
      entries: [...group.entries].sort(compareEntries),
    }))
    .sort((a, b) => a.domain.order - b.domain.order)

  return {
    student,
    year,
    period,
    start,
    end,
    total: domains.reduce((total, group) => total + group.entries.length, 0),
    domains,
  }
}

/** Nombre de validations dont la date tombe dans les bornes incluses du bilan. */
export function countValidationsInPeriod(
  validations: Validation[],
  year: SchoolYear,
  period: 1 | 2,
): number {
  const { start, end } = periodRange(year, period)
  return validations.filter((validation) => validation.date >= start && validation.date <= end)
    .length
}

/**
 * Nombre de validations qui changent de bilan quand la date de changement passe
 * de `oldDate` à `newDate` : l'appartenance au bilan 1 est lue par
 * `date <= dateDeChangement`. Juillet (après les deux dates) et les dates
 * antérieures aux deux bornes ne bougent donc jamais.
 */
export function countValidationsMovedByCutover(
  validations: Validation[],
  oldDate: string,
  newDate: string,
): number {
  return validations.filter(
    (validation) => (validation.date <= oldDate) !== (validation.date <= newDate),
  ).length
}
