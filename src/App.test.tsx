import { render, screen } from '@testing-library/react'
import { App } from './App'

it('affiche le nom de l’application', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Carnet de réussites' })).toBeInTheDocument()
})
