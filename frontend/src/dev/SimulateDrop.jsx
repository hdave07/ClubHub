// Dev only (loaded behind import.meta.env.DEV, absent from production builds).
// Fakes what the Dropbox watcher produces, so the live-update path can be tried without a backend or a Claude call.
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// Naive UTC, like the backend sends today, so this also exercises the timezone guard. 22:00 UTC = 6 PM Toronto (EDT).
const inDaysAt22Utc = (n) => {
  const d = new Date(Date.now() + n * 86_400_000)
  d.setUTCHours(22, 0, 0, 0)
  return d.toISOString().slice(0, 19)
}

// Each click runs the next scenario: a club's first event, a later extra event (its own star), then a corrected
// re-drop of the first one (same id, new file and time).
const SCENARIOS = [
  { label: 'first event', pick: (clubs) => clubs.at(-1), id: 'sim-1', title: 'Open Build Night', days: 2, file: 'IMG_4928.jpg' },
  { label: 'extra event', pick: (clubs) => clubs[0], id: 'sim-2', title: 'Pitch Practice', days: 9, file: 'Screenshot_238.png' },
  { label: 'corrected re-drop', pick: (clubs) => clubs.at(-1), id: 'sim-1', title: 'Open Build Night (new room)', days: 3, file: 'poster-final.pdf' },
]

/** @param {{ clubs: { id: string | number }[], onDrop: (raw: object) => void }} props */
export default function SimulateDrop({ clubs, onDrop }) {
  const [step, setStep] = useState(0)
  if (!clubs.length) return null
  const s = SCENARIOS[step % SCENARIOS.length]

  function drop() {
    const club = s.pick(clubs)
    onDrop({
      id: `${s.id}-${club.id}`,
      club_id: club.id,
      title: s.title,
      start: inDaysAt22Utc(s.days),
      location: 'Bahen Centre',
      status: 'published',
      source: 'dropbox',
      source_file: s.file,
      dropbox_link: `https://www.dropbox.com/s/dev/${s.file}`,
      description: 'Questions? Email organizer@example.com. Everyone welcome.',
    })
    setStep((n) => n + 1)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={drop}
      className="fixed bottom-3 left-3 z-30 border-dashed text-xs text-muted-foreground"
      title="Dev only: fake a Dropbox arrival"
    >
      Dev · Simulate Dropbox drop ({s.label})
    </Button>
  )
}
