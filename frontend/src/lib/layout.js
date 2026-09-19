import { nodeStyles } from '@/lib/theme'

const OUTCOME_RING = 130
const CLUB_RING = 245
const EVENT_OFFSET = 34 // an event sits beside its club (along the ring), so it never collides with the club's label
const MIN_GAP = 26 // degrees between neighboring clubs
const SPREAD = 0.4 // how far clubs are pulled toward even spacing, so a cluster of clubs doesn't crowd one side

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

  // Pull clubs partway toward even spacing (order kept), then keep neighbors at least MIN_GAP apart (also across the wrap).
  const a = seeded.map((s) => s.a)
  if (a.length > 1) {
    const start = a[0]
    for (let i = 0; i < a.length; i++) a[i] = a[i] * (1 - SPREAD) + (start + (360 * i) / a.length) * SPREAD
  }
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

  // Each club's event goes on the side (along the ring) that has more room.
  const tangentSign = new Map()
  seeded.forEach((s, k) => {
    const last = a.length - 1
    const prev = k === 0 ? a[0] + 360 - a[last] : a[k] - a[k - 1]
    const next = k === last ? a[0] + 360 - a[last] : a[k + 1] - a[k]
    tangentSign.set(s.n.id, prev > next ? -1 : 1)
  })

  const point = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]

  // Labels go on the outward side of a node, so edges (which arrive from the inside) don't cross the text.
  const outward = (deg) => {
    const a = ((deg % 360) + 360) % 360
    if (a >= 315 || a < 45) return 'right'
    if (a < 135) return 'bottom'
    if (a < 225) return 'left'
    return 'top'
  }
  // An outcome's edges leave along its outward ray (to its clubs), so its label goes beside it instead.
  const beside = { right: 'top', left: 'top', top: 'right', bottom: 'right' }

  return nodes.map((n) => {
    let cx = 0
    let cy = 0
    let side
    if (n.type === 'outcome') {
      ;[cx, cy] = point(OUTCOME_RING, angle.get(n.id))
      side = beside[outward(angle.get(n.id))]
    } else if (n.type === 'club') {
      ;[cx, cy] = point(CLUB_RING, angle.get(n.id))
      side = outward(angle.get(n.id))
    } else if (n.type === 'event') {
      const club = neighbors(n.id).find((m) => m.type === 'club')
      const a = club ? angle.get(club.id) : -90
      const [px, py] = point(CLUB_RING, a)
      const rad = (a * Math.PI) / 180
      const sign = (club && tangentSign.get(club.id)) || 1
      cx = px - Math.sin(rad) * sign * EVENT_OFFSET
      cy = py + Math.cos(rad) * sign * EVENT_OFFSET
      side = outward((Math.atan2(cy, cx) * 180) / Math.PI)
    }
    const size = nodeStyles[n.type].size
    const out = { ...n, position: { x: round(cx - size / 2), y: round(cy - size / 2) } }
    if (side) out.data = { ...n.data, side }
    return out
  })
}
