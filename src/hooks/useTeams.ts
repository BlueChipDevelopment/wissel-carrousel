import { useEffect, useState } from 'react'
import { db, type Team } from '@/services/db'

let cache: Team[] | null = null
let inflight: Promise<Team[]> | null = null

/** Teams veranderen zelden; één keer laden en delen tussen alle components. */
export function useTeams() {
  const [teams, setTeams] = useState<Team[]>(cache ?? [])
  const [loading, setLoading] = useState(cache === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cache) return
    inflight ??= db.listTeams()
    let live = true
    inflight
      .then((t) => {
        cache = t
        if (live) setTeams(t)
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [])

  return { teams, loading, error }
}
