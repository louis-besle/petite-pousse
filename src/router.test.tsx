import { screen } from '@testing-library/react'
import { renderApp } from './test/render'

describe('routes', () => {
  it('affiche l’écran Programme sur /programme', () => {
    renderApp({ route: '/programme' })

    expect(screen.getByRole('heading', { level: 1, name: 'Programme' })).toBeInTheDocument()
  })

  it('affiche l’écran Bilans sur /bilans', () => {
    renderApp({ route: '/bilans' })

    expect(screen.getByRole('heading', { level: 1, name: 'Bilans' })).toBeInTheDocument()
  })

  it('masque la navigation sur /capture', () => {
    renderApp({ route: '/capture' })

    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument()
  })
})
