import { sky } from '@/lib/theme'

// Static star field: layers of tiny dots on different tile sizes, so the pattern doesn't visibly repeat.
// [tile px, dot x, dot y, radius px, alpha hex]
const LAYERS = [
  [97, 20, 30, 1, 'B3'],
  [131, 80, 60, 1, '80'],
  [173, 40, 120, 1.5, '99'],
  [211, 150, 50, 1, '66'],
  [257, 200, 180, 1, '80'],
  [307, 90, 240, 1.5, 'B3'],
  [59, 10, 45, 0.75, '4D'],
]

const backgroundImage = LAYERS.map(
  ([, x, y, r, alpha]) => `radial-gradient(${r}px ${r}px at ${x}px ${y}px, ${sky.stars}${alpha} 50%, transparent 51%)`,
).join(', ')
const backgroundSize = LAYERS.map(([tile]) => `${tile}px ${tile}px`).join(', ')

const TWINKLES = [
  [12, 18], [27, 72], [41, 33], [58, 14], [66, 58], [79, 27], [88, 80], [8, 55],
]

export default function StarField({ twinkle = false }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage, backgroundSize }}>
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
