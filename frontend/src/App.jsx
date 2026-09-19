import { useState } from 'react'
import { recommend } from './lib/api'

function App() {
  const [blurb, setBlurb] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!blurb.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await recommend(blurb))
    } catch {
      setError('Could not reach the backend. Is the FastAPI server running on :8000?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Campus Compass</h1>
      <p className="mt-2 text-neutral-500">
        Tell us what you want out of university. We'll map the clubs, the people, and
        the next event to show up to.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex gap-2">
        <input
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="First-year CS, want internships and friends, not too intense"
          className="flex-1 rounded-md border border-neutral-300 px-4 py-2 outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Matching…' : 'Match me'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-10 grid gap-4">
          {result.clubs.map((club) => (
            <div key={club.id} className="rounded-lg border border-neutral-200 p-4">
              <h2 className="font-medium">{club.name}</h2>
              <p className="mt-1 text-sm text-neutral-600">{club.summary}</p>
              <p className="mt-2 text-sm italic text-neutral-500">{club.why_it_fits}</p>
            </div>
          ))}
        </div>
      )}

      {/* TODO: personal graph view (@xyflow/react or react-force-graph-2d) goes here */}
    </div>
  )
}

export default App
