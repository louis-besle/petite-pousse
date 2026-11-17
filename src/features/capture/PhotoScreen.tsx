import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '@/db/db'
import {
  getCaptureDraft,
  saveCaptureDraft,
  useCaptureDraft,
} from '@/db/drafts'
import type { CaptureDraft, CompressedPhoto, Student } from '@/domain/types'
import { usePhotoFileInput } from '@/lib/usePhotoFileInput'
import { Button } from '@/ui/Button'
import { FlowerMark } from '@/ui/FlowerMark'
import { Icon } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { LoadingText } from '@/ui/LoadingText'
import { Sheet } from '@/ui/Sheet'
import { SheetActions } from '@/ui/SheetActions'
import { useToast } from '@/ui/useToast'
import { StudentRecap } from './StudentRecap'
import styles from './capture.module.css'

const PREPARING_MESSAGE = 'Préparation…'
const PHOTO_ERROR_MESSAGE = 'La photo n’a pas pu être préparée. Réessaie.'
const DRAFT_ERROR_MESSAGE = 'Le brouillon n’a pas pu être enregistré. Réessaie.'

interface PhotoSnapshot {
  draft: CaptureDraft | null
  student: Student | null
}

/**
 * Un brouillon ne peut alimenter l'écran que s'il désigne bien l'élève de la
 * route. Toute autre ligne est ignorée avant la redirection.
 */
function draftForStudent(
  draft: CaptureDraft | null | undefined,
  studentId: string,
): CaptureDraft | undefined {
  return draft?.studentId === studentId ? draft : undefined
}

/**
 * Étape 2 de la capture : prendre ou reprendre la photo.
 *
 * Le brouillon Dexie est la seule source de vérité : l'aperçu en est dérivé et
 * n'est jamais supprimé au démontage. Sans brouillon (ou si l'élève ne
 * correspond plus), l'écran renvoie vers le choix de l'élève.
 */
