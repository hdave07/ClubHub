import { useEffect, useRef, useState } from 'react'

const DISCOVERED_MS = 2500
const NONE = new Set()

/**
 * The state the results-page mascot shows.
 * - "scanning" while the /recommend request is in flight.
 * - "discovered" for 2.5 s when a live Dropbox arrival starts its highlight (a new id in `pulseIds`, the same trigger
 *   as the card and star highlight), then back to "idle". Another arrival restarts the timer. Ids leaving `pulseIds`
 *   when their highlight ends do not count.
 * @param {{ loading: boolean, pulseIds: Set<string> }} opts
 * @returns {'idle' | 'scanning' | 'discovered'}
 */
export function useMascotState({ loading, pulseIds }) {
  const [discovered, setDiscovered] = useState(false)
  const seen = useRef(NONE)
  const timer = useRef(0)

  useEffect(() => {
    const fresh = [...pulseIds].some((id) => !seen.current.has(id))
    seen.current = pulseIds
    if (!fresh) return
    setDiscovered(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDiscovered(false), DISCOVERED_MS)
  }, [pulseIds])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (discovered) return 'discovered'
  return loading ? 'scanning' : 'idle'
}
