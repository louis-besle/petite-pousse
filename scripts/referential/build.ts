import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'csv-parse/sync'
import {
  AGE_BANDS,
  DOMAIN_IDS,
  DOMAINS,
  REFERENTIAL_VERSION,
  validateReferential,
} from '../../src/domain/referential'
import type { AgeBand, Competency, Domain, Objective, Referential } from '../../src/domain/types'

export const CSV_COLUMNS = [
  'objective_id',
  'domain_id',
  'competency_id',
  'competency_label',
  'objective_label',
  'age_bands',
  'example_before4',
  'example_from4',
  'example_from5',
  'source_bo',
  'source_page',
] as const

type CsvColumn = (typeof CSV_COLUMNS)[number]
type CsvRow = Record<CsvColumn, string>

function parseCsv(csv: string): CsvRow[] {
  const records: CsvRow[] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    columns: (header: string[]) => {
      const missing = CSV_COLUMNS.filter((column) => !header.includes(column))

      if (missing.length > 0) {
        throw new Error(`Missing CSV column(s): ${missing.join(', ')}`)
      }

      return header
    },
  })

  return records
}

function requireCell(row: CsvRow, column: CsvColumn, line: number): string {
  const value = (row[column] ?? '').trim()

  if (value === '') {
    throw new Error(`Line ${line}: column "${column}" is required`)
  }

  return value
}

function parseAgeBands(row: CsvRow, objectiveId: string, line: number): AgeBand[] {
  const rawAgeBands = requireCell(row, 'age_bands', line)
    .split('|')
    .map((ageBand) => ageBand.trim())
    .filter((ageBand) => ageBand !== '')

  if (rawAgeBands.length === 0) {
    throw new Error(`Line ${line}: objective "${objectiveId}" declares no age band`)
  }

  return rawAgeBands.map((ageBand) => {
    if (!(AGE_BANDS as readonly string[]).includes(ageBand)) {
      throw new Error(
        `Line ${line}: unknown age band "${ageBand}" for objective "${objectiveId}". Expected one of: ${AGE_BANDS.join(', ')}`,
      )
    }

    return ageBand as AgeBand
  })
}

function parseExamples(
  row: CsvRow,
  objectiveId: string,
  ageBands: AgeBand[],
  line: number,
): Partial<Record<AgeBand, string>> {
  const examples: Partial<Record<AgeBand, string>> = {}

  for (const ageBand of ageBands) {
    const example = (row[`example_${ageBand}`] ?? '').trim()

    if (example === '') {
      throw new Error(
        `Line ${line}: missing example_${ageBand} for declared age band "${ageBand}" in objective "${objectiveId}"`,
      )
    }

    examples[ageBand] = example
  }

  return examples
}

function parseSource(row: CsvRow, line: number) {
  const bo = requireCell(row, 'source_bo', line)
  const rawPage = (row.source_page ?? '').trim()

  if (rawPage === '') {
    return { bo }
  }

  const page = Number(rawPage)

  if (!Number.isInteger(page) || page <= 0) {
    throw new Error(`Line ${line}: source_page "${rawPage}" is not a valid page number`)
  }

  return { bo, page }
}

/**
 * Construit le référentiel versionné depuis le CSV source officiel.
 * Le CSV ne contient que des objectifs du programme : aucun contenu n'est
 * inventé ici. Les domaines viennent du catalogue officiel.
 */
export function buildReferentialFromCsv(
  csv: string,
  version: string = REFERENTIAL_VERSION,
): Referential {
  const rows = parseCsv(csv)
  const competenciesById = new Map<string, Competency>()
  const objectiveIds = new Set<string>()
  const objectives: Objective[] = []

  rows.forEach((row, index) => {
    const line = index + 2 // ligne 1 : en-tête CSV
    const objectiveId = requireCell(row, 'objective_id', line)

    if (objectiveIds.has(objectiveId)) {
      throw new Error(`Line ${line}: duplicate objective id "${objectiveId}"`)
    }

    const rawDomainId = requireCell(row, 'domain_id', line)
    if (!(DOMAIN_IDS as readonly string[]).includes(rawDomainId)) {
      throw new Error(
        `Line ${line}: unknown domain id "${rawDomainId}" for objective "${objectiveId}". Expected one of: ${DOMAIN_IDS.join(', ')}`,
      )
    }
    const domainId = rawDomainId as Domain['id']

    const competencyId = requireCell(row, 'competency_id', line)
    const competencyLabel = requireCell(row, 'competency_label', line)
    const existingCompetency = competenciesById.get(competencyId)

    if (
      existingCompetency &&
      (existingCompetency.domainId !== domainId || existingCompetency.label !== competencyLabel)
    ) {
      throw new Error(
        `Line ${line}: competency "${competencyId}" conflict — existing declaration is domain "${existingCompetency.domainId}" with label "${existingCompetency.label}", but this row uses domain "${domainId}" with label "${competencyLabel}"`,
      )
    }

    if (!existingCompetency) {
      competenciesById.set(competencyId, {
        id: competencyId,
        domainId,
        label: competencyLabel,
      })
    }

    const label = requireCell(row, 'objective_label', line)
    const ageBands = parseAgeBands(row, objectiveId, line)
    const examples = parseExamples(row, objectiveId, ageBands, line)
    const source = parseSource(row, line)

    objectiveIds.add(objectiveId)
    objectives.push({
      id: objectiveId,
      competencyId,
      domainId,
      label,
      ageBands,
      examples,
      source,
    })
  })

  return validateReferential({
    version,
    domains: DOMAINS.map((domain) => ({ ...domain })),
    competencies: [...competenciesById.values()],
    objectives,
  })
}

function isMainModule(): boolean {
  const entry = process.argv[1]

  return entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href
}

function run() {
  const sourcePath = path.resolve(import.meta.dirname, 'source/objectives.csv')
  const outputPath = path.resolve(import.meta.dirname, '../../src/data/referential.json')

  if (!existsSync(sourcePath)) {
    console.error(
      `Referential source not found: ${sourcePath}\n` +
        'The official objectives CSV has not been supplied yet. Nothing is invented locally, so the build stops here.',
    )
    process.exitCode = 1
    return
  }

  try {
    const csv = readFileSync(sourcePath, 'utf8')
    const referential = buildReferentialFromCsv(csv)

    mkdirSync(path.dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(referential, null, 2)}\n`, 'utf8')

    console.log(
      `Wrote ${referential.objectives.length} objectives (${referential.competencies.length} competencies) to ${outputPath}`,
    )
  } catch (error) {
    console.error(`Referential build failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

if (isMainModule()) {
  run()
}
