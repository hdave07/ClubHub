import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SURPRISE_ME } from '@/lib/blurb'
import { cn } from '@/lib/utils'

const CHIPS = [
  'Finance',
  'Fintech',
  'Consulting',
  'Tech',
  'Design',
  'Arts',
  'Social impact',
  'Research',
  'Wellness',
  'Culture',
  SURPRISE_ME,
]

const parts = (text) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const hasChip = (text, chip) => parts(text).some((p) => p.toLowerCase() === chip.toLowerCase())

export default function Blurb({ text, onChange, onLaunch }) {
  const canLaunch = text.trim().length > 0

  function toggle(chip) {
    // The box always shows exactly what will be sent.
    const list = parts(text)
    const next = hasChip(text, chip)
      ? list.filter((p) => p.toLowerCase() !== chip.toLowerCase())
      : [...list, chip]
    onChange(next.join(', '))
  }

  function launch() {
    if (!canLaunch) return
    onLaunch(text)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center px-6">
      <div className="flex flex-col gap-6">
        <h2 className="text-3xl">What do you want out of university?</h2>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              launch()
            }
          }}
          placeholder="e.g. first-year CS, want internships and friends, not too intense"
          className="min-h-36 dark:bg-card"
          aria-label="What you want out of university"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Interest helpers">
          {CHIPS.map((chip) => {
            const on = hasChip(text, chip)
            return (
              <Button
                key={chip}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={on}
                onClick={() => toggle(chip)}
                className={cn('dark:bg-card', on && 'ring-2 ring-ring')}
              >
                {chip}
              </Button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <Button size="lg" disabled={!canLaunch} onClick={launch}>
            Launch my star
          </Button>
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter</span>
        </div>
      </div>
    </div>
  )
}
