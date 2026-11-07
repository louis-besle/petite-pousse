import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './icons'
import styles from './NavBar.module.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const ITEMS: NavItem[] = [
  { to: '/', label: 'Classe', icon: 'users', end: true },
  { to: '/programme', label: 'Programme', icon: 'grid' },
  { to: '/bilans', label: 'Bilans', icon: 'file' },
]

/** Navigation basse : Classe / Programme / Bilans, actif en encre. */
export function NavBar() {
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [styles.link, isActive ? styles.active : ''].filter(Boolean).join(' ')
          }
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
