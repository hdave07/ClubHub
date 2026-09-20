import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import majors from '@/data/majors.json'

// Every student answers this one: Next stays disabled until something is entered.
export default function Major({ major, onChange, onNext }) {
  const filled = major.trim().length > 0

  function handleSubmit(e) {
    e.preventDefault() // Enter moves to the next step
    if (filled) onNext()
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <h2 className="text-3xl">What are you studying?</h2>
        <Input
          autoFocus
          list="majors"
          value={major}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Economics"
          className="dark:bg-card" // solid, so the background particles do not run through the text
          aria-label="Your major"
          aria-required="true"
        />
        <datalist id="majors">
          {majors.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!filled}>
            Next
          </Button>
        </div>
      </form>
    </div>
  )
}
