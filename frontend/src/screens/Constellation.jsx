import { useEffect, useState } from 'react'
import ClubList from '@/components/ClubList'
import { Button } from '@/components/ui/button'
import { sky } from '@/lib/theme'

// Dev only: backend /recommend is a stub. Remove after real data lands.
const USE_PREVIEW_DATA = import.meta.env.DEV && new URLSearchParams(window.location.search).has('previewData')

// CSS-only stars for the graph panel, colors from theme tokens.
const panelStars = [
  [12, 18], [27, 72], [41, 33], [58, 14], [66, 58], [79, 27], [88, 80], [8, 55], [35, 88], [92, 9], [52, 66],
]
  .map(([x, y]) => `radial-gradient(1.5px 1.5px at ${x}% ${y}%, ${sky.stars} 50%, transparent 51%)`)
  .join(', ')

// TODO Sprint 5: replace the placeholder text with StarGraph (React Flow, selectedId/hoveredId synced with ClubList).
function GraphPanel() {
  return (
    <div
      className="flex min-h-64 flex-1 items-center justify-center rounded-2xl border border-border bg-card lg:min-h-0"
      style={{ backgroundImage: panelStars }}
    >
      <p className="text-sm text-muted-foreground">Your star map appears here</p>
    </div>
  )
}

export default function Constellation({ data, loading, error, retry, onEdit, skipped, onTellUs }) {
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [previewClubs, setPreviewClubs] = useState(null)

  useEffect(() => {
    if (USE_PREVIEW_DATA) import('@/dev/previewClubs').then((m) => setPreviewClubs(m.previewClubs))
  }, [])

  const isLoading = USE_PREVIEW_DATA ? previewClubs === null : loading
  const err = USE_PREVIEW_DATA ? null : error
  const clubs = (USE_PREVIEW_DATA ? previewClubs : data?.clubs) ?? []

  if (err) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <h2 className="text-3xl">Couldn't map your stars. Try again.</h2>
        <div className="flex gap-3">
          <Button onClick={retry}>Retry</Button>
          <Button variant="ghost" onClick={onEdit}>
            Edit
          </Button>
        </div>
        {import.meta.env.DEV && (
          <p className="text-xs text-muted-foreground">Dev: is the backend running on :8000?</p>
        )}
      </div>
    )
  }

  const empty = !isLoading && clubs.length === 0

  return (
    <div
      className="mx-auto flex min-h-svh max-w-6xl flex-col px-6 py-10 lg:h-svh"
      aria-busy={isLoading}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl">{isLoading ? 'Mapping your constellation…' : 'Your constellation'}</h2>
        {!isLoading && !empty && (
          <Button variant="outline" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>

      {isLoading && (
        <div aria-hidden className="mt-4 flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="twinkle size-1.5 rounded-full"
              style={{ background: sky.stars, animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}

      {skipped && !isLoading && (
        <Button variant="link" className="mt-2 self-start px-0" onClick={onTellUs}>
          ✦ Tell us what you want for better matches
        </Button>
      )}

      {empty ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p className="text-muted-foreground">
            No stars matched yet. Try describing what you want a little differently.
          </p>
          <Button onClick={onEdit}>Edit</Button>
        </div>
      ) : (
        <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          <ClubList
            clubs={clubs}
            loading={isLoading}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
          />
          <GraphPanel />
        </div>
      )}
    </div>
  )
}
