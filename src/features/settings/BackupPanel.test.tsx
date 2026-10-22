import { Blob as NodeBlob } from 'node:buffer'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { Objective } from '@/domain/types'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { exportBackup } from './backup'

/** Même précaution que les tests de photos : NodeBlob survit à IndexedDB. */
function jpegBlob(content: string): Blob {
  return new NodeBlob([content], { type: 'image/jpeg' }) as unknown as Blob
}

function objectiveAt(index: number): Objective {
  const objective = referential.objectives[index]
  if (!objective) {
    throw new Error(`Référentiel de test incomplet : pas d'objectif à l'index ${index}.`)
  }
  return objective
}

async function asZipFile(blob: Blob): Promise<File> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return new File([bytes], 'carnet-de-reussites-backup.zip', {
    type: 'application/zip',
  })
}

beforeEach(async () => {
  localStorage.setItem('privacy-ack', '1')
  await ensureSeed()
  await db.schoolYears.put(makeSchoolYear())
  await updateSettings({ currentSchoolYearId: makeSchoolYear().id })
})

describe('BackupPanel', () => {
  it(
    'affiche le résumé et ne restaure qu’après confirmation',
    async () => {
      const lea = makeStudent({ firstName: 'Léa', section: 'MS' })
      const adam = makeStudent({ firstName: 'Adam', section: 'PS' })
      await db.students.bulkAdd([lea, adam])

      await createValidation({
        studentId: lea.id,
        objective: objectiveAt(0),
        ageBand: 'from4',
        date: '2026-10-12',
        referentialVersion: REFERENTIAL_VERSION,
        photo: {
          full: jpegBlob('photo de Léa'),
          thumb: jpegBlob('vignette de Léa'),
          width: 800,
          height: 600,
          mime: 'image/jpeg',
        },
      })
      await createValidation({
        studentId: adam.id,
        objective: objectiveAt(1),
        ageBand: 'before4',
        date: '2026-10-13',
        referentialVersion: REFERENTIAL_VERSION,
      })

      const backupFile = await asZipFile(await exportBackup(() => {}))

      // L'appareil courant a divergé : seul Nina reste après suppression.
      await db.transaction(
        'rw',
        db.students,
        db.validations,
        db.photos,
        async () => {
          await db.validations.clear()
          await db.photos.clear()
          await db.students.clear()
        },
      )
      await db.students.add(makeStudent({ firstName: 'Nina' }))

      const user = userEvent.setup()
      renderApp({ route: '/settings' })

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Sauvegarde' }),
      ).toBeInTheDocument()

      const input = screen.getByLabelText('Fichier de sauvegarde ZIP')
      fireEvent.change(input, { target: { files: [backupFile] } })

      const dialog = await screen.findByRole('dialog', {
        name: 'Restaurer cette sauvegarde ?',
      })
      expect(dialog).toHaveTextContent('Toutes les données actuelles seront remplacées.')
      expect(dialog).toHaveTextContent(/2 élèves/)
      expect(dialog).toHaveTextContent(/2 réussites/)
      expect(dialog).toHaveTextContent(/1 photo/)

      await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )

      expect((await db.students.toArray()).map((student) => student.firstName)).toEqual([
        'Nina',
      ])
      expect(await db.validations.count()).toBe(0)
      expect(await db.photos.count()).toBe(0)

      // Le même fichier peut être réimporté : l'input est remis à zéro.
      fireEvent.change(input, { target: { files: [backupFile] } })
      const secondDialog = await screen.findByRole('dialog', {
        name: 'Restaurer cette sauvegarde ?',
      })
      await user.click(
        within(secondDialog).getByRole('button', {
          name: 'Restaurer la sauvegarde',
        }),
      )

      expect(await screen.findByText('Sauvegarde restaurée.')).toBeInTheDocument()
      await waitFor(async () => {
        expect(await db.students.count()).toBe(2)
        expect(await db.validations.count()).toBe(2)
        expect(await db.photos.count()).toBe(1)
      })
    },
    30_000,
  )

  it('affiche « Jamais sauvegardé » et le total de réussites avant la première sauvegarde', async () => {
    await db.students.add(makeStudent({ firstName: 'Léa' }))
    await createValidation({
      studentId: (await db.students.toArray())[0]!.id,
      objective: objectiveAt(0),
      ageBand: 'from4',
      date: '2026-10-12',
      referentialVersion: REFERENTIAL_VERSION,
    })

    renderApp({ route: '/settings' })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sauvegarde' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Jamais sauvegardé')).toBeInTheDocument()
    expect(await screen.findByText('1 réussite')).toBeInTheDocument()
    expect(
      await screen.findByText(/Il est temps de sauvegarder/i),
    ).toBeInTheDocument()
  })
})
