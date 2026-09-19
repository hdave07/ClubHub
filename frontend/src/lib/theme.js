import { normalizeOutcome } from '@/types'

// Night-sky tokens. Everything color-related in the app comes from here or from the CSS variables in index.css.
export const sky = {
  bg: '#0B1026',
  surface: '#121A3A',
  surfaceRaised: '#1A2350',
  border: 'rgba(232, 236, 248, 0.10)',
  text: '#E8ECF8',
  textMuted: '#9AA3C0',
}

// Accent: only for "new / from Dropbox".
export const gold = {
  color: '#FCD34D',
  glow: 'rgba(252, 211, 77, 0.35)',
}

/** @type {Record<import('@/types').Outcome, string>} */
export const outcomeColors = {
  make_friends: '#FF8A7A',
  build_skills: '#60A5FA',
  career: '#34D399',
  leadership: '#A78BFA',
  give_back: '#F472B6',
  culture: '#FB923C',
  wellness: '#2DD4BF',
  academic: '#A3E635',
}

/**
 * @param {string} value outcome key or label
 * @returns {string} hex color; textMuted for unknown values
 */
export function outcomeColor(value) {
  const key = normalizeOutcome(value)
  return key ? outcomeColors[key] : sky.textMuted
}

// React Flow custom node styles (used in Sprint 5).
export const nodeStyles = {
  you: { size: 56, background: '#FFFFFF', boxShadow: '0 0 32px 12px rgba(255, 255, 255, 0.55)', labelVisible: 'always' },
  outcome: { size: 28, labelVisible: 'always' }, // background: outcomeColor(outcome)
  club: { size: 18, shape: 'star', labelVisible: 'always' }, // tint: outcomeColor(first outcome)
  event: { size: 8, background: sky.textMuted, labelVisible: 'hover' },
  eventDropbox: {
    size: 8,
    background: gold.color,
    boxShadow: `0 0 12px 4px ${gold.glow}`,
    labelVisible: 'hover',
  },
}

/**
 * @param {string | null | undefined} last_updated ISO date
 * @returns {number} 1.0 (<=7 days), 0.75 (<=30 days), 0.5 (older or missing)
 */
export function clubBrightness(last_updated) {
  const t = last_updated ? Date.parse(last_updated) : NaN
  if (Number.isNaN(t)) return 0.5
  const days = (Date.now() - t) / 86_400_000
  if (days <= 7) return 1.0
  if (days <= 30) return 0.75
  return 0.5
}

// Motion (ms). Nothing animates longer than 1.5s except the new-event pulse.
export const motion = {
  fast: 150,
  base: 250,
  slow: 600,
  pulse: 2000,
}
