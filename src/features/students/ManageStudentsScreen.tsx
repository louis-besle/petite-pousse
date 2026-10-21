import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteStudentCascade, useStudents } from '@/db/students'
import { useAllValidations } from '@/db/validations'
import type { Student } from '@/domain/types'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { Icon } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { useToast } from '@/ui/useToast'
import styles from './students.module.css'
import { StudentFormSheet } from './StudentFormSheet'

const DELETED_MESSAGE = 'Élève supprimé.'
const DELETE_ERROR = 'L’élève n’a pas pu être supprimé. Réessaie.'

/** « 1 réussite », « 2 réussites ». */
function successLabel(count: number): string {
  return `${count} réussite${count > 1 ? 's' : ''}`
}

/** « 1 élève », « 2 élèves ». */
function studentCountLabel(count: number): string {
  return `${count} élève${count > 1 ? 's' : ''}`
}

/**
 * Phrase de confirmation : les comptes portent sur toutes les années et sur
 * les photos réellement attachées aux validations (une par validation maximum).
 */
function deleteDescription(validationCount: number, photoCount: number): string {
  return `Son dossier sera supprimé définitivement, avec ${validationCount} réussite${
    validationCount > 1 ? 's' : ''
  } et ${photoCount} photo${
    photoCount > 1 ? 's' : ''
  }. Cette action est irréversible.`
}

/**
 * Gestion des élèves : liste avec total de réussites toutes années, ajout,
 * édition et suppression définitive en cascade.
 *
 * Les compteurs viennent d'une seule requête (`useAllValidations`) regroupée
 * par élève : aucune requête par ligne, et les totaux suivent les suppressions
 * et les modifications en direct.
 */
export function ManageStudentsScreen() {
  const students = useStudents()
  const validations = useAllValidations()
  const { studentId: routeStudentId } = useParams<{ studentId?: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [formStudent, setFormStudent] = useState<Student | null | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)

  const validationCounts = new Map<string, number>()
  const photoCounts = new Map<string, number>()
  for (const validation of validations ?? []) {
    validationCounts.set(
      validation.studentId,
      (validationCounts.get(validation.studentId) ?? 0) + 1,
    )
    if (validation.photoId !== undefined) {
      photoCounts.set(validation.studentId, (photoCounts.get(validation.studentId) ?? 0) + 1)
    }
  }

  const loaded = students !== undefined && validations !== undefined
  const count = students === undefined ? '…' : studentCountLabel(students.length)

  async function handleDelete(): Promise<void> {
    if (deleteTarget === null || deleting) return

    const target = deleteTarget
    setDeleting(true)
    try {
      await deleteStudentCascade(target.id)
      setDeleteTarget(null)
      showToast(DELETED_MESSAGE)

      // Repli de sécurité : si l'élève supprimé était celui du dossier ouvert,
      // la route courante ne doit pas rester sur un dossier disparu.
      if (routeStudentId === target.id) {
        navigate('/students', { replace: true })
      }
    } catch (error) {
      console.error('Suppression de l’élève impossible.', error)
      showToast(DELETE_ERROR)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className={styles.screen}>
      <div className={styles.topBar}>
        <IconButton label="Retour" onClick={() => navigate('/')}>
          <Icon name="back" size={18} />
        </IconButton>
        <h1 className={styles.title}>Gérer les élèves</h1>
        <span className={styles.countPill}>{count}</span>
      </div>

      <p className={styles.subtitle}>Ajoute un élève ou supprime un dossier.</p>

      <Button
        variant="dark"
        fullWidth
        className={styles.addButton}
        onClick={() => setFormStudent(null)}
      >
        <Icon name="plus" size={18} />
        Ajouter un élève
      </Button>

      {!loaded ? (
        <p className={styles.loading} role="status">
          Chargement des élèves…
        </p>
      ) : students.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucun élève dans la classe</p>
          <p className={styles.emptyText}>
            Ajoute le premier élève pour commencer à remplir son dossier.
          </p>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setFormStudent(null)}
          >
            <Icon name="plus" size={17} />
            Ajouter le premier élève
          </Button>
        </div>
      ) : (
        <>
          <p className={styles.eyebrow}>Les élèves de la classe</p>

          <ul className={styles.list}>
            {students.map((student) => {
              const validationCount = validationCounts.get(student.id) ?? 0

              return (
                <li key={student.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    aria-label={`Modifier ${student.firstName}`}
                    onClick={() => setFormStudent(student)}
                  >
                    <Avatar name={student.firstName} section={student.section} size="sm" />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{student.firstName}</span>
                      <span className={styles.rowMeta}>
                        {successLabel(validationCount)}
                      </span>
                    </span>
                    <span className={styles.editIcon} aria-hidden="true">
                      <Icon name="pencil" size={15} />
                    </span>
                  </button>

                  <IconButton
                    label={`Supprimer ${student.firstName}`}
                    className={styles.trashButton}
                    onClick={() => setDeleteTarget(student)}
                  >
                    <Icon name="trash" size={16} />
                  </IconButton>
                </li>
              )
            })}
          </ul>

          <p className={styles.note}>
            La suppression efface le dossier, les réussites et les photos de l’élève.
          </p>
        </>
      )}

      {formStudent === undefined ? null : (
        <StudentFormSheet
          open
          student={formStudent}
          onClose={() => setFormStudent(undefined)}
        />
      )}

      <ConfirmSheet
        open={deleteTarget !== null}
        title={`Supprimer ${deleteTarget?.firstName ?? ''} ?`}
        description={
          deleteTarget === null
            ? ''
            : deleteDescription(
                validationCounts.get(deleteTarget.id) ?? 0,
                photoCounts.get(deleteTarget.id) ?? 0,
              )
        }
        confirmLabel="Supprimer définitivement"
        tone="danger"
        onConfirm={() => {
          void handleDelete()
        }}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </section>
  )
}
