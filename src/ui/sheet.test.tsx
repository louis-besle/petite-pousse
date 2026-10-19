import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ConfirmSheet } from './ConfirmSheet'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('ne rend rien quand elle est fermée', () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Ajouter un élève">
        <p>Contenu</p>
      </Sheet>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('expose un dialogue modal et place le focus à l’intérieur', () => {
    render(
      <Sheet open onClose={() => {}} title="Ajouter un élève">
        <p>Contenu</p>
      </Sheet>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Ajouter un élève' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('piège le focus dans le dialogue', async () => {
    const user = userEvent.setup()
    render(
      <Sheet open onClose={() => {}} title="Ajouter un élève">
        <input aria-label="Prénom" />
        <button type="button">Valider</button>
      </Sheet>,
    )

    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: 'Fermer' })
    const input = screen.getByLabelText('Prénom')
    const submit = screen.getByRole('button', { name: 'Valider' })

    // Depuis le panneau, Tab entre dans le dialogue.
    await user.tab()
    expect(close).toHaveFocus()

    input.focus()
    await user.tab()
    expect(submit).toHaveFocus()

    // Depuis le dernier élément, Tab revient au premier.
    await user.tab()
    expect(close).toHaveFocus()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    // Maj+Tab depuis le premier élément va au dernier.
    await user.tab({ shift: true })
    expect(submit).toHaveFocus()
  })

  it('ferme avec Échap', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Ajouter un élève">
        <p>Contenu</p>
      </Sheet>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ferme au clic sur le fond, mais pas dans la feuille', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Ajouter un élève">
        <p>Contenu</p>
      </Sheet>,
    )

    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('rend le focus au déclencheur à la fermeture', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Ajouter un élève
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Ajouter un élève">
            <p>Contenu</p>
          </Sheet>
        </>
      )
    }

    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Ajouter un élève' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

describe('ConfirmSheet', () => {
  it('annonce le titre, la description et les deux actions', () => {
    render(
      <ConfirmSheet
        open
        title="Supprimer Léa ?"
        description="Son dossier, ses 3 réussites et ses 2 photos seront supprimés définitivement."
        confirmLabel="Supprimer définitivement"
        tone="danger"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Supprimer Léa ?' })).toBeInTheDocument()
    expect(
      screen.getByText('Son dossier, ses 3 réussites et ses 2 photos seront supprimés définitivement.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer définitivement' })).toHaveAttribute(
      'data-variant',
      'danger',
    )
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveAttribute('data-variant', 'ghost')
  })

  it('appelle onConfirm puis onClose', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmSheet
        open
        title="Supprimer Léa ?"
        description="Suppression définitive."
        confirmLabel="Supprimer définitivement"
        tone="danger"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
