import { screen, within } from '@testing-library/react'
import { renderApp } from './test/render'

it('affiche l’écran classe et la navigation sur la racine', () => {
  renderApp({ route: '/' })

  expect(screen.getByRole('heading', { level: 1, name: 'Bonjour, Maîtresse' })).toBeInTheDocument()

  const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
  expect(within(nav).getByRole('link', { name: 'Classe' })).toBeInTheDocument()
})
