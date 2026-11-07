import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { NavBar } from './NavBar'

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavBar />
    </MemoryRouter>,
  )
}

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<p>Ma classe</p>} />
          <Route path="/programme" element={<p>Les six domaines</p>} />
          <Route path="/settings" element={<p>Mon profil</p>} />
          <Route path="/capture/*" element={<p>Capture en cours</p>} />
          <Route path="/success/:validationId" element={<p>C’est noté</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('NavBar', () => {
  it('expose les trois destinations de l’application', () => {
    renderNav('/')

    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(nav).getByRole('link', { name: 'Classe' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: 'Programme' })).toHaveAttribute(
      'href',
      '/programme',
    )
    expect(within(nav).getByRole('link', { name: 'Bilans' })).toHaveAttribute('href', '/bilans')
    expect(
      within(nav).queryByRole('link', { name: 'Profil' }),
    ).not.toBeInTheDocument()
  })

  it('marque le lien actif avec aria-current="page" sur /programme', () => {
    renderNav('/programme')

    expect(screen.getByRole('link', { name: 'Programme' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Classe' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Bilans' })).not.toHaveAttribute('aria-current')
  })

  it('marque Classe comme actif sur la racine', () => {
    renderNav('/')

    expect(screen.getByRole('link', { name: 'Classe' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Programme' })).not.toHaveAttribute('aria-current')
  })
})

describe('AppShell', () => {
  it('donne un titre de page à chaque route', () => {
    renderShell('/programme')

    expect(document.title).toBe('Programme · Petite pousse')
  })

  it('nomme l’onglet de profil dans le titre de page', () => {
    renderShell('/settings')

    expect(document.title).toBe('Profil · Petite pousse')
  })

  it('place le focus sur le contenu après un changement de route', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(screen.getByRole('link', { name: 'Programme' }))

    expect(await screen.findByText('Les six domaines')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('rend le contenu dans main#main et un lien d’évitement', async () => {
    const user = userEvent.setup()
    renderShell('/programme')

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main')
    expect(main).toHaveTextContent('Les six domaines')

    const skipLink = screen.getByRole('link', { name: /contenu principal/i })
    expect(skipLink).toHaveAttribute('href', '#main')

    await user.click(skipLink)
    expect(main).toHaveFocus()
  })

  it('affiche la navigation sur une route principale', () => {
    renderShell('/programme')

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
  })

  it.each(['/capture', '/capture/abc/photo', '/success/123'])(
    'masque la navigation sur %s',
    (path) => {
      renderShell(path)

      expect(
        screen.queryByRole('navigation', { name: 'Navigation principale' }),
      ).not.toBeInTheDocument()
    },
  )
})
