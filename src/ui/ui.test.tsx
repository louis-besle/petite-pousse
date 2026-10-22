import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { Chip } from './Chip'
import { Field } from './Field'
import { FlowerMark } from './FlowerMark'
import { Icon } from './icons'
import { IconButton } from './IconButton'
import { SectionPill } from './SectionPill'

describe('Button', () => {
  it('expose sa variante et son état désactivé', () => {
    render(
      <Button variant="danger" disabled>
        Supprimer
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Supprimer' })
    expect(button).toHaveAttribute('data-variant', 'danger')
    expect(button).toBeDisabled()
  })

  it('appelle onClick au clic et expose la variante par défaut', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Valider</Button>)

    const button = screen.getByRole('button', { name: 'Valider' })
    expect(button).toHaveAttribute('data-variant', 'primary')

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche rien quand il est désactivé', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Enregistrer
      </Button>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('expose un libellé accessible et déclenche onClick', async () => {
    const onClick = vi.fn()
    render(
      <IconButton label="Retour" onClick={onClick}>
        <Icon name="back" />
      </IconButton>,
    )

    const button = screen.getByRole('button', { name: 'Retour' })
    expect(button).toHaveAttribute('aria-label', 'Retour')

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Chip', () => {
  it('annonce son état actif avec aria-pressed', () => {
    render(<Chip active>GS</Chip>)
    expect(screen.getByRole('button', { name: 'GS' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('annonce son état inactif avec aria-pressed', () => {
    render(<Chip>Toute la classe</Chip>)
    expect(screen.getByRole('button', { name: 'Toute la classe' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('Avatar', () => {
  it('affiche l’initiale et la section en toutes lettres', () => {
    render(<Avatar name="Léa" section="MS" />)

    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('MS')).toBeInTheDocument()
  })
})

describe('SectionPill', () => {
  it.each(['PS', 'MS', 'GS'] as const)('affiche la lettre %s', (section) => {
    render(<SectionPill section={section} />)
    expect(screen.getByText(section)).toBeInTheDocument()
  })
})

describe('Field', () => {
  it('associe son label à l’input et accepte la saisie', async () => {
    render(<Field label="Prénom de l’élève" placeholder="Rechercher un élève" />)

    const input = screen.getByLabelText('Prénom de l’élève')
    expect(input).toHaveAttribute('placeholder', 'Rechercher un élève')

    await userEvent.type(input, 'Léa')
    expect(input).toHaveValue('Léa')
  })

  it('transmet les props d’input et affiche une icône décorative', () => {
    render(
      <Field
        label="Rechercher"
        icon={<Icon name="search" />}
        type="search"
        value=""
        onChange={() => {}}
      />,
    )

    const input = screen.getByLabelText('Rechercher')
    expect(input).toHaveAttribute('type', 'search')
  })
})

describe('FlowerMark', () => {
  it('est décoratif et accepte une taille', () => {
    const { container } = render(<FlowerMark size={32} />)

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '32')
  })
})
