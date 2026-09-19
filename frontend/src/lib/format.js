const TZ = 'America/Toronto'
const DAY_MS = 86_400_000

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
 * @param {string} iso
 * @param {Date} [now]
 * @returns {string | null} null for invalid input
 */
export function formatEventTime(iso, now = new Date()) {
  if (typeof iso !== 'string' || !iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = Object.fromEntries(formatter.formatToParts(d).map((x) => [x.type, x.value]))
  const time = p.minute === '00' ? `${p.hour} ${p.dayPeriod}` : `${p.hour}:${p.minute} ${p.dayPeriod}`
  const far = d.getTime() - now.getTime() > 6 * DAY_MS
  return far ? `${p.weekday} ${p.month} ${p.day} · ${time}` : `${p.weekday} ${time}`
}
