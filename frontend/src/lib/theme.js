import { normalizeOutcome } from '@/types'

// Night-sky tokens. Everything color-related in the app comes from here or from the CSS variables in index.css.
// surface, surfaceRaised and textMuted are derived from bg/heading/body (not part of the given palette).
export const sky = {
  bg: '#191816',
  surface: '#242320',
  surfaceRaised: '#2D2B29',
  border: 'rgba(244, 239, 229, 0.10)',
  heading: '#F4EFE5',
  body: '#BDB6AA',
  textMuted: '#9F9A8F',
  stars: '#F4EFE5',
}

// Accent: only for "new / from Dropbox".
export const gold = {
  color: '#E5C07B',
  glow: 'rgba(229, 192, 123, 0.35)',
}

// Palette star colors. Not applied anywhere yet.
export const pinkStar = '#D79BA7'

export const button = {
  bg: '#F4EFE5',
  text: '#191816',
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
  club: { size: 24, shape: 'star', labelVisible: 'always' }, // tint: outcomeColor(first outcome)
  event: { size: 10, background: sky.textMuted, labelVisible: 'hover' },
  eventDropbox: {
    size: 10,
    background: gold.color,
    boxShadow: `0 0 12px 4px ${gold.glow}`,
    labelVisible: 'hover',
  },
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

// Motion (ms). Nothing animates longer than 1.5s except the new-event pulse.
export const motion = {
  fast: 150,
  base: 250,
  slow: 600,
  pulse: 2000,
}
