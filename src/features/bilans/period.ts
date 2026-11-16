/** Période lue dans l'URL : seules les valeurs 1 et 2 sont acceptées. */
export function parsePeriodParam(value: string | null): 1 | 2 | undefined {
  if (value === '1') return 1
  if (value === '2') return 2
  return undefined
}
