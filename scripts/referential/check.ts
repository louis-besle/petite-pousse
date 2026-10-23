import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AGE_BANDS, DOMAIN_IDS, validateReferential } from '../../src/domain/referential'
import type { AgeBand, Domain, Referential } from '../../src/domain/types'

const TARGET_COUNTS: Record<AgeBand, number> = {
  before4: 114,
  from4: 140,
  from5: 162,
}

const TOLERANCE = 0.1

const AGE_BAND_LABELS: Record<AgeBand, string> = {
  before4: 'avant 4 ans',
  from4: 'à partir de 4 ans',
  from5: 'à partir de 5 ans',
}

export function countByDomain(referential: Referential): Record<Domain['id'], number> {
  const counts = Object.fromEntries(DOMAIN_IDS.map((domainId) => [domainId, 0])) as Record<
    Domain['id'],
    number
  >

  for (const objective of referential.objectives) {
    counts[objective.domainId] += 1
  }

  return counts
}

export function countByAgeBand(referential: Referential): Record<AgeBand, number> {
  const counts = Object.fromEntries(AGE_BANDS.map((ageBand) => [ageBand, 0])) as Record<
    AgeBand,
    number
  >

  for (const objective of referential.objectives) {
    for (const ageBand of objective.ageBands) {
      counts[ageBand] += 1
    }
  }

  return counts
}

function report(referential: Referential) {
  console.log(`Referential ${referential.version} — ${referential.objectives.length} objectives`)

  console.log('\nPar domaine :')
  const domainCounts = countByDomain(referential)
  for (const domain of referential.domains) {
    console.log(`  ${domain.label.padEnd(10)} ${domainCounts[domain.id]}`)
  }

  console.log('\nPar tranche d’âge :')
  const ageBandCounts = countByAgeBand(referential)
  for (const ageBand of AGE_BANDS) {
    console.log(
      `  ${AGE_BAND_LABELS[ageBand].padEnd(18)} ${String(ageBandCounts[ageBand]).padStart(3)}  (cible ${TARGET_COUNTS[ageBand]})`,
    )
  }

  const warnings = AGE_BANDS.filter((ageBand) => {
    const target = TARGET_COUNTS[ageBand]
    return Math.abs(ageBandCounts[ageBand] - target) / target > TOLERANCE
  })

  if (warnings.length > 0) {
    console.log('')
    for (const ageBand of warnings) {
      const target = TARGET_COUNTS[ageBand]
      const deviation = Math.round((Math.abs(ageBandCounts[ageBand] - target) / target) * 100)
      console.warn(
        `⚠ ${AGE_BAND_LABELS[ageBand]} : ${ageBandCounts[ageBand]} objectifs pour une cible de ${target} (écart ${deviation} %). Vérifier le référentiel, sans bloquer la construction.`,
      )
    }
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1]

  return entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href
}

function run() {
  const referentialPath = path.resolve(import.meta.dirname, '../../src/data/referential.json')

  let raw: unknown

  try {
    raw = JSON.parse(readFileSync(referentialPath, 'utf8'))
  } catch (error) {
    console.error(
      `Unable to read ${referentialPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
    return
  }

  let referential: Referential

  try {
    referential = validateReferential(raw)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return
  }

  report(referential)
}

if (isMainModule()) {
  run()
}
