import type { CustomObjective, Objective } from './types'

export const CUSTOM_OBJECTIVE_SOURCE = {
  bo: 'Objectif ajouté par l’enseignant',
} as const

export function isCustomObjective(objective: Pick<Objective, 'id'>): boolean {
  return objective.id.startsWith('custom-')
}

export function mergeObjectives(
  official: Objective[],
  custom: CustomObjective[],
): Objective[] {
  const sortedCustom = [...custom].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  return [...official, ...sortedCustom]
}
