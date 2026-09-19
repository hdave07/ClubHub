import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

/**
 * @param {string} blurb
 * @returns {Promise<{outcomes: string[], clubs: Array<{id: string, name: string, summary: string, outcomes: string[], tags: string[], why_it_fits: string}>}>}
 */
export async function recommend(blurb) {
  const { data } = await api.post('/recommend', { blurb })
  return data
}

/**
 * GET /clubs/:id -> { club, events, similar }. The body is the raw database rows: `events` includes
 * pending_review ones and `club` has fields that must not be shown (e.g. description_raw).
 * Display it only through sanitizeClub (lib/club.js).
 * @param {string} id
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ club: object, events: object[], similar: object[] }>}
 */
export async function getClub(id, { signal } = {}) {
  const { data } = await api.get(`/clubs/${encodeURIComponent(id)}`, { signal })
  return data
}

/**
 * GET /events?since= -> published events starting at or after `since` (raw database rows).
 * The backend compares `since` with naive UTC columns, so it is sent as naive UTC ("2026-09-19T23:40:00").
 * Display only through toLiveEvents (lib/events.js).
 * @param {{ since?: Date, signal?: AbortSignal }} [opts]
 * @returns {Promise<object[]>}
 */
export async function getEvents({ since, signal } = {}) {
  const params = since ? { since: since.toISOString().slice(0, 19) } : undefined
  const { data } = await api.get('/events', { params, signal })
  return data
}
