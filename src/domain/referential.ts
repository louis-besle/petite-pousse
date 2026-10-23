import { z } from 'zod'
import rawReferential from '../data/referential.json'
import type { AgeBand, Competency, Domain, Objective, Section } from './types'

export const REFERENTIAL_VERSION = '2026.0.0'

export const DOMAIN_IDS = ['langage', 'corps', 'arts', 'maths', 'temps', 'vivant'] as const
export const AGE_BANDS = ['before4', 'from4', 'from5'] as const

/**
 * Catalogue officiel des six domaines du programme 2026.
 * Les intitulés longs sont ceux du BO, les libellés courts servent la navigation.
 */
export const DOMAINS: Domain[] = [
  {
    id: 'langage',
    label: 'Langage',
    longLabel: 'Le développement et la structuration du langage oral et écrit',
    order: 1,
  },
  {
    id: 'corps',
    label: 'Corps',
    longLabel: "Agir, s'exprimer, comprendre à travers les activités physiques",
    order: 2,
  },
  {
    id: 'arts',
    label: 'Arts',
    longLabel: "Agir, s'exprimer, comprendre à travers les activités artistiques",
    order: 3,
  },
  {
    id: 'maths',
    label: 'Maths',
    longLabel: "L'acquisition des premiers outils mathématiques",
    order: 4,
  },
  {
    id: 'temps',
    label: 'Temps',
    longLabel: "Se repérer dans le temps et l'espace",
    order: 5,
  },
  {
    id: 'vivant',
    label: 'Vivant',
    longLabel: 'Découvrir le monde du vivant, de la matière et des objets',
    order: 6,
  },
]

export interface Referential {
  version: string
  domains: Domain[]
  competencies: Competency[]
  objectives: Objective[]
}

const domainIdSchema = z.enum(DOMAIN_IDS)
const ageBandSchema = z.enum(AGE_BANDS)

const domainSchema = z.object({
  id: domainIdSchema,
  label: z.string().min(1),
  longLabel: z.string().min(1),
  order: z.number().int().nonnegative(),
})

const competencySchema = z.object({
  id: z.string().min(1),
  domainId: domainIdSchema,
  label: z.string().min(1),
})

const objectiveSchema = z.object({
  id: z.string().min(1),
  competencyId: z.string().min(1),
  domainId: domainIdSchema,
  label: z.string().min(1),
  ageBands: z.array(ageBandSchema).min(1),
  examples: z.partialRecord(ageBandSchema, z.string().min(1)),
  source: z.object({
    bo: z.string().min(1),
    page: z.number().int().positive().optional(),
    table: z.string().min(1).optional(),
  }),
})

const referentialBaseSchema = z.object({
  version: z.string().min(1),
  domains: z.array(domainSchema).min(1),
  competencies: z.array(competencySchema),
  objectives: z.array(objectiveSchema),
})

type ReferentialInput = z.infer<typeof referentialBaseSchema>

/**
 * Contrôles d'intégrité qui ne peuvent pas s'exprimer dans un schéma Zod simple :
 * unicité des identifiants, cohérence des liens et exemples présents pour
 * chaque tranche d'âge déclarée.
 */
function checkIntegrity(referential: ReferentialInput, ctx: z.RefinementCtx) {
  const domainIds = new Set<string>()

  referential.domains.forEach((domain, index) => {
    if (domainIds.has(domain.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate domain id "${domain.id}"`,
        path: ['domains', index, 'id'],
      })
    }
    domainIds.add(domain.id)
  })

  for (const domainId of DOMAIN_IDS) {
    if (!domainIds.has(domainId)) {
      ctx.addIssue({
        code: 'custom',
        message: `Missing official domain "${domainId}"`,
        path: ['domains'],
      })
    }
  }

  const competenciesById = new Map<string, ReferentialInput['competencies'][number]>()

  referential.competencies.forEach((competency, index) => {
    if (competenciesById.has(competency.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate competency id "${competency.id}"`,
        path: ['competencies', index, 'id'],
      })
      return
    }
    competenciesById.set(competency.id, competency)
  })

  const objectiveIds = new Set<string>()

  referential.objectives.forEach((objective, index) => {
    if (objectiveIds.has(objective.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate objective id "${objective.id}"`,
        path: ['objectives', index, 'id'],
      })
    }
    objectiveIds.add(objective.id)

    if (!domainIds.has(objective.domainId)) {
      ctx.addIssue({
        code: 'custom',
        message: `Objective "${objective.id}" references unknown domain id "${objective.domainId}"`,
        path: ['objectives', index, 'domainId'],
      })
    }

    const competency = competenciesById.get(objective.competencyId)
    if (!competency) {
      ctx.addIssue({
        code: 'custom',
        message: `Objective "${objective.id}" references unknown competency id "${objective.competencyId}"`,
        path: ['objectives', index, 'competencyId'],
      })
    } else if (competency.domainId !== objective.domainId) {
      ctx.addIssue({
        code: 'custom',
        message: `Objective "${objective.id}" is linked to competency "${competency.id}" of domain "${competency.domainId}" instead of "${objective.domainId}"`,
        path: ['objectives', index, 'domainId'],
      })
    }

    for (const ageBand of objective.ageBands) {
      if (!objective.examples[ageBand]) {
        ctx.addIssue({
          code: 'custom',
          message: `Objective "${objective.id}" is missing an example for declared age band "${ageBand}"`,
          path: ['objectives', index, 'examples', ageBand],
        })
      }
    }
  })
}

const referentialSchema = referentialBaseSchema.superRefine(checkIntegrity)

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
      return `- ${path}: ${issue.message}`
    })
    .join('\n')
}

/**
 * Valide un référentiel brut (JSON importé ou issu du builder CSV).
 * Un référentiel sans objectif est valide : les comptes sont vérifiés par
 * `scripts/referential/check.ts`, pas par le schéma.
 */
export function validateReferential(input: unknown): Referential {
  const result = referentialSchema.safeParse(input)

  if (!result.success) {
    throw new Error(`Invalid referential:\n${formatIssues(result.error)}`)
  }

  return result.data
}

/** Référentiel embarqué dans l'application, validé au chargement du module. */
export const referential: Referential = validateReferential(rawReferential)

export function domainById(ref: Referential, id: Domain['id']): Domain {
  const domain = ref.domains.find((candidate) => candidate.id === id)

  if (!domain) {
    throw new Error(`Unknown domain id "${id}". Referential domains: ${ref.domains
      .map((candidate) => candidate.id)
      .join(', ')}`)
  }

  return domain
}

const AGE_BAND_BY_SECTION: Record<Section, AgeBand> = {
  PS: 'before4',
  MS: 'from4',
  GS: 'from5',
}

export function ageBandForSection(section: Section): AgeBand {
  return AGE_BAND_BY_SECTION[section]
}

export function objectivesForSection(ref: Referential, section: Section): Objective[] {
  const ageBand = ageBandForSection(section)
  return ref.objectives.filter((objective) => objective.ageBands.includes(ageBand))
}
