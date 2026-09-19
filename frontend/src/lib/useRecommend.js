import { useCallback, useRef, useState } from 'react'
import { recommend } from './api'

/**
 * Wraps recommend() from api.js. `graph` is null when the backend doesn't send one.
 * @returns {{ data: object | null, loading: boolean, error: Error | null, run: (blurb: string) => Promise<void>, retry: () => Promise<void> }}
 */
export function useRecommend() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastBlurb = useRef('')
  const requestId = useRef(0)

  const run = useCallback(async (blurb) => {
    lastBlurb.current = blurb
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const res = await recommend(blurb)
      if (id !== requestId.current) return // a newer request superseded this one
      setData({ ...res, graph: res.graph ?? null })
    } catch (e) {
      if (id !== requestId.current) return
      setError(e)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  const retry = useCallback(() => run(lastBlurb.current), [run])

  return { data, loading, error, run, retry }
}
