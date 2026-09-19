// Live events from GET /events, and how arrivals merge into what the student already sees.
// Same display rules as the club panel (lib/club.js): published only, a title and a valid start, not over yet,
// and every field goes through toEventLite (scrubbed title/location, web links only, no description).

import { UPCOMING_LIMIT, toEventLite } from './club'
import { timeOf } from './format'

/**
 * @typedef {import('@/types').LiveEvent & { end: string | null, rsvp_url: string | null, arrival?: boolean }} LiveEvent
 */

/**
 * A raw GET /events row, or null when it must not be shown.
 * @param {any} raw
 * @param {Date} [now]
 * @returns {LiveEvent | null}
 */
export function toLiveEvent(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object' || raw.id == null || raw.club_id == null) return null
  if (raw.status != null && raw.status !== 'published') return null
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null
  const start = timeOf(raw.start)
  if (Number.isNaN(start)) return null
  const end = timeOf(raw.end)
  if ((Number.isNaN(end) ? start : end) < now.getTime()) return null
  const ev = toEventLite(raw)
  if (!ev.title) return null
  return { ...ev, club_id: String(raw.club_id) }
}

/**
 * @param {unknown} rows GET /events body
 * @param {Date} [now]
 * @returns {LiveEvent[]}
 */
export function toLiveEvents(rows, now = new Date()) {
  return (Array.isArray(rows) ? rows : []).map((r) => toLiveEvent(r, now)).filter(Boolean)
}

/**
 * What makes an event "new" to the student: a new id, or a known id whose file or time changed
 * (newest file wins: a club fixing its poster updates the event in place).
 * @param {LiveEvent} ev
 */
export const signature = (ev) => `${ev.source_file ?? ''}|${ev.start}`

const byStart = (a, b) => timeOf(a.start) - timeOf(b.start)

/**
 * A ranked club with this session's arrivals applied. `next_event` becomes the soonest of the club's next event and
 * its arrivals (an arrival with the same id replaces the old version); arrivals that aren't the next event go in
 * `live_events` so they still get a star. Arrivals carry `arrival: true`.
 * @template {{ id: string | number, next_event?: any }} C
 * @param {C} club
 * @param {LiveEvent[]} arrivals
 * @returns {C | (C & { next_event: any, live_events: LiveEvent[] })}
 */
export function applyArrivals(club, arrivals) {
  const mine = arrivals.filter((a) => a.club_id === String(club.id)).map((a) => ({ ...a, arrival: true }))
  if (!mine.length) return club
  const current = club.next_event && typeof club.next_event === 'object' ? club.next_event : null
  const replaced = current && mine.some((a) => a.id === String(current.id))
  const candidates = [...(current && !replaced ? [current] : []), ...mine].sort(byStart)
  const next = candidates[0]
  return { ...club, next_event: next, live_events: mine.filter((a) => a !== next) }
}

/**
 * The club panel's Upcoming list with this session's arrivals merged in (same limit of 5, soonest first).
 * @param {import('./club').ClubDetail | null} detail
 * @param {LiveEvent[]} arrivals
 * @param {Date} [now]
 */
export function applyArrivalsToDetail(detail, arrivals, now = new Date()) {
  if (!detail) return detail
  const mine = arrivals.filter((a) => a.club_id === detail.id)
  if (!mine.length) return detail
  const byId = new Map(detail.events.map((e) => [e.id, e]))
  for (const a of mine) byId.set(a.id, a)
  const t = now.getTime()
  const events = [...byId.values()]
    .filter((e) => timeOf(e.end ?? e.start) >= t)
    .sort(byStart)
    .slice(0, UPCOMING_LIMIT)
  return { ...detail, events }
}
