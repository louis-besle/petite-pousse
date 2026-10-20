import { renderHook, waitFor } from '@testing-library/react'
import type { CaptureDraft } from '@/domain/types'
import { db } from './db'
import {
  clearCaptureDraft,
  getCaptureDraft,
  saveCaptureDraft,
  useCaptureDraft,
} from './drafts'

function makeDraft(studentId: string): CaptureDraft {
  return {
    id: 'current',
    studentId,
    createdAt: '2026-11-01T10:00:00.000Z',
  }
}

describe('capture drafts', () => {
  it('enregistre puis relit le brouillon courant', async () => {
    await saveCaptureDraft(makeDraft('student-1'))

    expect(await getCaptureDraft()).toEqual(makeDraft('student-1'))
  })

  it('remplace la ligne unique au lieu d’en créer une seconde', async () => {
    await saveCaptureDraft(makeDraft('student-1'))
    await saveCaptureDraft(makeDraft('student-2'))

    expect((await getCaptureDraft())?.studentId).toBe('student-2')
    expect(await db.drafts.count()).toBe(1)
  })

  it('efface le brouillon', async () => {
    await saveCaptureDraft(makeDraft('student-1'))

    await clearCaptureDraft()

    expect(await getCaptureDraft()).toBeUndefined()
  })

  it('expose le brouillon en réactif', async () => {
    const { result } = renderHook(() => useCaptureDraft())

    await waitFor(() => expect(result.current).toBeUndefined())
    await saveCaptureDraft(makeDraft('student-3'))
    await waitFor(() => expect(result.current?.studentId).toBe('student-3'))

    await clearCaptureDraft()
    await waitFor(() => expect(result.current).toBeUndefined())
  })
})
