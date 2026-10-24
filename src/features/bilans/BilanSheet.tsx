import type { BilanEntry, BilanModel } from '@/domain/bilan'
import type { Domain } from '@/domain/types'
import { formatShortDate } from '@/lib/date'
import { usePhotoThumb } from '@/lib/usePhoto'
import { FlowerMark } from '@/ui/FlowerMark'
import { Icon, type IconName } from '@/ui/icons'
import type { BilanPdfMeta } from './pdf'
import styles from './preview.module.css'

const DOMAIN_ICONS: Record<Domain['id'], IconName> = {
  langage: 'book',
  maths: 'shapes',
  corps: 'ball',
  arts: 'palette',
  temps: 'clock',
  vivant: 'leaf',
  evar: 'heart',
}

/** « 1 réussite », « 2 réussites ». */
function successLabel(count: number): string {
  return `${count} réussite${count > 1 ? 's' : ''}`
}

/** « Léa » ou « Léa M. » selon que l'initiale est renseignée. */
function studentLabel(model: BilanModel): string {
  const { student } = model
  const initial = student.lastNameInitial?.trim()

  return initial === undefined || initial === ''
    ? student.firstName
    : `${student.firstName} ${initial}.`
}

/** « 1 sept. 2026 → 31 janv. 2027 ». */
function periodPill(model: BilanModel): string {
  return `${formatShortDate(model.start)} ${model.start.slice(0, 4)} → ${formatShortDate(
    model.end,
  )} ${model.end.slice(0, 4)}`
}

function SheetEntry({ entry }: { entry: BilanEntry }) {
  const thumbUrl = usePhotoThumb(entry.photo?.id)
  const hasPhoto = entry.photo !== undefined

  return (
    <li className={styles.entry}>
      {thumbUrl === undefined ? (
        <span
          className={styles.thumbEmpty}
          data-domain={entry.domainId}
          aria-hidden="true"
        >
          <Icon name={hasPhoto ? 'camera' : (DOMAIN_ICONS[entry.domainId] ?? 'file')} size={15} />
        </span>
      ) : (
        <img
          className={styles.thumb}
          src={thumbUrl}
          alt={`Photo de la réussite : ${entry.objectiveLabel}`}
        />
      )}

      <span className={styles.entryText}>
        <span className={styles.entryLabel}>{entry.objectiveLabel}</span>
        <span className={styles.entryMeta}>
          <span
            className={styles.entryDot}
            data-domain={entry.domainId}
            aria-hidden="true"
          />
          {formatShortDate(entry.date)}
          {hasPhoto ? null : ' · Observation en classe'}
        </span>
      </span>
    </li>
  )
}

function DomainBlock({ group }: { group: BilanModel['domains'][number] }) {
  return (
    <section className={styles.domain} aria-label={group.domain.label}>
      <div className={styles.domainHead}>
        <span
          className={styles.domainDot}
          data-domain={group.domain.id}
          aria-hidden="true"
        />
        <span className={styles.domainLabel}>{group.domain.label}</span>
        <span className={styles.domainCount}>{successLabel(group.entries.length)}</span>
      </div>

      <ul className={styles.entries}>
        {group.entries.map((entry) => (
          <SheetEntry key={entry.validationId} entry={entry} />
        ))}
      </ul>
    </section>
  )
}

export interface BilanSheetProps {
  model: BilanModel
  meta: BilanPdfMeta
}

/**
 * Aperçu HTML de la feuille A4, construit avec le même modèle que le PDF.
 *
 * La feuille garde les proportions A4 et se réduit par `zoom` sur téléphone :
 * aucun défilement horizontal de la page, et les textes restent lisibles.
 */
export function BilanSheet({ model, meta }: BilanSheetProps) {
  const identity = [meta.schoolName, meta.className, meta.teacherName]
    .filter((part) => part !== '')
    .join(' · ')

  return (
    <div className={styles.viewport}>
      <article
        className={styles.sheet}
        aria-label={`Aperçu de la feuille A4 de ${model.student.firstName}`}
      >
        <header className={styles.sheetHeader}>
          <span className={styles.sheetIdentity}>
            <FlowerMark size={11} />
            {identity === '' ? 'Carnet de réussites' : identity}
          </span>
          <span>
            Bilan {model.period} · {model.year.id}
          </span>
        </header>

        <h2 className={styles.sheetTitle}>Bilan des réussites</h2>

        <div className={styles.sheetStudent}>
          <div>
            <p className={styles.sheetName}>{studentLabel(model)}</p>
            <p className={styles.sheetMeta}>
              {model.student.section} · {successLabel(model.total)}
            </p>
          </div>
          <span className={styles.sheetPeriod}>{periodPill(model)}</span>
        </div>

        {model.total === 0 ? (
          <p className={styles.sheetEmpty}>Aucune réussite sur cette période.</p>
        ) : (
          <div className={styles.sheetBody}>
            {model.domains.map((group) => (
              <DomainBlock key={group.domain.id} group={group} />
            ))}
          </div>
        )}

        <footer className={styles.sheetFooter}>
          <div className={styles.footerRow}>
            <span>Carnet de réussites</span>
            <span className={styles.signature}>
              Signature des parents
              <span className={styles.signatureLine} aria-hidden="true" />
            </span>
          </div>
          <span className={styles.paginationNote}>
            Pagination exacte calculée dans le PDF
          </span>
        </footer>
      </article>
    </div>
  )
}
