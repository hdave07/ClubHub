import { useEffect, useState } from 'react'
import { getClubs } from './api'
import { toDirectoryClub } from './directory'

/**
 * Every club for the Full Directory's browse list, fetched once. 250 rows is small enough to filter entirely
 * client-side (lib/directory.js) rather than adding query params to the backend.
 * @returns {{ clubs: ReturnType<typeof toDirectoryClub>[], loading: boolean, error: Error | null }}
 */
export function useAllClubs() {
  const [state, setState] = useState({ clubs: [], loading: true, error: null })

  useEffect(() => {
    const ctrl = new AbortController()
    getClubs({ signal: ctrl.signal })
      .then((rows) => setState({ clubs: (Array.isArray(rows) ? rows : []).map(toDirectoryClub), loading: false, error: null }))
      .catch((error) => {
        if (ctrl.signal.aborted) return
        setState({ clubs: [], loading: false, error })
      })
    return () => ctrl.abort()
  }, [])

  return state
}
