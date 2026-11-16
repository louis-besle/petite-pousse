import { useLiveQuery } from 'dexie-react-hooks'

export interface GuardedQueryResult<T> {
  data: T | undefined
  error: boolean
}

/**
 * `useLiveQuery` dont une lecture rejetée devient un drapeau d'erreur au lieu
 * d'être relancée au rendu (qui ferait tomber l'écran).
 *
 * `data` reste `undefined` pendant le chargement initial et après un échec ;
 * `error` ne passe à vrai qu'une fois la lecture rejetée.
 */
export function useGuardedLiveQuery<T>(
  query: () => Promise<T>,
  deps: readonly unknown[],
  logMessage: string,
): GuardedQueryResult<T> {
  const result = useLiveQuery(async () => {
    try {
      return { data: await query(), error: false }
    } catch (error) {
      console.error(logMessage, error)
      return { data: undefined, error: true }
    }
  }, [...deps])

  return result ?? { data: undefined, error: false }
}
