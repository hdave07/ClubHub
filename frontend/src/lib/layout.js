import { nodeStyles } from '@/lib/theme'

const OUTCOME_RING = 140
const CLUB_RING = 270
const EVENT_OFFSET = 55
const MIN_GAP = 22 // degrees between neighboring clubs

const round = (n) => Math.round(n * 1000) / 1000
const norm = (a) => ((((a + 90) % 360) + 360) % 360) - 90 // [-90, 270)

function circularMean(angles) {
  const rad = angles.map((a) => (a * Math.PI) / 180)
  const x = rad.reduce((s, r) => s + Math.cos(r), 0)
  const y = rad.reduce((s, r) => s + Math.sin(r), 0)
  if (Math.hypot(x, y) < 1e-9) return null
  return norm((Math.atan2(y, x) * 180) / Math.PI)
}

/**
 * Deterministic radial layout: you at the center, outcomes on a ring, clubs on a wider ring, events just beyond their club.
 * @param {Array<{ id: string, type: string }>} nodes
 * @param {Array<{ source: string, target: string }>} edges
 * @returns nodes with React Flow positions (top-left, so the node is centered on its point)
 */
export function radialLayout(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const neighbors = (id) =>
    edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => byId.get(e.source === id ? e.target : e.source))
      .filter(Boolean)

  const angle = new Map()

  const outcomes = nodes.filter((n) => n.type === 'outcome')
  outcomes.forEach((n, i) => angle.set(n.id, -90 + (360 * i) / outcomes.length))

  const clubs = nodes.filter((n) => n.type === 'club')
  const seeded = clubs
    .map((n, i) => {
      const parents = neighbors(n.id)
        .filter((m) => m.type === 'outcome')
        .map((m) => angle.get(m.id))
      const fallback = norm(-90 + (360 * i) / clubs.length)
      return { n, i, a: (parents.length ? circularMean(parents) : null) ?? fallback }
    })
    .sort((p, q) => p.a - q.a || p.i - q.i)

  // Spread neighbors to at least MIN_GAP apart, keeping their order (including across the wrap).
  const a = seeded.map((s) => s.a)
  if (a.length > 1) {
    for (let iter = 0; iter < 500; iter++) {
      let moved = false
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length
        const gap = j === 0 ? a[0] + 360 - a[i] : a[j] - a[i]
        if (gap < MIN_GAP - 1e-9) {
          const d = (MIN_GAP - gap) / 2
          a[i] -= d
          a[j] += d
          moved = true
        }
      }
      if (!moved) break
    }
  }
  seeded.forEach((s, k) => angle.set(s.n.id, a[k]))

  const point = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]

  return nodes.map((n) => {
    let cx = 0
    let cy = 0
    if (n.type === 'outcome') [cx, cy] = point(OUTCOME_RING, angle.get(n.id))
    else if (n.type === 'club') [cx, cy] = point(CLUB_RING, angle.get(n.id))
    else if (n.type === 'event') {
      const club = neighbors(n.id).find((m) => m.type === 'club')
      ;[cx, cy] = point(CLUB_RING + EVENT_OFFSET, club ? angle.get(club.id) : -90)
    }
    const size = nodeStyles[n.type].size
    return { ...n, position: { x: round(cx - size / 2), y: round(cy - size / 2) } }
  })
}
