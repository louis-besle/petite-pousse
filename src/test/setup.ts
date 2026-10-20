import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { db } from '@/db/db'

// jsdom n'implémente pas `crypto.subtle` : les tests de chiffrement de
// sauvegarde utilisent l'implémentation WebCrypto de Node.
if (typeof window !== 'undefined' && globalThis.crypto?.subtle === undefined) {
  try {
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: webcrypto.subtle,
    })
  } catch {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    })
  }
}

// jsdom ne fournit ni `createObjectURL` ni `matchMedia`. Les tests Node
// (scripts/referential) n'ont pas de `window` : on ignore ce bloc.
if (typeof window !== 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// Chaque test part d'une base vide, ouverte sur le schéma courant, et d'URL
// de blobs sans historique d'appels.
beforeEach(async () => {
  if (typeof window !== 'undefined') {
    vi.mocked(URL.createObjectURL).mockClear()
    vi.mocked(URL.revokeObjectURL).mockClear()
  }

  await db.delete()
  await db.open()
})

afterEach(() => {
  cleanup()
  db.close()
})
