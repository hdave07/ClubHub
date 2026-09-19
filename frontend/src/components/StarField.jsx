import { sky } from '@/lib/theme'

// Static star field: one large tile of pseudo-random dots (seeded, so it never changes between renders).
const TILE = 720
const DOTS = 70

function seeded(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tileImage() {
  const rand = seeded(42)
  const fill = sky.stars.replace('#', '%23')
  const dots = Array.from({ length: DOTS }, () => {
    const x = (rand() * TILE).toFixed(1)
    const y = (rand() * TILE).toFixed(1)
    const r = (0.5 + rand() * 1.1).toFixed(2)
    const o = (0.2 + rand() * 0.6).toFixed(2)
    return `<circle cx='${x}' cy='${y}' r='${r}' fill-opacity='${o}'/>`
  }).join('')
  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}' fill='${fill}'>${dots}</svg>")`
}

const backgroundImage = tileImage()

const TWINKLES = [
  [12, 18], [27, 72], [41, 33], [58, 14], [66, 58], [79, 27], [88, 80], [8, 55],
]

export default function StarField({ twinkle = false }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ backgroundImage, backgroundSize: `${TILE}px ${TILE}px` }}
    >
      {twinkle &&
        TWINKLES.map(([x, y], i) => (
          <span
            key={i}
            className="twinkle absolute size-1 rounded-full"
            style={{ left: `${x}%`, top: `${y}%`, background: sky.stars, animationDelay: `${(i % 4) * 0.25}s` }}
          />
        ))}
    </div>
  )
}
