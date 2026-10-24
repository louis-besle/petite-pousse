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
import { exportBackup, readBackup } from './backup'

const PASSWORD = 'mot-de-passe-solide'

/** Même précaution que les tests de photos : NodeBlob survit à IndexedDB. */
function jpegBlob(content: string): Blob {
  return new NodeBlob(
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), content],
    { type: 'image/jpeg' },
  ) as unknown as Blob
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
  return new File([bytes], 'petite-pousse-backup.zip', {
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

  it('demande confirmation avant de lire un ZIP de plus de 300 Mo', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/settings' })

    await screen.findByRole('heading', { level: 2, name: 'Sauvegarde' })
    const input = screen.getByLabelText('Fichier de sauvegarde ZIP')

    const hugeFile = new File([new Uint8Array([1])], 'gros.zip', {
      type: 'application/zip',
    })
    Object.defineProperty(hugeFile, 'size', {
      configurable: true,
      value: 301 * 1024 * 1024,
    })

    fireEvent.change(input, { target: { files: [hugeFile] } })

    const dialog = await screen.findByRole('dialog', {
      name: 'Importer une grosse sauvegarde ?',
    })
    expect(dialog).toHaveTextContent(/300 Mo/)

    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

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

  it(
    'exporte une sauvegarde chiffrée avec un nom de fichier dédié',
    async () => {
      await db.students.add(makeStudent({ firstName: 'Léa' }))
      const user = userEvent.setup()
      renderApp({ route: '/settings' })

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Sauvegarde' }),
      ).toBeInTheDocument()

      const exportButton = screen.getByRole('button', {
        name: 'Exporter une sauvegarde',
      })
      await waitFor(() => expect(exportButton).toBeEnabled())

      await user.click(
        screen.getByRole('checkbox', { name: 'Protéger par un mot de passe' }),
      )
      await user.type(screen.getByLabelText('Mot de passe'), PASSWORD)
      await user.type(
        screen.getByLabelText('Confirmer le mot de passe'),
        PASSWORD,
      )

      await user.click(
        screen.getByRole('button', { name: 'Afficher le mot de passe' }),
      )
      expect(screen.getByLabelText('Mot de passe')).toHaveAttribute(
        'type',
        'text',
      )

      const createObjectURL = vi.mocked(URL.createObjectURL)
      createObjectURL.mockClear()

      let suggestedName = ''
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          suggestedName = this.download
        })

      try {
        await user.click(exportButton)
        await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
      } finally {
        clickSpy.mockRestore()
      }

      expect(suggestedName).toMatch(
        /^petite-pousse-backup-\d{4}-\d{2}-\d{2}-chiffre\.zip$/,
      )

      const blob = createObjectURL.mock.calls[0]![0] as Blob
      const backup = await readBackup(
        await asZipFile(blob),
        () => {},
        PASSWORD,
      )
      expect(backup.summary.encrypted).toBe(true)
      expect(backup.summary.students).toBe(1)
    },
    30_000,
  )

  it('désactive l’export tant que le mot de passe est trop court ou différent', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/settings' })

    await screen.findByRole('heading', { level: 2, name: 'Sauvegarde' })
    const exportButton = screen.getByRole('button', {
      name: 'Exporter une sauvegarde',
    })
    const protectCheckbox = screen.getByRole('checkbox', {
      name: 'Protéger par un mot de passe',
    })
    await waitFor(() => expect(protectCheckbox).toBeEnabled())

    await user.click(protectCheckbox)
    await user.type(screen.getByLabelText('Mot de passe'), 'court')

    expect(await screen.findByText(/au moins 8 caractères/)).toBeInTheDocument()
    expect(exportButton).toBeDisabled()

    await user.clear(screen.getByLabelText('Mot de passe'))
    await user.type(screen.getByLabelText('Mot de passe'), PASSWORD)
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      'autre-mot-de-passe',
    )

    expect(
      await screen.findByText(/ne correspondent pas/),
    ).toBeInTheDocument()
    expect(exportButton).toBeDisabled()

    await user.clear(screen.getByLabelText('Confirmer le mot de passe'))
    await user.type(
      screen.getByLabelText('Confirmer le mot de passe'),
      PASSWORD,
    )
    expect(exportButton).toBeEnabled()
  })

  it(
    'demande le mot de passe à l’import et laisse réessayer après une erreur',
    async () => {
      const lea = makeStudent({ firstName: 'Léa', section: 'MS' })
      await db.students.add(lea)
      await createValidation({
        studentId: lea.id,
        objective: objectiveAt(0),
        ageBand: 'from4',
        date: '2026-10-12',
        referentialVersion: REFERENTIAL_VERSION,
      })

      const encryptedFile = await asZipFile(
        await exportBackup(() => {}, { password: PASSWORD }),
      )

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

      const user = userEvent.setup()
      renderApp({ route: '/settings' })

      await screen.findByRole('heading', { level: 2, name: 'Sauvegarde' })
      fireEvent.change(screen.getByLabelText('Fichier de sauvegarde ZIP'), {
        target: { files: [encryptedFile] },
      })

      const sheet = await screen.findByRole('dialog', {
        name: 'Sauvegarde chiffrée',
      })
      const passwordField = within(sheet).getByLabelText('Mot de passe')

      await user.type(passwordField, 'mauvais-mot-de-passe')
      await user.click(
        within(sheet).getByRole('button', { name: 'Lire la sauvegarde' }),
      )

      expect(await within(sheet).findByRole('alert')).toHaveTextContent(
        /mot de passe est incorrect/i,
      )
      expect(
        screen.getByRole('dialog', { name: 'Sauvegarde chiffrée' }),
      ).toBeInTheDocument()

      await user.clear(passwordField)
      await user.type(passwordField, PASSWORD)
      await user.click(
        within(sheet).getByRole('button', { name: 'Lire la sauvegarde' }),
      )

      const confirm = await screen.findByRole('dialog', {
        name: 'Restaurer cette sauvegarde ?',
      })
      expect(confirm).toHaveTextContent('Sauvegarde chiffrée')
      await user.click(
        within(confirm).getByRole('button', {
          name: 'Restaurer la sauvegarde',
        }),
      )

      expect(await screen.findByText('Sauvegarde restaurée.')).toBeInTheDocument()
      await waitFor(async () => {
        expect(await db.students.count()).toBe(1)
        expect(await db.validations.count()).toBe(1)
      })
    },
    30_000,
  )
})
