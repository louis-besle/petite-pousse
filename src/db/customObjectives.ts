import { useLiveQuery } from 'dexie-react-hooks'
import { CUSTOM_OBJECTIVE_SOURCE, mergeObjectives } from '@/domain/objectives'
import { AGE_BANDS, referential, sectionForAgeBand } from '@/domain/referential'
import type { AgeBand, CustomObjective, Domain, Objective } from '@/domain/types'
import { normalizeSearch } from '@/lib/text'
import { db } from './db'

export const MAX_OBJECTIVE_LABEL_LENGTH = 160
export const MAX_OBJECTIVE_EXAMPLE_LENGTH = 200

export class DuplicateObjectiveError extends Error {
  constructor(message = 'Un objectif porte déjà cet intitulé dans ce domaine.') {
    super(message)
    this.name = 'DuplicateObjectiveError'
  }
}

export interface CustomObjectiveInput {
  label: string
  domainId: Domain['id']
  ageBands: AgeBand[]
  examples: Partial<Record<AgeBand, string>>
}

const OBJECTIVE_NOT_FOUND_ERROR = 'Objectif introuvable.'

/** Clé de comparaison d’un intitulé : casse, accents, apostrophes et espaces répétés ignorés. */
function duplicateKey(value: string): string {
  return normalizeSearch(value)
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
}

/** Déduplique les tranches d’âge et les remet dans l’ordre officiel. */
function normalizeAgeBands(ageBands: AgeBand[]): AgeBand[] {
  const bands = new Set(ageBands)
  return AGE_BANDS.filter((band) => bands.has(band))
}

/**
 * Applique les règles métier sur une saisie : intitulé, tranches d’âge puis
 * exemples. Renvoie les valeurs nettoyées, prêtes à être enregistrées.
 */
function cleanInput(input: CustomObjectiveInput): {
  label: string
  domainId: Domain['id']
  ageBands: AgeBand[]
  examples: Partial<Record<AgeBand, string>>
} {
  const label = input.label.trim()
  if (label === '') {
    throw new Error('L’intitulé est obligatoire.')
  }
  if (label.length > MAX_OBJECTIVE_LABEL_LENGTH) {
    throw new Error(
      `L’intitulé ne peut pas dépasser ${MAX_OBJECTIVE_LABEL_LENGTH} caractères.`,
    )
  }

  const ageBands = normalizeAgeBands(input.ageBands)
  if (ageBands.length === 0) {
    throw new Error('Choisis au moins un niveau.')
  }

  const examples: Partial<Record<AgeBand, string>> = {}
  for (const band of ageBands) {
    const example = (input.examples[band] ?? '').trim()
    if (example === '') {
      throw new Error(`L’exemple en ${sectionForAgeBand(band)} est obligatoire.`)
    }
    if (example.length > MAX_OBJECTIVE_EXAMPLE_LENGTH) {
      throw new Error(
        `L’exemple en ${sectionForAgeBand(band)} ne peut pas dépasser ${MAX_OBJECTIVE_EXAMPLE_LENGTH} caractères.`,
      )
    }
    examples[band] = example
  }

  return { label, domainId: input.domainId, ageBands, examples }
}

/**
 * Refuse un intitulé déjà porté dans le même domaine, qu’il soit officiel ou
 * personnalisé. L’identifiant en cours d’édition est ignoré pour permettre de
 * conserver son propre intitulé.
 */
async function ensureNoDuplicate(
  label: string,
  domainId: Domain['id'],
  excludeId?: string,
): Promise<void> {
  const key = duplicateKey(label)

  const officialDuplicate = referential.objectives.some(
    (objective) =>
      objective.domainId === domainId && duplicateKey(objective.label) === key,
  )
  if (officialDuplicate) {
    throw new DuplicateObjectiveError()
  }

  const custom = await db.customObjectives.where('domainId').equals(domainId).toArray()
  const customDuplicate = custom.some(
    (objective) => objective.id !== excludeId && duplicateKey(objective.label) === key,
  )
  if (customDuplicate) {
    throw new DuplicateObjectiveError()
  }
}

/** Crée un objectif personnalisé et renvoie la ligne réellement enregistrée. */
export async function createCustomObjective(
  input: CustomObjectiveInput,
): Promise<CustomObjective> {
  const cleaned = cleanInput(input)

  return db.transaction('rw', db.customObjectives, async () => {
    // Contrôle et insertion dans la même transaction : deux onglets ne peuvent
    // pas enregistrer le même intitulé en même temps.
    await ensureNoDuplicate(cleaned.label, cleaned.domainId)

    const now = new Date().toISOString()
    const record: CustomObjective = {
      id: `custom-${crypto.randomUUID()}`,
      competencyId: 'custom',
      domainId: cleaned.domainId,
      label: cleaned.label,
      ageBands: cleaned.ageBands,
      examples: cleaned.examples,
      source: CUSTOM_OBJECTIVE_SOURCE,
      createdAt: now,
      updatedAt: now,
    }

    await db.customObjectives.add(record)
    return record
  })
}

/**
 * Modifie un objectif personnalisé existant. L’identifiant et la date de
 * création sont conservés, la date de modification est réécrite.
 */
export async function updateCustomObjective(
  id: string,
  input: CustomObjectiveInput,
): Promise<void> {
  await db.transaction('rw', db.customObjectives, async () => {
    const existing = await db.customObjectives.get(id)
    if (!existing) {
      throw new Error(OBJECTIVE_NOT_FOUND_ERROR)
    }

    const cleaned = cleanInput(input)
    await ensureNoDuplicate(cleaned.label, cleaned.domainId, id)

    await db.customObjectives.put({
      ...existing,
      ...cleaned,
      updatedAt: new Date().toISOString(),
    })
  })
}

/** Supprime un objectif personnalisé ; les validations ne sont jamais touchées. */
export async function deleteCustomObjective(id: string): Promise<void> {
  await db.transaction('rw', db.customObjectives, async () => {
    await db.customObjectives.delete(id)
  })
}

/** Objectifs personnalisés, triés par date de création puis par identifiant. */
export function useCustomObjectives(): CustomObjective[] | undefined {
  return useLiveQuery(
    async () => (await db.customObjectives.toArray()).sort((a, b) =>
      a.createdAt !== b.createdAt
        ? a.createdAt.localeCompare(b.createdAt)
        : a.id.localeCompare(b.id),
    ),
    [],
  )
}

/** Catalogue complet : les objectifs officiels puis les personnalisés. */
export function useObjectiveCatalog(): Objective[] | undefined {
  const custom = useCustomObjectives()
  return custom === undefined
    ? undefined
    : mergeObjectives(referential.objectives, custom)
}
