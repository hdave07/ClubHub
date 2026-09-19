import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { nodeStyles, sky } from '@/lib/theme'

// [left %, top %] of the CSS-only stars
const STARS = [
  [12, 18], [27, 72], [41, 33], [58, 14], [66, 58], [79, 27],
  [88, 80], [8, 55], [35, 88], [92, 9], [52, 66], [73, 45],
  [19, 40], [47, 8], [84, 60], [61, 90],
]

export default function Welcome({ onExplore, onSkip }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
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

      <div
        aria-hidden
        className="twinkle relative mb-8 rounded-full"
        style={{
          width: nodeStyles.you.size,
          height: nodeStyles.you.size,
          background: nodeStyles.you.background,
          boxShadow: nodeStyles.you.boxShadow,
        }}
      />

      <p className="relative text-xs tracking-[0.3em] text-muted-foreground">WELCOME TO</p>
      <h1 className="relative mt-3 text-5xl md:text-6xl">Your U of T Universe</h1>
      <Badge variant="outline" className="relative mt-5">
        University of Toronto · St. George
      </Badge>
      <p className="relative mt-6 max-w-md text-muted-foreground">
        1,250 clubs are out there, waiting to be found. Why not by you?
      </p>

      <div className="relative mt-10 flex flex-col items-center gap-3">
        <Button size="lg" onClick={onExplore}>
          Explore →
        </Button>
        <Button variant="link" onClick={onSkip}>
          Just look around
        </Button>
      </div>
    </div>
  )
}
