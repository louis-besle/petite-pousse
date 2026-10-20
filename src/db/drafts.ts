import { useLiveQuery } from 'dexie-react-hooks'
import type { CaptureDraft } from '@/domain/types'
import { db } from './db'

/** Clé fixe du brouillon : un seul parcours de capture à la fois. */
export const CAPTURE_DRAFT_ID = 'current' as const

/** Lit le brouillon en cours, ou `undefined` s'il n'y en a pas. */
export async function getCaptureDraft(): Promise<CaptureDraft | undefined> {
  return db.drafts.get(CAPTURE_DRAFT_ID)
}

/** Enregistre le brouillon courant, en remplaçant la ligne existante. */
export async function saveCaptureDraft(draft: CaptureDraft): Promise<void> {
  await db.drafts.put(draft)
}

/** Supprime le brouillon. À réserver au moment où la réussite est créée. */
export async function clearCaptureDraft(): Promise<void> {
  await db.drafts.delete(CAPTURE_DRAFT_ID)
}

/**
 * Brouillon réactif. `undefined` pendant le chargement **et** quand aucun
 * brouillon n'existe : un écran qui doit distinguer les deux fait d'abord une
 * lecture explicite avec `getCaptureDraft()`.
 */
export function useCaptureDraft(): CaptureDraft | undefined {
  return useLiveQuery(async () => db.drafts.get(CAPTURE_DRAFT_ID), [])
}
