import { useRef, useState, type ChangeEvent } from 'react'
import { addPhotoToValidation, deleteValidation, updateValidationDate } from '@/db/validations'
import { ImageDecodeError } from '@/domain/errors'
import type { CompressedPhoto, Validation } from '@/domain/types'
import { compressImage } from '@/lib/image'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/icons'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/useToast'
import styles from './dossier.module.css'
import { AGE_BAND_LABELS } from './labels'
import { usePhoto } from './usePhoto'

const PHOTO_PREPARATION_ERROR = 'La photo n’a pas pu être préparée. Réessaie.'
const PHOTO_STORAGE_ERROR = 'La photo n’a pas pu être enregistrée. Réessaie.'
const DATE_UPDATE_ERROR = 'La date n’a pas pu être modifiée. Réessaie.'
const DELETE_ERROR = 'La réussite n’a pas pu être retirée. Réessaie.'

const DATE_UPDATED_MESSAGE = 'Date mise à jour.'
const PHOTO_ADDED_MESSAGE = 'La photo a été ajoutée.'
const PHOTO_REPLACED_MESSAGE = 'La photo a été remplacée.'
const DELETED_MESSAGE = 'La réussite a été retirée.'

export interface ValidationSheetProps {
  validation: Validation
  onClose: () => void
}

/**
 * Fiche d'une réussite : photo en grand (ou mention d'observation), exemple,
 * date éditable, ajout de photo et retrait confirmé.
 *
 * La validation reçue est la ligne vivante : après une mise à jour Dexie, le
 * parent transmet la nouvelle version et la fiche se rafraîchit sans état figé.
 */
export function ValidationSheet({ validation, onClose }: ValidationSheetProps) {
  const { showToast } = useToast()
  const photoUrl = usePhoto(validation.photoId)
  const [savingDate, setSavingDate] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { snapshot } = validation
  const hasPhoto = validation.photoId !== undefined

  async function handleDateChange(nextDate: string): Promise<void> {
    if (nextDate === '' || nextDate === validation.date) return

    setSavingDate(true)
    try {
      await updateValidationDate(validation.id, nextDate)
      // La ligne vivante du parent porte la nouvelle date ; la fiche suit.
      showToast(DATE_UPDATED_MESSAGE)
    } catch (error) {
      console.error('Mise à jour de la date impossible.', error)
      showToast(DATE_UPDATE_ERROR)
    } finally {
      setSavingDate(false)
    }
  }

  function openFilePicker(): void {
    fileInputRef.current?.click()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Permet de reprendre exactement le même fichier juste après.
    input.value = ''

    if (file === undefined) return

    setSavingPhoto(true)
    try {
      let compressed: CompressedPhoto
      try {
        compressed = await compressImage(file)
      } catch (error) {
        showToast(
          error instanceof ImageDecodeError ? error.message : PHOTO_PREPARATION_ERROR,
        )
        return
      }

      await addPhotoToValidation(validation.id, compressed)
      showToast(hasPhoto ? PHOTO_REPLACED_MESSAGE : PHOTO_ADDED_MESSAGE)
    } catch (error) {
      console.error('Enregistrement de la photo impossible.', error)
      showToast(PHOTO_STORAGE_ERROR)
    } finally {
      setSavingPhoto(false)
    }
  }

  async function handleRemove(): Promise<void> {
    if (removing) return

    setRemoving(true)
    try {
      await deleteValidation(validation.id)
      setConfirmOpen(false)
      showToast(DELETED_MESSAGE)
      onClose()
    } catch (error) {
      console.error('Suppression de la réussite impossible.', error)
      showToast(DELETE_ERROR)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <Sheet open title={snapshot.objectiveLabel} onClose={onClose}>
        <p className={styles.sheetMeta}>
          {snapshot.domainLabel} · {AGE_BAND_LABELS[snapshot.ageBand]}
        </p>

        {photoUrl === undefined ? (
          <div className={styles.sheetPhotoEmpty}>
            <Icon name="file" size={28} />
            <span className={styles.sheetPhotoEmptyTitle}>Observation en classe</span>
            <span className={styles.sheetPhotoEmptyNote}>sans photo</span>
          </div>
        ) : (
          <img
            className={styles.sheetPhoto}
            src={photoUrl}
            alt={`Photo de la réussite : ${snapshot.objectiveLabel}`}
          />
        )}

        {snapshot.example === undefined ? null : (
          <div className={styles.exampleBlock}>
            <p className={styles.exampleLabel}>Exemple de réussite</p>
            <p className={styles.exampleText}>{snapshot.example}</p>
          </div>
        )}

        <div className={styles.sheetField}>
          <Field
            type="date"
            label="Date de la réussite"
            value={validation.date}
            disabled={savingDate}
            onChange={(event) => {
              void handleDateChange(event.target.value)
            }}
          />
        </div>

        <div className={styles.sheetActions}>
          <Button
            variant="ghost"
            fullWidth
            disabled={savingPhoto}
            onClick={openFilePicker}
          >
            <Icon name="camera" size={18} />
            {savingPhoto
              ? 'Enregistrement…'
              : hasPhoto
                ? 'Remplacer la photo'
                : 'Ajouter une photo'}
          </Button>
          <Button
            variant="danger"
            fullWidth
            disabled={removing}
            onClick={() => setConfirmOpen(true)}
          >
            <Icon name="trash" size={18} />
            Retirer cette réussite
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            void handleFileChange(event)
          }}
        />
      </Sheet>

      <ConfirmSheet
        open={confirmOpen}
        title="Retirer cette réussite ?"
        description={
          hasPhoto
            ? 'La réussite et sa photo seront retirées du dossier de l’élève. Cette action est irréversible.'
            : 'La réussite sera retirée du dossier de l’élève. Cette action est irréversible.'
        }
        confirmLabel="Retirer définitivement"
        tone="danger"
        onConfirm={() => {
          void handleRemove()
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  )
}
