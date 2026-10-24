import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { db } from '@/db/db'
import { useSchoolYears } from '@/db/schoolYears'
import { useSettings } from '@/db/settings'
import { useStudents } from '@/db/students'
import { useValidationsForYear } from '@/db/validations'
import { buildBilanModel } from '@/domain/bilan'
import { referential } from '@/domain/referential'
import { resolveCurrentSchoolYearId } from '@/domain/schoolYear'
import type { Photo } from '@/domain/types'
import { todayIso } from '@/lib/date'
import { sharePdf } from '@/lib/share'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/icons'
import { useToast } from '@/ui/useToast'
import { BilanSheet } from './BilanSheet'
import type { BilanPdfMeta } from './pdf'
import styles from './preview.module.css'

const PDF_ERROR_MESSAGE = 'Le PDF n’a pas pu être généré. Réessaie.'

/** Une annulation de la feuille de partage n'est pas une erreur pour l'écran. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/** Période lue dans l'URL : toute valeur autre que 2 retombe sur le bilan 1. */
function parsePeriod(value: string | null): 1 | 2 {
  return value === '2' ? 2 : 1
}

/**
 * Aperçu A4 d'un élève et génération du PDF réel.
 *
 * L'élève vient du chemin, la période et l'année des paramètres de requête.
 * Une valeur invalide retombe sur la période 1 et l'année courante sans casser
 * l'écran ; un élève ou une année absents affichent un retour vers les bilans.
 */
export function BilanPreviewScreen() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()

  const settings = useSettings()
  const schoolYears = useSchoolYears()
  const students = useStudents()

  const [busy, setBusy] = useState(false)

  const period = parsePeriod(searchParams.get('period'))
  const years = schoolYears ?? []
  const knownYearIds = years.map((year) => year.id)
  knownYearIds.sort((a, b) => b.localeCompare(a))

  // Année demandée si elle existe, sinon l'année effective (celle d'une
  // réussite datée d'aujourd'hui), sinon l'année des réglages, sinon la plus
  // récente. Une URL directe sans `?year` ne doit pas rater la réussite du jour
  // quand le passage d'année est décalé.
  const requestedYearId = searchParams.get('year')
  const settingsYearId = settings?.currentSchoolYearId
  const effectiveCurrentYearId = resolveCurrentSchoolYearId(
    years,
    settingsYearId,
    todayIso(),
  )
  const selectedYearId =
    [requestedYearId, effectiveCurrentYearId, settingsYearId].find(
      (candidate): candidate is string =>
        candidate !== null && candidate !== undefined && knownYearIds.includes(candidate),
    ) ?? knownYearIds[0]
  const year = years.find((candidate) => candidate.id === selectedYearId)

  const validations = useValidationsForYear(selectedYearId ?? '')

  // Les photos du modèle sont chargées en une passe, pour l'élève seulement.
  const photos = useLiveQuery(async () => {
    const loaded = new Map<string, Photo>()
    const photoIds: string[] = []

    for (const validation of validations ?? []) {
      if (validation.studentId === studentId && validation.photoId !== undefined) {
        photoIds.push(validation.photoId)
      }
    }

    if (photoIds.length === 0) return loaded

    const rows = await db.photos.bulkGet(photoIds)
    for (const photo of rows) {
      if (photo !== undefined) loaded.set(photo.id, photo)
    }

    return loaded
  }, [validations, studentId])

  if (
    settings === undefined ||
    schoolYears === undefined ||
    students === undefined ||
    validations === undefined ||
    photos === undefined
  ) {
    return (
      <section className={styles.screen}>
        <div className={styles.topBar}>
          <Link to="/bilans" className={styles.backLink} aria-label="Retour aux bilans">
            <Icon name="back" size={18} />
          </Link>
          <h1 className={styles.title}>Bilan</h1>
        </div>
        <p className={styles.loading} role="status">
          Chargement du bilan…
        </p>
      </section>
    )
  }

  const student = students.find((candidate) => candidate.id === studentId)

  if (student === undefined) {
    return (
      <section className={styles.screen}>
        <div className={styles.topBar}>
          <Link to="/bilans" className={styles.backLink} aria-label="Retour aux bilans">
            <Icon name="back" size={18} />
          </Link>
          <h1 className={styles.title}>Élève introuvable</h1>
        </div>
        <p className={styles.emptyText}>
          Ce dossier n’existe plus ou n’a pas pu être chargé.
        </p>
        <Link to="/bilans" className={styles.inlineLink}>
          Retour aux bilans
        </Link>
      </section>
    )
  }

  if (year === undefined) {
    return (
      <section className={styles.screen}>
        <div className={styles.topBar}>
          <Link to="/bilans" className={styles.backLink} aria-label="Retour aux bilans">
            <Icon name="back" size={18} />
          </Link>
          <h1 className={styles.title}>Bilan indisponible</h1>
        </div>
        <p className={styles.emptyText}>
          Aucune année scolaire n’est enregistrée pour préparer ce bilan.
        </p>
        <Link to="/bilans" className={styles.inlineLink}>
          Retour aux bilans
        </Link>
      </section>
    )
  }

  // Copies rétrécies : TypeScript ne conserve pas le garde au fond des closures.
  const bilanStudent = student
  const bilanYear = year

  const model = buildBilanModel({
    student: bilanStudent,
    year: bilanYear,
    period,
    validations,
    photos,
    referential,
  })
  const meta: BilanPdfMeta = {
    schoolName: settings.schoolName ?? '',
    className: settings.className ?? '',
    teacherName: settings.teacherName ?? '',
  }

  function togglePeriod(): void {
    const nextPeriod: 1 | 2 = period === 1 ? 2 : 1
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('period', String(nextPeriod))
    nextParams.set('year', bilanYear.id)
    setSearchParams(nextParams)
  }

  async function handlePrint(): Promise<void> {
    if (busy) return

    setBusy(true)
    try {
      // pdf-lib et fontkit ne sont chargés qu'au moment de générer la feuille :
      // l'aperçu HTML ne paie pas leur poids au premier affichage.
      const { generateBilanPdf, loadPdfFonts, pdfFileName } = await import('./pdf')
      const fonts = await loadPdfFonts()
      const bytes = await generateBilanPdf(model, meta, fonts)
      const filename = pdfFileName(bilanStudent, bilanYear, period)
      const result = await sharePdf(bytes, filename)

      showToast(
        result === 'shared' ? 'PDF prêt à être partagé.' : 'PDF téléchargé.',
      )
    } catch (error) {
      if (isAbortError(error)) return

      console.error('Génération du PDF impossible.', error)
      showToast(PDF_ERROR_MESSAGE)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.screen}>
      <div className={styles.topBar}>
        <Link to="/bilans" className={styles.backLink} aria-label="Retour aux bilans">
          <Icon name="back" size={18} />
        </Link>
        <h1 className={styles.title}>Bilan de {bilanStudent.firstName}</h1>
        <span className={styles.periodPill}>Bilan {period}</span>
      </div>

      <BilanSheet model={model} meta={meta} />

      <p className={styles.note}>
        La feuille ne contient que les réussites de la période. Le PDF est généré
        directement par le bouton ci-dessous.
      </p>

      <div className={styles.actions}>
        <Button
          variant="dark"
          fullWidth
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => {
            void handlePrint()
          }}
        >
          <Icon name="download" size={18} />
          {busy ? 'Préparation du PDF…' : 'Imprimer / PDF'}
        </Button>
        <Button variant="ghost" fullWidth disabled={busy} onClick={togglePeriod}>
          Changer de période
        </Button>
      </div>
    </section>
  )
}
