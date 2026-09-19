import { useCallback, useEffect, useState } from 'react'
import { getClub } from './api'
import { sanitizeClub } from './club'

// Club details change rarely during a session; live Dropbox events are merged in by the live-updates work.
const cache = new Map()

/**
 * GET /clubs/:id for the selected club, sanitized for display (lib/club.js).
 * Stale responses are aborted when the selection changes. A 404 sets `notFound`, not an error the user sees.
 * @param {string | null} id
 * @param {{ enabled?: boolean }} [opts]
 * @returns {{ detail: import('./club').ClubDetail | null, loading: boolean, error: Error | null, notFound: boolean, retry: () => void }}
 */
export function useClub(id, { enabled = true } = {}) {
  const [result, setResult] = useState({ id: null, detail: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || id == null || cache.has(id)) return
    const ctrl = new AbortController()
    getClub(id, { signal: ctrl.signal })
      .then((raw) => {
        const detail = sanitizeClub(raw)
        cache.set(id, detail)
        setResult({ id, detail, error: null })
      })
      .catch((error) => {
        if (ctrl.signal.aborted) return
        setResult({ id, detail: null, error })
      })
    return () => ctrl.abort()
  }, [id, enabled, attempt])

  const retry = useCallback(() => {
    setResult({ id: null, detail: null, error: null })
    setAttempt((n) => n + 1)
  }, [])

  const cached = id != null ? cache.get(id) : undefined
  const mine = result.id === id ? result : null
  const detail = cached ?? mine?.detail ?? null
  const failure = !detail && mine?.error ? mine.error : null
  const notFound = failure?.response?.status === 404
  return {
    detail,
    loading: enabled && id != null && !detail && !failure,
    error: notFound ? null : failure,
    notFound,
    retry,
  }
}
