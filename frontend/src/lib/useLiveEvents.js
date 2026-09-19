import { useCallback, useEffect, useRef, useState } from 'react'
import { getEvents } from './api'
import { signature, toLiveEvent, toLiveEvents } from './events'

// Main plan demo: a dropped poster shows up "within about 10 seconds". The watcher polls Dropbox every 5s and
// extraction takes a few more, so this side polls often; it's a cheap SQLite read.
const POLL_MS = 3000
const MAX_BACKOFF_MS = 30_000
// Slightly longer than the one-shot .arrival animation (index.css), then the star and card go back to normal.
const PULSE_MS = 4200

const NO_PULSE = new Set()

/**
 * Polls GET /events for new Dropbox events while the results are on screen.
 * - The first successful poll is the baseline: nothing already there is announced.
 * - After that, a Dropbox event is an arrival when its id is new or its file/time changed (lib/events.js signature).
 * - Only arrivals for the student's result clubs are kept and highlighted.
 * - Pauses while the tab is hidden; backs off on errors (3s, 6s, ... up to 30s).
 * @param {{ clubIds: string[], enabled?: boolean }} opts
 * @returns {{
 *   arrivals: import('./events').LiveEvent[],
 *   pulseIds: Set<string>,
 *   latest: { seq: number, events: import('./events').LiveEvent[] },
 *   inject: (raw: object) => void,
 * }}
 * `pulseIds` holds graph event node ids ("event:88") for arrivals from the last few seconds. `latest` changes once
 * per batch of arrivals (for the toast). `inject` adds an event right away, e.g. from an in-app upload's response.
 */
export function useLiveEvents({ clubIds, enabled = true }) {
  const [arrivals, setArrivals] = useState([])
  const [pulseIds, setPulseIds] = useState(NO_PULSE)
  const [latest, setLatest] = useState({ seq: 0, events: [] })

  const seen = useRef(null) // Map<event id, signature>; null until the baseline poll
  const clubs = useRef(new Set())
  const timers = useRef(new Set())

  const clubKey = clubIds.map(String).join('|')
  useEffect(() => {
    clubs.current = new Set(clubKey ? clubKey.split('|') : [])
  }, [clubKey])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending) clearTimeout(t)
    }
  }, [])

  const announce = useCallback((events) => {
    const mine = events.filter((e) => clubs.current.has(e.club_id))
    if (!mine.length) return
    setArrivals((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]))
      for (const e of mine) byId.set(e.id, e)
      return [...byId.values()]
    })
    const ids = mine.map((e) => `event:${e.id}`)
    setPulseIds((prev) => new Set([...prev, ...ids]))
    const t = setTimeout(() => {
      timers.current.delete(t)
      setPulseIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next.size ? next : NO_PULSE
      })
    }, PULSE_MS)
    timers.current.add(t)
    setLatest((prev) => ({ seq: prev.seq + 1, events: mine }))
  }, [])

  const ingest = useCallback(
    (events) => {
      const prev = seen.current
      const next = new Map(prev ?? [])
      const fresh = []
      for (const ev of events) {
        const sig = signature(ev)
        if (prev && ev.source === 'dropbox' && prev.get(ev.id) !== sig) fresh.push(ev)
        next.set(ev.id, sig)
      }
      seen.current = next
      if (fresh.length) announce(fresh)
    },
    [announce],
  )

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let inFlight = false
    let timer
    let ctrl
    let delay = POLL_MS

    const schedule = (ms) => {
      clearTimeout(timer)
      if (!stopped) timer = setTimeout(tick, ms)
    }

    async function tick() {
      if (stopped || inFlight || document.hidden) return // hidden: visibilitychange resumes polling
      inFlight = true
      ctrl = new AbortController()
      try {
        const rows = await getEvents({ since: new Date(), signal: ctrl.signal })
        if (stopped) return
        ingest(toLiveEvents(rows))
        delay = POLL_MS
      } catch {
        if (stopped) return
        delay = Math.min(delay * 2, MAX_BACKOFF_MS)
      } finally {
        inFlight = false
      }
      schedule(delay)
    }

    const onVisibility = () => {
      if (!document.hidden) schedule(0)
    }

    tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      clearTimeout(timer)
      ctrl?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, ingest])

  const inject = useCallback(
    (raw) => {
      const ev = toLiveEvent(raw)
      if (!ev) return
      // Record it so the next poll doesn't announce it a second time.
      if (seen.current) seen.current.set(ev.id, signature(ev))
      announce([ev])
    },
    [announce],
  )

  return { arrivals, pulseIds, latest, inject }
}
