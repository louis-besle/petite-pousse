import { render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallHint, useIsStandalone } from './InstallHint'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Mobile Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36'

const originalMatchMedia = window.matchMedia

/** Remplace `matchMedia` sans passer par `defineProperty` : le stub de `setup.ts`
 * n'est pas configurable, mais il est inscriptible. */
function setStandaloneMedia(matches: boolean): void {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function setNavigatorValue(name: string, value: unknown): void {
  Object.defineProperty(window.navigator, name, {
    configurable: true,
    value,
  })
}

function setUserAgent(userAgent: string): void {
  setNavigatorValue('userAgent', userAgent)
}

function setIsIosStandalone(standalone: boolean): void {
  setNavigatorValue('standalone', standalone)
}

function setIpadOs(): void {
  setNavigatorValue('platform', 'MacIntel')
  setNavigatorValue('maxTouchPoints', 2)
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
  Reflect.deleteProperty(window.navigator, 'userAgent')
  Reflect.deleteProperty(window.navigator, 'standalone')
  Reflect.deleteProperty(window.navigator, 'platform')
  Reflect.deleteProperty(window.navigator, 'maxTouchPoints')
})

describe('useIsStandalone', () => {
  it('retourne faux par défaut dans un navigateur ouvert', () => {
    setStandaloneMedia(false)

    const { result } = renderHook(() => useIsStandalone())

    expect(result.current).toBe(false)
  })

  it('retourne vrai quand display-mode: standalone correspond', () => {
    setStandaloneMedia(true)

    const { result } = renderHook(() => useIsStandalone())

    expect(result.current).toBe(true)
  })

  it('retourne vrai quand navigator.standalone est vrai (iOS)', () => {
    setStandaloneMedia(false)
    setIsIosStandalone(true)

    const { result } = renderHook(() => useIsStandalone())

    expect(result.current).toBe(true)
  })
})

describe('InstallHint', () => {
  it('affiche les étapes iOS pour un iPhone non installé', () => {
    setStandaloneMedia(false)
    setUserAgent(IPHONE_UA)
    setIsIosStandalone(false)

    render(<InstallHint />)

    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText(/Partager/)).toBeInTheDocument()
    expect(screen.getByText(/Sur l’écran d’accueil/)).toBeInTheDocument()
    expect(screen.getByText(/hors ligne/)).toBeInTheDocument()
  })

  it('affiche les étapes iOS sur un iPadOS 13+ déguisé en Mac', () => {
    setStandaloneMedia(false)
    setUserAgent(IPAD_DESKTOP_UA)
    setIpadOs()

    render(<InstallHint />)

    expect(screen.getByText(/Sur l’écran d’accueil/)).toBeInTheDocument()
  })

  it('reste masqué sur Android et sur ordinateur', () => {
    setStandaloneMedia(false)

    setUserAgent(ANDROID_UA)
    const android = render(<InstallHint />)
    expect(android.container).toBeEmptyDOMElement()
    android.unmount()

    setUserAgent(DESKTOP_UA)
    const desktop = render(<InstallHint />)
    expect(desktop.container).toBeEmptyDOMElement()
  })

  it('reste masqué quand l’application est déjà installée', () => {
    setStandaloneMedia(true)
    setUserAgent(IPHONE_UA)
    setIsIosStandalone(true)

    const { container } = render(<InstallHint />)

    expect(container).toBeEmptyDOMElement()
  })
})
