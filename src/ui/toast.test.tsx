import { act, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

function Trigger() {
  const { showToast } = useToast()
  return (
    <button type="button" onClick={() => showToast('Élève ajouté')}>
      Afficher le toast
    </button>
  )
}

function TwoTriggers() {
  const { showToast } = useToast()
  return (
    <>
      <button type="button" onClick={() => showToast('Premier message')}>
        Premier
      </button>
      <button type="button" onClick={() => showToast('Second message')}>
        Second
      </button>
    </>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // `fireEvent` plutôt que `userEvent` : sous horloge simulée, l'`asyncWrapper`
  // de Testing Library n'avance que les minuteurs de Jest et `userEvent`
  // resterait bloqué sur son `setTimeout(0)`.
  it('annonce le message puis le retire après 2,6 s', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le toast' }))

    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Élève ajouté')
    expect(toast).toHaveAttribute('aria-live', 'polite')

    act(() => {
      vi.advanceTimersByTime(2599)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Élève ajouté')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('remplace le message courant et relance le minuteur', () => {
    render(
      <ToastProvider>
        <TwoTriggers />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Premier' }))
    expect(screen.getByRole('status')).toHaveTextContent('Premier message')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    expect(screen.getByRole('status')).toHaveTextContent('Second message')

    // L'ancien minuteur est annulé : à 4 s depuis le premier message, le second est encore là.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Second message')

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('refuse d’être utilisé hors du provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Trigger />)).toThrow(/ToastProvider/)

    consoleError.mockRestore()
  })
})
