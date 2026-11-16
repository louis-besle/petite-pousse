import { Field } from './Field'
import { Icon } from './icons'

export interface SearchFieldProps {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

/** Champ de recherche : icône loupe, saisie contrôlée, clavier « recherche ». */
export function SearchField({ label, placeholder, value, onChange }: SearchFieldProps) {
  return (
    <Field
      type="search"
      label={label}
      icon={<Icon name="search" size={17} />}
      placeholder={placeholder}
      value={value}
      autoComplete="off"
      enterKeyHint="search"
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
