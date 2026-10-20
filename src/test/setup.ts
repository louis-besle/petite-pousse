import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { db } from '@/db/db'

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

// Chaque test part d'une base vide, ouverte sur le schéma courant.
beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  cleanup()
  db.close()
})
