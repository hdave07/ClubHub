import { sky } from '@/lib/theme'

// [left %, top %] of the CSS-only stars
const STARS = [
  [12, 18], [27, 72], [41, 33], [58, 14], [66, 58], [79, 27],
  [88, 80], [8, 55], [35, 88], [92, 9], [52, 66], [73, 45],
  [19, 40], [47, 8], [84, 60], [61, 90],
]

/** Scattered twinkling dots behind the onboarding pages (Welcome and Campus). Decorative. */
export default function StaticStars() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {STARS.map(([x, y], i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            background: sky.stars,
            animationDelay: `${(i % 5) * 0.25}s`,
          }}
        />
      ))}
    </div>
  )
}
