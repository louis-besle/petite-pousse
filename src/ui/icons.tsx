import type { ReactNode } from 'react'

export type IconName =
  | 'back'
  | 'arrow'
  | 'camera'
  | 'search'
  | 'check'
  | 'users'
  | 'grid'
  | 'file'
  | 'chevron'
  | 'plus'
  | 'close'
  | 'trash'
  | 'pencil'
  | 'book'
  | 'shapes'
  | 'ball'
  | 'palette'
  | 'clock'
  | 'leaf'
  | 'download'

const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M15 5L8 12L15 19" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  camera: (
    <>
      <path d="M4 8.5C4 7.4 4.9 6.5 6 6.5H8L9.2 4.8C9.5 4.3 10 4 10.6 4H13.4C14 4 14.5 4.3 14.8 4.8L16 6.5H18C19.1 6.5 20 7.4 20 8.5V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V8.5Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16L20 20" />
    </>
  ),
  check: <path d="M6 12.5L10 16.5L18 8" />,
  users: (
    <>
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="7.5" r="3.5" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v4h4" />
      <path d="M10 12h6M10 16h4" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" />,
  pencil: (
    <>
      <path d="M4 20l4-1 11-11-3-3L5 16l-1 4Z" />
      <path d="M13.5 6.5l3 3" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5C7 4 10 4 12 6c2-2 5-2 8-.5V19c-3-1.5-6-1.5-8 0-2-1.5-5-1.5-8 0V5.5Z" />
      <path d="M12 6v13" />
    </>
  ),
  shapes: (
    <>
      <circle cx="8" cy="8" r="4" />
      <rect x="14" y="4" width="7" height="7" rx="1.6" />
      <path d="M8 14l4 6H4l4-6Z" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M5.5 8.5c4 3 9 3 13 0M6 16c3.5-3 8.5-3 12 0" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18h1.2a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h4a5 5 0 0 0 0-10h-4Z" />
      <circle cx="7.6" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="7.6" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C10 4 4 9 4 16c0 2 1 3 3 4 7 0 13-6 13-16Z" />
      <path d="M4 20c4-6 8-9 13-12" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 19h14" />
    </>
  ),
}

export interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
