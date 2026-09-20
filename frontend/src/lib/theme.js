import { OUTCOME_LABELS, normalizeOutcome } from '@/types'

// Warm-neutral palette: charcoal, cream and gray. Hover and selected use neutrals only (surfaceRaised background,
// textMuted or cream border). The starlight-blue accent is reserved for the live Dropbox arrival, the arrival toast,
// the Dropbox provenance line and keyboard focus. Everything color-related comes from here or the CSS variables in index.css.
export const sky = {
  bg: '#181817', // page
  surface: '#201F1D', // cards and panels
  surfaceRaised: '#262522', // subtle secondary surface (hover, selected)
  border: '#383631', // hairlines and dividers
  heading: '#F2EEE6', // primary text
  body: '#F2EEE6',
  textMuted: '#AAA59B', // secondary text
  stars: '#F2EEE6', // used at low opacity for the star field
}

export const accent = {
  color: '#9DB4E0', // starlight blue
  muted: '#2C3038', // muted accent background
}

/**
 * One color per outcome, keyed by exactly what normalizeOutcome() returns (see types.js). Color always pairs with a
 * text label; it is never the only signal. `color` is text, rings and edges; `nodeTint` fills the graph node;
 * `pillBg` is the card and panel pill background. None of these is the Dropbox blue (accent.color).
 * @type {Record<import('@/types').Outcome, { color: string, nodeTint: string, pillBg: string }>}
 */
export const OUTCOME_COLORS = {
  make_friends: { color: '#E393A8', nodeTint: '#3A2A2E', pillBg: '#33272A' }, // Make friends
  culture: { color: '#DB8A6E', nodeTint: '#3A2C25', pillBg: '#332823' }, // Culture and identity
  give_back: { color: '#E6AD7E', nodeTint: '#3A3025', pillBg: '#332B23' }, // Give back
  build_skills: { color: '#C2C47C', nodeTint: '#33342A', pillBg: '#2E2F26' }, // Build skills/portfolio
  wellness: { color: '#93C495', nodeTint: '#2A342B', pillBg: '#262F27' }, // Wellness and recreation
  career: { color: '#72C2B8', nodeTint: '#253433', pillBg: '#222F2D' }, // Career and networking
  academic: { color: '#B39DE0', nodeTint: '#2F2B3A', pillBg: '#2A2733' }, // Academic/research
  leadership: { color: '#D39BD8', nodeTint: '#352A36', pillBg: '#302630' }, // Leadership
}

const NEUTRAL_OUTCOME = { color: '#AAA59B', nodeTint: '#262522', pillBg: '#262522' }

/**
 * Colors for an outcome key. Unknown or missing keys get neutral gray, so bad data never crashes and never
 * shows the Dropbox blue.
 * @param {string | null | undefined} key
 */
export function outcomeColor(key) {
  return (key != null && Object.hasOwn(OUTCOME_COLORS, key) ? OUTCOME_COLORS[key] : null) ?? NEUTRAL_OUTCOME
}

// Dev only: every outcome in the plan (types.js OUTCOME_LABELS, which mirrors the backend's FIXED_OUTCOMES) must resolve
// to a real color from its key AND from its label, and none may collide with the Dropbox blue. Stripped from production.
if (import.meta.env.DEV) {
  for (const [key, label] of Object.entries(OUTCOME_LABELS)) {
    for (const input of [key, label]) {
      const resolved = normalizeOutcome(input)
      const c = resolved && Object.hasOwn(OUTCOME_COLORS, resolved) ? OUTCOME_COLORS[resolved] : null
      if (!c) console.error(`[theme] outcome "${input}" has no color (normalizes to ${resolved})`)
      else if (Object.values(c).some((v) => v.toLowerCase() === accent.color.toLowerCase())) {
        console.error(`[theme] outcome "${input}" uses the Dropbox blue`)
      }
    }
  }
}

export const button = {
  bg: '#F2EEE6',
  text: '#181817',
}

// React Flow node sizes in px. The layout centers nodes using these.
export const nodeStyles = {
  you: { size: 28 },
  outcome: { size: 20 }, // the most prominent node after You
  club: { size: 7 }, // supporting
  event: { size: 5 }, // quietest layer
}

/**
 * @param {string | null | undefined} last_updated ISO date
 * @returns {number} 1.0 (<=7 days), 0.75 (<=30 days), 0.65 (older or missing)
 */
export function clubBrightness(last_updated) {
  const t = last_updated ? Date.parse(last_updated) : NaN
  if (Number.isNaN(t)) return 0.65
  const days = (Date.now() - t) / 86_400_000
  if (days <= 7) return 1.0
  if (days <= 30) return 0.75
  return 0.65
}

// Motion (ms). Nothing animates longer than 1.5s except the one-off arrival highlight for a new Dropbox event
// (fade in 300 + hold 3000 + fade out 600). That duration is mirrored in the .arrival class in index.css.
export const motion = {
  fast: 150,
  base: 250,
  slow: 600,
  arrival: 3900,
}
