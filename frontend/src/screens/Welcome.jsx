import { Badge } from '@/components/ui/badge'
import Mascot from '@/components/Mascot'
import StaticStars from '@/components/StaticStars'
import { Button } from '@/components/ui/button'

export default function Welcome({ onExplore }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <StaticStars />

      <h1 className="relative text-5xl md:text-6xl">Your U of T Universe</h1>
      <Badge variant="outline" className="relative mt-6 h-8 px-4 text-sm">
        University of Toronto · St. George
      </Badge>

      <div className="relative mt-8 flex flex-col items-center gap-3">
        <Button size="lg" onClick={onExplore}>
          Explore →
        </Button>
      </div>

      {/* Puffer stands on a hairline "floor" at the bottom of the page. Hidden on short screens, where it would
          run into the title. Clicking it does what Explore does. */}
      <div className="absolute inset-x-0 bottom-8 flex flex-col items-center [@media(max-height:680px)]:hidden">
        <Mascot size={220} onClick={onExplore} />
        <span aria-hidden className="h-px w-[min(36rem,90vw)] bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </div>
  )
}
