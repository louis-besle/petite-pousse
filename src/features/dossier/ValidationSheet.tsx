import { useState } from 'react'
import { addPhotoToValidation, deleteValidation, updateValidationDate } from '@/db/validations'
import type { Validation } from '@/domain/types'
import { usePhoto } from '@/lib/usePhoto'
import { usePhotoFileInput } from '@/lib/usePhotoFileInput'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { ExampleBlock } from '@/ui/ExampleBlock'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/icons'
import { Sheet } from '@/ui/Sheet'
import { SheetActions } from '@/ui/SheetActions'
import { useToast } from '@/ui/useToast'
import styles from './dossier.module.css'
import { AGE_BAND_LABELS } from './labels'

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
  const [removing, setRemoving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { snapshot } = validation
  const hasPhoto = validation.photoId !== undefined

  const { inputRef, openPicker, busy, handleChange } = usePhotoFileInput({
    preparationError: PHOTO_PREPARATION_ERROR,
    saveError: PHOTO_STORAGE_ERROR,
    logLabel: 'Enregistrement de la photo impossible.',
    onPhoto: async (photo) => {
      await addPhotoToValidation(validation.id, photo)
      showToast(hasPhoto ? PHOTO_REPLACED_MESSAGE : PHOTO_ADDED_MESSAGE)
    },
  })

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

        {validation.photoId === undefined ? (
          <div className={styles.sheetPhotoEmpty}>
            <Icon name="file" size={28} />
            <span className={styles.sheetPhotoEmptyTitle}>Observation en classe</span>
            <span className={styles.sheetPhotoEmptyNote}>sans photo</span>
          </div>
        ) : photoUrl === undefined ? (
          <div className={styles.sheetPhotoLoading} role="status">
            <Icon name="camera" size={24} />
            <span>Chargement de la photo…</span>
          </div>
        ) : (
          <img
            className={styles.sheetPhoto}
            src={photoUrl}
            alt={`Photo de la réussite : ${snapshot.objectiveLabel}`}
          />
        )}

        {snapshot.example === undefined ? null : (
          <ExampleBlock label="Exemple de réussite" spaced>
            {snapshot.example}
          </ExampleBlock>
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

        <SheetActions>
          <Button
            variant="ghost"
            fullWidth
            disabled={busy}
            onClick={openPicker}
          >
            <Icon name="camera" size={18} />
            {busy
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
        </SheetActions>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            void handleChange(event)
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
