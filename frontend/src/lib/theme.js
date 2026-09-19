// Warm-neutral palette: overwhelmingly charcoal, cream and gray. Gold is the one meaningful accent
// (selected, hovered, active). Everything color-related comes from here or from the CSS variables in index.css.
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

export const gold = {
  color: '#D8B56A',
  muted: '#3A3221', // muted accent background
  glow: 'rgba(216, 181, 106, 0.35)', // only for the Dropbox-moment pulse
}

// Optional secondary accent. Use sparingly.
export const sage = '#A9B79E'

export const button = {
  bg: '#F2EEE6',
  text: '#181817',
}

// React Flow node sizes in px. The layout centers nodes using these.
export const nodeStyles = {
  you: { size: 28 },
  outcome: { size: 12 },
  club: { size: 9 },
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
