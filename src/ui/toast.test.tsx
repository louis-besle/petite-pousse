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

    // La région live existe avant le message : c'est ce qui garantit l'annonce.
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    expect(region).toHaveAttribute('aria-live', 'polite')

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le toast' }))

    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent('Élève ajouté')

    act(() => {
      vi.advanceTimersByTime(2599)
    })
    expect(region).toHaveTextContent('Élève ajouté')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(region).toBeEmptyDOMElement()
    expect(screen.getByRole('status')).toBe(region)
  })

  it('remplace le message courant et relance le minuteur', () => {
    render(
      <ToastProvider>
        <TwoTriggers />
      </ToastProvider>,
    )

    const region = screen.getByRole('status')

    fireEvent.click(screen.getByRole('button', { name: 'Premier' }))
    expect(region).toHaveTextContent('Premier message')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    expect(region).toHaveTextContent('Second message')

    // L'ancien minuteur est annulé : à 4 s depuis le premier message, le second est encore là.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(region).toHaveTextContent('Second message')

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(region).toBeEmptyDOMElement()
  })

  it('garde le même nœud de région live entre deux messages', () => {
    render(
      <ToastProvider>
        <TwoTriggers />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Premier' }))
    const firstRegion = screen.getByRole('status')
    expect(firstRegion).toHaveTextContent('Premier message')

    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    const secondRegion = screen.getByRole('status')

    expect(secondRegion).toBe(firstRegion)
    expect(secondRegion).toHaveTextContent('Second message')
  })

  it('refuse d’être utilisé hors du provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Trigger />)).toThrow(/ToastProvider/)

    consoleError.mockRestore()
  })
})
