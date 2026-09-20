import * as defaults from '@/lib/graphTuning'
import { nodeStyles } from '@/lib/theme'

// Soft physics for the star graph: no force simulation, no library. Each star keeps its resting spot (from
// lib/layout.js) and a small offset from it. The offset is pulled by a spring toward a target made of
//   1. the cursor field (a smooth push away from the pointer),
//   2. a fraction of what its connected neighbors are doing (invisible springs), and
//   3. a very slow ambient drift.
// Pure math over typed arrays: it never touches React or the DOM, so it is cheap and testable. Offsets are in screen px.

const TAU = Math.PI * 2

/** Deterministic 0..1 value from a string hash, so drift phases are stable between renders. */
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const unit = (h, k) => (Math.imul(h ^ Math.imul(k + 1, 0x9e3779b1), 2246822519) >>> 0) / 4294967296

/**
 * @param {{ id: string, type: string, position: { x: number, y: number } }[]} nodes laid-out nodes (flow coordinates)
 * @param {{ source: string, target: string }[]} edges
 * @param {typeof defaults} [tuning]
 */
export function createSimulation(nodes, edges, tuning = defaults) {
  const n = nodes.length
  const cx = new Float32Array(n) // resting centers, flow coordinates
  const cy = new Float32Array(n)
  const ox = new Float32Array(n) // current offsets, screen px
  const oy = new Float32Array(n)
  const vx = new Float32Array(n)
  const vy = new Float32Array(n)
  const fixed = new Uint8Array(n) // "you" anchors the composition and never moves
  const phase = new Float32Array(n * 2)
  const freq = new Float32Array(n * 2)
  const away = new Float32Array(n * 2) // fallback push direction if the cursor is exactly on a star
  const index = new Map()

  nodes.forEach((node, i) => {
    index.set(node.id, i)
    const size = nodeStyles[node.type]?.size ?? 0
    cx[i] = node.position.x + size / 2
    cy[i] = node.position.y + size / 2
    fixed[i] = node.type === 'you' ? 1 : 0
    const h = hash(node.id)
    phase[i * 2] = unit(h, 0) * TAU
    phase[i * 2 + 1] = unit(h, 1) * TAU
    const span = tuning.IDLE_DRIFT_MAX_HZ - tuning.IDLE_DRIFT_MIN_HZ
    freq[i * 2] = tuning.IDLE_DRIFT_MIN_HZ + unit(h, 2) * span
    freq[i * 2 + 1] = tuning.IDLE_DRIFT_MIN_HZ + unit(h, 3) * span
    const a = unit(h, 4) * TAU
    away[i * 2] = Math.cos(a)
    away[i * 2 + 1] = Math.sin(a)
  })

  const lists = Array.from({ length: n }, () => [])
  for (const e of edges) {
    const a = index.get(e.source)
    const b = index.get(e.target)
    if (a === undefined || b === undefined) continue
    lists[a].push(b)
    lists[b].push(a)
  }
  const neighbors = lists.map((l) => Int16Array.from(l))

  // The push is smoothstep falloff x a core that fades it out right on the cursor. That product never reaches 1,
  // so normalize by its true peak: MAX_DISPLACEMENT is then the actual strongest push.
  let shapePeak = 0
  for (let k = 1; k <= 400; k++) {
    const d = (tuning.INTERACTION_RADIUS * k) / 400
    const t = 1 - d / tuning.INTERACTION_RADIUS
    shapePeak = Math.max(shapePeak, t * t * (3 - 2 * t) * (1 - Math.exp(-d / tuning.CORE_RADIUS)))
  }

  // Smoothed pointer (screen px, relative to the graph) and how strongly the field is on (0..1).
  let sx = 0
  let sy = 0
  let influence = 0
  let wasActive = false

  /**
   * Advance the simulation.
   * @param {number} dtMs milliseconds since the last step
   * @param {number} timeSec clock for the drift
   * @param {{ x: number, y: number, active: boolean }} pointer cursor in the graph's own pixels
   * @param {{ x: number, y: number, zoom: number }} view React Flow's viewport
   * @param {boolean} physics false (reduced motion): everything eases back to rest and stays there
   */
  function step(dtMs, timeSec, pointer, view, physics = true) {
    const s = Math.min(2.5, Math.max(0.2, dtMs / 16.667)) // frame-rate independent: 1 = one 60fps frame
    const zoom = view.zoom || 1
    const ease = 1 - Math.pow(1 - tuning.POINTER_SMOOTHING, s)

    const on = physics && pointer.active
    if (on && !wasActive) {
      sx = pointer.x // start where the cursor entered, so the field doesn't sweep in from the corner
      sy = pointer.y
    }
    wasActive = on
    if (on) {
      sx += (pointer.x - sx) * ease
      sy += (pointer.y - sy) * ease
    }
    influence += ((on ? 1 : 0) - influence) * ease

    const R = tuning.INTERACTION_RADIUS
    const MAX = (tuning.MAX_DISPLACEMENT * tuning.REPULSION_STRENGTH) / shapePeak
    const drift = tuning.IDLE_DRIFT_AMOUNT * Math.SQRT1_2 // per axis, so the wander never exceeds IDLE_DRIFT_AMOUNT
    const cap = tuning.MAX_DISPLACEMENT * 1.3 + tuning.IDLE_DRIFT_AMOUNT * 1.5 // soft ceiling so nothing can run away
    const damp = Math.pow(tuning.DAMPING, s)

    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue
      let tx = 0
      let ty = 0

      if (physics) {
        tx += drift * Math.sin(TAU * freq[i * 2] * timeSec + phase[i * 2])
        ty += drift * Math.sin(TAU * freq[i * 2 + 1] * timeSec + phase[i * 2 + 1])

        if (influence > 0.001) {
          // measured from the resting spot, so the target doesn't chase the star it is moving
          let dx = view.x + cx[i] * zoom - sx
          let dy = view.y + cy[i] * zoom - sy
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < R) {
            const t = 1 - d / R
            const falloff = t * t * (3 - 2 * t) // smoothstep: strong up close, easing to nothing at the edge
            const core = 1 - Math.exp(-d / tuning.CORE_RADIUS) // ~0 right on the cursor, so a hovered star holds still
            const push = MAX * falloff * core * influence
            if (d > 0.5) {
              dx /= d
              dy /= d
            } else {
              dx = away[i * 2]
              dy = away[i * 2 + 1]
            }
            tx += dx * push
            ty += dy * push
          }
        }

        // Connected stars copy a fraction of each other's displacement, as if joined by invisible springs.
        const list = neighbors[i]
        if (list.length) {
          let mx = 0
          let my = 0
          for (let k = 0; k < list.length; k++) {
            mx += ox[list[k]]
            my += oy[list[k]]
          }
          tx += (mx / list.length) * tuning.NEIGHBOR_FOLLOW
          ty += (my / list.length) * tuning.NEIGHBOR_FOLLOW
        }
      }

      vx[i] = (vx[i] + (tx - ox[i]) * tuning.SPRING_STRENGTH * s) * damp
      vy[i] = (vy[i] + (ty - oy[i]) * tuning.SPRING_STRENGTH * s) * damp
      ox[i] += vx[i] * s
      oy[i] += vy[i] * s

      const m = Math.sqrt(ox[i] * ox[i] + oy[i] * oy[i])
      if (m > cap) {
        const k = cap / m
        ox[i] *= k
        oy[i] *= k
        vx[i] *= k
        vy[i] *= k
      }
    }
  }

  return { count: n, index, cx, cy, ox, oy, fixed, neighbors, step }
}
