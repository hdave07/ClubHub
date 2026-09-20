import CampusPicker from '@/components/CampusPicker'
import SchoolMarquee from '@/components/SchoolMarquee'
import StaticStars from '@/components/StaticStars'
import schools from '@/data/schools.json'

// The first screen: a scroll of the schools ClubHub is heading to (decoration), then the real control, a search box.
// Only University of Toronto is live for now; any other school shows a "coming soon" note (see CampusPicker).
export default function Campus({ onChoose }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <StaticStars />

      <p className="relative text-xs tracking-[0.3em] text-muted-foreground">WELCOME TO</p>
      <h1 className="relative mt-3 text-5xl md:text-6xl">ClubHub</h1>

      <div className="relative mt-8 w-full max-w-3xl">
        <SchoolMarquee schools={schools} />
      </div>

      <div className="relative mt-8 flex w-full justify-center">
        <CampusPicker schools={schools} onChoose={onChoose} />
      </div>
    </div>
  )
}
