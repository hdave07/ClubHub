// "Your map": clubs the student manually added (from the Full Directory) or removed (from their matches),
// on top of whatever /recommend returned. No auth/backend (main plan: auth is roadmap only), so this lives
// entirely in the browser -- localStorage for persistence across reloads, a BroadcastChannel (falling back to
// the storage event) so the Full Directory tab and the main constellation tab stay in sync live. Same
// localStorage-as-state pattern App.jsx already uses for the blurb input.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'campus-compass:myClubs'
const CHANNEL_NAME = 'campus-compass:my-clubs'

const EMPTY = { added: [], removedIds: [], mapSize: 0 }

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (raw && typeof raw === 'object') {
      return {
        added: Array.isArray(raw.added) ? raw.added.filter((c) => c && c.id != null) : [],
        removedIds: Array.isArray(raw.removedIds) ? raw.removedIds.map(String) : [],
        mapSize: Number.isFinite(raw.mapSize) ? raw.mapSize : 0,
      }
    }
  } catch {
    // storage unavailable or corrupt: start empty
  }
  return EMPTY
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: the tab still works from in-memory state
  }
}

let channel = null
try {
  channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null
} catch {
  channel = null
}

/**
 * Your manual adds/removes, synced across the main tab and the Full Directory tab.
 * `mapSize` is written by the main tab (the only one that knows the true, merged club count) so the
 * Directory tab can disable "Add" once the map is full without needing the full match list itself.
 * @returns {{
 *   addedClubs: object[], removedIds: Set<string>, mapSize: number,
 *   isAdded: (id: string) => boolean,
 *   addClub: (club: object) => void, removeClub: (id: string) => void, undoRemove: (id: string) => void,
 *   setMapSize: (n: number) => void,
 * }}
 */
export function useMyClubs() {
  const [state, setState] = useState(load)
  // Set right before setState for a change that arrived FROM another tab, so the effect below can tell "I just
  // changed locally" from "I just applied someone else's broadcast" and only re-broadcast the former. Without
  // this, both tabs re-broadcast every change they receive (postMessage always clones into a new object, so
  // React never bails out via reference equality) and the two tabs ping-pong the same update forever.
  const receivedRef = useRef(false)

  useEffect(() => {
    save(state)
    if (receivedRef.current) {
      receivedRef.current = false
      return
    }
    try {
      channel?.postMessage(state)
    } catch {
      // ignore
    }
  }, [state])

  useEffect(() => {
    const onMessage = (e) => {
      receivedRef.current = true
      setState(e.data)
    }
    channel?.addEventListener('message', onMessage)
    // Fallback for tabs/browsers a BroadcastChannel message doesn't reach. The storage event only ever fires in
    // OTHER tabs and only when the value actually changed, so it doesn't need the same echo guard.
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setState(load())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      channel?.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const addClub = useCallback((club) => {
    if (club?.id == null) return
    const id = String(club.id)
    setState((prev) =>
      prev.added.some((c) => String(c.id) === id)
        ? prev
        : { ...prev, added: [...prev.added, { ...club, id }], removedIds: prev.removedIds.filter((r) => r !== id) },
    )
  }, [])

  const removeClub = useCallback((id) => {
    const cid = String(id)
    setState((prev) => {
      const wasAdded = prev.added.some((c) => String(c.id) === cid)
      if (wasAdded) return { ...prev, added: prev.added.filter((c) => String(c.id) !== cid) }
      if (prev.removedIds.includes(cid)) return prev
      return { ...prev, removedIds: [...prev.removedIds, cid] }
    })
  }, [])

  const undoRemove = useCallback((id) => {
    const cid = String(id)
    setState((prev) =>
      prev.removedIds.includes(cid) ? { ...prev, removedIds: prev.removedIds.filter((r) => r !== cid) } : prev,
    )
  }, [])

  const setMapSize = useCallback((n) => {
    setState((prev) => (prev.mapSize === n ? prev : { ...prev, mapSize: n }))
  }, [])

  // Stable across renders unless the underlying ids actually change: applyMyClubs is called from a useMemo
  // downstream (Constellation.jsx), and a fresh Set every render would defeat that memoization on every render.
  const removedIds = useMemo(() => new Set(state.removedIds), [state.removedIds])
  const isAdded = useCallback((id) => state.added.some((c) => String(c.id) === String(id)), [state.added])

  return {
    addedClubs: state.added,
    removedIds,
    mapSize: state.mapSize,
    isAdded,
    addClub,
    removeClub,
    undoRemove,
    setMapSize,
  }
}

/**
 * A matched-clubs list plus the user's manual adds/removes: removed ids drop out, added clubs not already
 * present are appended (tagged `_addedByUser` for the "Added by you" badge and buildGraph's outcome handling).
 * @param {object[]} matched
 * @param {{ addedClubs: object[], removedIds: Set<string> }} myClubs
 */
export function applyMyClubs(matched, { addedClubs, removedIds }) {
  const kept = matched.filter((c) => !removedIds.has(String(c.id)))
  const keptIds = new Set(kept.map((c) => String(c.id)))
  const extra = addedClubs.filter((c) => !keptIds.has(String(c.id))).map((c) => ({ ...c, _addedByUser: true }))
  return [...kept, ...extra]
}