export function PhotoScreen() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const liveDraft = useCaptureDraft()
  const [snapshot, setSnapshot] = useState<PhotoSnapshot>()
  // État de l'enregistrement sans photo, distinct de celui du champ fichier.
  const [validateBusy, setValidateBusy] = useState(false)
  // Choix entre caméra et photothèque, ouvert par « Prendre la photo ».
  const [chooserOpen, setChooserOpen] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)

  /**
   * Écriture de la photo dans le brouillon courant. Un brouillon disparu ou
   * réaffecté à un autre élève renvoie au choix de l'élève.
   */
  async function savePhoto(photo: CompressedPhoto): Promise<void> {
    const current = await getCaptureDraft()

    if (!current || current.studentId !== studentId) {
      showToast('Le brouillon a changé. Choisis de nouveau l’élève.')
      navigate('/capture', { replace: true })
      return
    }

    await saveCaptureDraft({
      id: 'current',
      studentId: current.studentId,
      createdAt: current.createdAt,
      full: photo.full,
      thumb: photo.thumb,
      width: photo.width,
      height: photo.height,
    })
  }

  const {
    inputRef,
    openPicker,
    libraryInputRef,
    openLibrary,
    busy: photoBusy,
    handleChange,
  } = usePhotoFileInput({
    onPhoto: savePhoto,
    preparationError: PHOTO_ERROR_MESSAGE,
    saveError: DRAFT_ERROR_MESSAGE,
    logLabel: 'Enregistrement du brouillon impossible.',
  })

  // L'écran reste occupé tant que l'une des deux écritures est en cours.
  const busy = photoBusy || validateBusy

  // Lecture explicite initiale : elle distingue « chargement » de « aucun
  // brouillon ». Aucune redirection n'est décidée avant qu'elle ait répondu.
  useEffect(() => {
    let active = true

    void Promise.all([getCaptureDraft(), db.students.get(studentId)]).then(
      ([draft, student]) => {
        if (active) {
          setSnapshot({ draft: draft ?? null, student: student ?? null })
        }
      },
    )

    return () => {
      active = false
    }
  }, [studentId])

  // La ligne vivante prime, mais uniquement si elle désigne toujours l'élève
  // de la route. Sinon, on ne l'affiche pas et l'effet ci-dessous redirige.
  const draft =
    liveDraft !== undefined
      ? draftForStudent(liveDraft, studentId)
      : draftForStudent(snapshot?.draft, studentId)

  useEffect(() => {
    if (snapshot === undefined) return

    if (liveDraft !== undefined && liveDraft.studentId !== studentId) {
      navigate('/capture', { replace: true })
      return
    }

    const missingDraft = snapshot.draft === null
    const wrongStudent = snapshot.draft?.studentId !== studentId
    const missingStudent = snapshot.student === null

    if (missingDraft || wrongStudent || missingStudent) {
      navigate('/capture', { replace: true })
    }
  }, [snapshot, liveDraft, studentId, navigate])

  const full = draft?.full

  // L'URL d'objet est posée directement sur l'image : c'est une
  // synchronisation avec le DOM, révoquée au démontage ou au changement de
  // blob. Le brouillon, lui, n'est jamais supprimé ici.
  useEffect(() => {
    const image = imageRef.current
    if (full === undefined || image === null) return

    const url = URL.createObjectURL(full)
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [full])

  async function validateWithoutPhoto(): Promise<void> {
    setValidateBusy(true)
    try {
      const current = await getCaptureDraft()

      if (!current || current.studentId !== studentId) {
        navigate('/capture', { replace: true })
        return
      }

      // On conserve l'élève et la date du brouillon ; les champs photo
      // disparaissent réellement de la ligne (pas seulement mis à undefined).
      await saveCaptureDraft({
        id: 'current',
        studentId: current.studentId,
        createdAt: current.createdAt,
      })
      navigate('/capture/objective')
    } catch (error) {
      console.error('Enregistrement du brouillon impossible.', error)
      showToast(DRAFT_ERROR_MESSAGE)
    } finally {
      setValidateBusy(false)
    }
  }

  if (snapshot === undefined || snapshot.student === null || draft == null) {
    return (
      <section className={styles.screen}>
        <LoadingText>Chargement de la photo…</LoadingText>
      </section>
    )
  }

  const student = snapshot.student
  const hasPhoto = draft.full !== undefined

  function handlePrimaryAction(): void {
    if (hasPhoto) {
      navigate('/capture/objective')
    } else {
      setChooserOpen(true)
    }
  }

  /**
   * La feuille se ferme puis le champ fichier est cliqué dans le même geste
   * utilisateur : le navigateur ouvre bien l'appareil photo ou la photothèque.
   */
  function chooseCamera(): void {
    setChooserOpen(false)
    openPicker()
  }

  function chooseLibrary(): void {
    setChooserOpen(false)
    openLibrary()
  }

  return (
    <section className={`${styles.screen} ${styles.photoScreen}`} aria-busy={busy}>
      <div className={styles.topBar}>
        <IconButton label="Retour" onClick={() => navigate('/capture')}>
          <Icon name="back" size={18} />
        </IconButton>
        <h1 className={styles.topTitle}>Nouvelle réussite</h1>
        <span className={styles.stepPill}>2 / 3</span>
      </div>

      <StudentRecap student={student}>
        <span className={styles.recapName}>{student.firstName}</span>
        <span className={styles.recapCheck} aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
      </StudentRecap>

      <div className={styles.viewfinder}>
        <div className={styles.frame}>
          {hasPhoto ? (
            <img
              ref={imageRef}
              className={styles.preview}
              alt={`Photo de réussite de ${student.firstName}`}
            />
          ) : (
            <span className={styles.placeholder} aria-hidden="true">
              <FlowerMark size={112} />
            </span>
          )}

          <span className={styles.viewfinderChip}>
            <span className={styles.viewfinderMini} aria-hidden="true">
              {student.firstName.charAt(0).toUpperCase()}
            </span>
            {student.firstName} · {student.section}
          </span>

          {hasPhoto ? (
            <span className={styles.takenBadge}>
              <Icon name="check" size={12} />
              Photo prise
            </span>
          ) : (
            <>
              <span className={styles.focus} aria-hidden="true" />
              <span className={styles.hint}>Cadre la réussite, puis prends la photo</span>
            </>
          )}
        </div>
      </div>

      <div className={styles.photoBar}>
        <span className={styles.photoStatus}>
          {hasPhoto ? 'Photo prise à l’instant' : 'Prête à photographier'}
        </span>
        <span className={styles.photoActions}>
          {hasPhoto ? (
            <button
              type="button"
              className={styles.textAction}
              onClick={() => setChooserOpen(true)}
              disabled={busy}
            >
              Reprendre
            </button>
          ) : null}
          <button
            type="button"
            className={styles.textAction}
            onClick={() => {
              void validateWithoutPhoto()
            }}
            disabled={busy}
          >
            Valider sans photo
          </button>
        </span>
      </div>

      <div className={styles.infoStrip}>
        <Icon name="camera" size={18} />
        <p>
          La photo reste sur ton téléphone.
          <span>Rien n’est envoyé en ligne.</span>
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="photo-camera-input"
        onChange={(event) => {
          void handleChange(event)
        }}
      />

      {/* Sans `capture`, ce champ ouvre le sélecteur de photos du téléphone. */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        hidden
        data-testid="photo-library-input"
        onChange={(event) => {
          void handleChange(event)
        }}
      />

      <div className={styles.ctaBar}>
        <Button
          variant="primary"
          fullWidth
          className={styles.cta}
          disabled={busy}
          onClick={handlePrimaryAction}
        >
          {busy ? (
            PREPARING_MESSAGE
          ) : hasPhoto ? (
            <>
              Choisir l’objectif
              <Icon name="arrow" size={18} />
            </>
          ) : (
            <>
              <Icon name="camera" size={20} />
              Prendre la photo
            </>
          )}
        </Button>
      </div>

      <Sheet
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="Ajouter une photo"
      >
        <SheetActions>
          <Button variant="primary" fullWidth onClick={chooseCamera}>
            <Icon name="camera" size={18} />
            Caméra
          </Button>
          <Button variant="ghost" fullWidth onClick={chooseLibrary}>
            <Icon name="grid" size={18} />
            Photothèque
          </Button>
        </SheetActions>
      </Sheet>
    </section>
  )
}
