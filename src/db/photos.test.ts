/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { REFERENTIAL_VERSION } from '@/domain/referential'
import type { CompressedPhoto, Objective } from '@/domain/types'
import { db } from './db'
import { createStudent } from './students'
import { addPhotoToValidation, createValidation } from './validations'

const objective: Objective = {
  id: 'obj-photo',
  competencyId: 'comp-langage-1',
  domainId: 'langage',
  label: 'Dire de mémoire un texte court',
  ageBands: ['from4'],
  examples: { from4: 'Réciter une comptine' },
  source: { bo: 'BO 2026' },
}

/**
 * Le `Blob` de jsdom est transformé en objet vide par le clone structuré de
 * fake-indexeddb ; celui de Node survit et permet de vérifier le contenu relu.
 */
function jpegBlob(content: string): Blob {
  return new NodeBlob([content], { type: 'image/jpeg' }) as unknown as Blob
}

function makePhoto(label: string): CompressedPhoto {
  return {
    full: jpegBlob(label),
    thumb: jpegBlob(`${label}-vignette`),
    width: 1200,
    height: 900,
    mime: 'image/jpeg',
  }
}

async function makeValidation(photo?: CompressedPhoto) {
  const student = await createStudent({ firstName: 'Léa', section: 'MS' })

  return createValidation({
    studentId: student.id,
    objective,
    ageBand: 'from4',
    date: '2026-10-12',
    referentialVersion: REFERENTIAL_VERSION,
    ...(photo === undefined ? {} : { photo }),
  })
}

describe('addPhotoToValidation', () => {
  it('attache une photo à une validation qui n’en a pas', async () => {
    const validation = await makeValidation()

    await addPhotoToValidation(validation.id, makePhoto('ajoutée'))

    const updated = await db.validations.get(validation.id)
    expect(updated?.photoId).toMatch(/^photo_/)

    const photo = await db.photos.get(updated!.photoId!)
    expect(photo?.validationId).toBe(validation.id)
    expect(photo?.width).toBe(1200)
    expect(photo?.height).toBe(900)
    expect(photo?.full.type).toBe('image/jpeg')
    expect(await db.photos.count()).toBe(1)
  })

  it('remplace la photo existante sans laisser d’orphelin', async () => {
    const validation = await makeValidation(makePhoto('ancienne'))
    const previousPhotoId = validation.photoId!

    await addPhotoToValidation(validation.id, makePhoto('nouvelle'))

    const updated = await db.validations.get(validation.id)
    expect(updated?.photoId).not.toBe(previousPhotoId)
    expect(await db.photos.get(previousPhotoId)).toBeUndefined()
    expect(await db.photos.count()).toBe(1)

    const photo = await db.photos.get(updated!.photoId!)
    expect(photo?.validationId).toBe(validation.id)
    expect(photo?.width).toBe(1200)
  })

  it('refuse une validation inconnue', async () => {
    await expect(addPhotoToValidation('val-inconnue', makePhoto('nouvelle'))).rejects.toThrow(
      'Réussite introuvable.',
    )
    expect(await db.photos.count()).toBe(0)
  })
})
