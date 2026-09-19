// Turns a raw GET /clubs/:id response into what the club panel may show.
// Everything is whitelisted field by field (main plan rules):
// - privacy: no organizer or contact fields, no email/phone links, and description_raw is never passed through
// - safety: only published events that have a title and a valid start
// Other fields that come back (confidence, status, sop ids) are dropped here.

const UPCOMING_LIMIT = 5
const CONTACT_KEY = /e-?mail|contact|phone|organi[sz]er|whatsapp/i

/** @param {unknown} v */
export function isHttpUrl(v) {
  if (typeof v !== 'string' || !v) return false
  try {
    const { protocol } = new URL(v)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** Same rule as the card: null or "limited info" means the limited-info state. */
export const isLimitedSummary = (summary) =>
  summary == null || (typeof summary === 'string' && summary.trim().toLowerCase() === 'limited info')

const validTime = (iso) => typeof iso === 'string' && !Number.isNaN(Date.parse(iso))

const EMAIL_LIKE = /\S+@\S+/
const PHONE_LIKE = /[+(]?\d[\d\s().-]{7,}\d/g

const hasContact = (sentence) =>
  EMAIL_LIKE.test(sentence) || (sentence.match(PHONE_LIKE) ?? []).some((m) => m.replace(/\D/g, '').length >= 10)

/**
 * Free text (summaries, meeting info, event titles) can have contact details typed into it. Any sentence that
 * contains an email address or a phone number (10+ digits) is dropped whole, plus a lead-in right before it that
 * ends in "?" or ":" (for example "Questions?"), so nothing dangles. Returns "" when nothing is left.
 * @param {string | null | undefined} text
 */
export function scrubText(text) {
  if (typeof text !== 'string') return text ?? null
  // Split after sentence-ending punctuation that is followed by whitespace, so dots inside addresses stay together.
  const parts = text.split(/([.!?]+(?:\s+|$))/)
  const sentences = []
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i] + (parts[i + 1] ?? '')
    if (sentence.trim()) sentences.push(sentence)
  }
  const kept = []
  for (const sentence of sentences) {
    if (!hasContact(sentence)) {
      kept.push(sentence)
      continue
    }
    if (/[?:]\s*$/.test(kept.at(-1)?.trim() ?? '')) kept.pop()
  }
  return kept.join('').trim()
}

/**
 * @param {any} ev raw backend Event row
 * @returns {import('@/types').EventLite & { end: string | null, rsvp_url: string | null }}
 */
export function toEventLite(ev) {
  return {
    id: String(ev.id),
    title: scrubText(ev.title),
    start: ev.start,
    end: validTime(ev.end) ? ev.end : null,
    location: scrubText(ev.location) || undefined,
    rsvp_url: isHttpUrl(ev.rsvp_url) ? ev.rsvp_url : null,
    source: ev.source === 'dropbox' ? 'dropbox' : 'sop',
    source_file: ev.source_file || undefined,
    dropbox_link: isHttpUrl(ev.dropbox_link) ? ev.dropbox_link : undefined,
  }
}

/**
 * Published, dated, not yet over; soonest first; at most 5.
 * @param {any[]} events
 * @param {Date} [now]
 */
export function upcomingEvents(events, now = new Date()) {
  const t = now.getTime()
  return (Array.isArray(events) ? events : [])
    .filter((ev) => ev && (ev.status == null || ev.status === 'published'))
    .filter((ev) => typeof ev.title === 'string' && ev.title.trim() && validTime(ev.start))
    .filter((ev) => Date.parse(validTime(ev.end) ? ev.end : ev.start) >= t)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, UPCOMING_LIMIT)
    .map(toEventLite)
    .filter((ev) => ev.title)
}

const humanize = (key) => {
  const s = String(key).replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * The SOP listing first, then the club's own links. Web links only; contact-like keys are skipped.
 * @param {any} club raw backend Club row
 * @returns {{ label: string, href: string }[]}
 */
export function clubLinks(club) {
  const out = []
  const seen = new Set()
  const add = (label, href) => {
    if (!isHttpUrl(href) || seen.has(href)) return
    seen.add(href)
    out.push({ label, href })
  }
  add('SOP listing', club?.sop_url)
  const links = club?.links && typeof club.links === 'object' && !Array.isArray(club.links) ? club.links : {}
  for (const [key, href] of Object.entries(links)) {
    if (CONTACT_KEY.test(key)) continue
    add(humanize(key), href)
  }
  return out
}

/**
 * @typedef {Object} ClubDetail
 * @property {string} id
 * @property {string | null} summary
 * @property {string | null} commitment
 * @property {string | null} meeting_info
 * @property {string | null} last_updated
 * @property {{ label: string, href: string }[]} links
 * @property {ReturnType<typeof upcomingEvents>} events
 */

/**
 * @param {{ club?: any, events?: any[] }} raw GET /clubs/:id body
 * @param {Date} [now]
 * @returns {ClubDetail}
 */
export function sanitizeClub(raw, now = new Date()) {
  const c = raw?.club ?? {}
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const text = (v) => str(scrubText(v))
  return {
    id: String(c.id ?? ''),
    summary: typeof c.summary === 'string' ? scrubText(c.summary) || null : null,
    commitment: str(c.commitment),
    meeting_info: text(c.meeting_info),
    last_updated: str(c.last_updated),
    links: clubLinks(c),
    events: upcomingEvents(raw?.events, now),
  }
}
