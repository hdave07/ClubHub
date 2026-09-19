const TZ = 'America/Toronto'
const DAY_MS = 86_400_000

// A date-time with no Z or offset, e.g. "2026-09-24T22:00:00". The backend stores UTC but can serialize it without
// the Z, and new Date() would then read it as the viewer's local time (a 6 PM event showing as 10 PM).
const NO_OFFSET = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

/**
 * The API's datetimes are UTC. Adds the missing "Z" to an offset-less date-time; anything else is returned as is.
 * Harmless once the backend sends offsets.
 * @param {unknown} iso
 * @returns {string | null}
 */
export function toUtcIso(iso) {
  if (typeof iso !== 'string' || !iso) return null
  const s = iso.trim().replace(' ', 'T')
  return NO_OFFSET.test(s) ? `${s}Z` : s
}

/**
 * Milliseconds since the epoch for an API datetime (UTC when no offset is given); NaN for invalid input.
 * @param {unknown} iso
 */
export function timeOf(iso) {
  const s = toUtcIso(iso)
  return s ? Date.parse(s) : Number.NaN
}

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/**
 * "Thu 6 PM" (or "Thu 6:30 PM") in America/Toronto; "Thu Sep 24 · 6 PM" when more than 6 days away.
 * @param {string} iso offset-less values are read as UTC (toUtcIso)
 * @param {Date} [now]
 * @returns {string | null} null for invalid input
 */
export function formatEventTime(iso, now = new Date()) {
  const t = timeOf(iso)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  const p = Object.fromEntries(formatter.formatToParts(d).map((x) => [x.type, x.value]))
  const time = p.minute === '00' ? `${p.hour} ${p.dayPeriod}` : `${p.hour}:${p.minute} ${p.dayPeriod}`
  const far = d.getTime() - now.getTime() > 6 * DAY_MS
  return far ? `${p.weekday} ${p.month} ${p.day} · ${time}` : `${p.weekday} ${time}`
}
