import { useCallback, useEffect, useMemo, useState } from 'react'
import ClubList from '@/components/ClubList'
import ClubPanel from '@/components/ClubPanel'
import StarField from '@/components/StarField'
import StarGraph from '@/components/StarGraph'
import { Button } from '@/components/ui/button'
import { clubIdsForPulse } from '@/lib/buildGraph'
import { sanitizeClub } from '@/lib/club'
import { sky } from '@/lib/theme'
import { useClub } from '@/lib/useClub'

// Dev only: backend /recommend is a stub. Remove after real data lands.
const USE_PREVIEW_DATA = import.meta.env.DEV && new URLSearchParams(window.location.search).has('previewData')

const NO_PULSE = new Set()
const noop = () => {}

function GraphPanel({ response, loading, selectedId, hoveredId, onSelect, onHover, pulseIds, club, rank, panel, onClose }) {
  return (
    <div className="relative min-h-96 flex-1 overflow-hidden rounded-xl bg-card lg:min-h-0">
      {loading ? (
        <StarField twinkle />
      ) : (
        <StarGraph
          response={response}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={onHover}
          pulseIds={pulseIds}
          panelOpen={!!club}
        />
      )}
      {!loading && club && (
        <ClubPanel
          club={club}
          rank={rank}
          detail={panel.detail}
          loading={panel.loading}
          error={panel.error}
          notFound={panel.notFound}
          onRetry={panel.retry ?? noop}
          onClose={onClose}
        />
      )}
    </div>
  )
}

// pulseIds: event node ids ("event:88") for Dropbox events that just arrived. Wired up by the live-updates work.
export default function Constellation({ data, loading, error, retry, onEdit, skipped, onTellUs, pulseIds = NO_PULSE }) {
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [previewClubs, setPreviewClubs] = useState(null)
  const [previewDetails, setPreviewDetails] = useState(null)

  useEffect(() => {
    if (!USE_PREVIEW_DATA) return
    import('@/dev/previewClubs').then((m) => {
      setPreviewClubs(m.previewClubs)
      setPreviewDetails(m.previewClubDetails)
    })
  }, [])

  const isLoading = USE_PREVIEW_DATA ? previewClubs === null : loading
  const err = USE_PREVIEW_DATA ? null : error
  const clubs = useMemo(() => (USE_PREVIEW_DATA ? previewClubs : data?.clubs) ?? [], [previewClubs, data])
  const highlightIds = useMemo(() => clubIdsForPulse(clubs, pulseIds), [clubs, pulseIds])
  const graphResponse = useMemo(() => (USE_PREVIEW_DATA ? { clubs } : data), [clubs, data])

  // The selected club's panel: it renders at once from the match; GET /clubs/:id (or the preview body) fills in the rest.
  const selectedIndex = clubs.findIndex((c) => String(c.id) === String(selectedId))
  const selectedClub = selectedIndex >= 0 ? clubs[selectedIndex] : null
  const live = useClub(selectedClub ? String(selectedClub.id) : null, { enabled: !USE_PREVIEW_DATA })
  const previewRaw = USE_PREVIEW_DATA && selectedClub ? previewDetails?.[selectedClub.id] : undefined
  const previewDetail = useMemo(() => (previewRaw ? sanitizeClub(previewRaw) : null), [previewRaw])
  const panel = USE_PREVIEW_DATA
    ? { detail: previewDetail, loading: previewDetails === null, error: null, notFound: previewDetails !== null && !previewRaw }
    : live
  const closePanel = useCallback(() => setSelectedId(null), [])

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
      className="mx-auto flex min-h-svh max-w-7xl flex-col px-6 py-10 lg:h-svh"
      aria-busy={isLoading}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl">{isLoading ? 'Mapping your constellation…' : 'Your constellation'}</h2>
        {!isLoading && !empty && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onEdit}>
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
            highlightIds={highlightIds}
            onSelect={setSelectedId}
            onHover={setHoveredId}
          />
          <GraphPanel
            response={graphResponse}
            loading={isLoading}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            pulseIds={pulseIds}
            club={selectedClub}
            rank={selectedIndex + 1}
            panel={panel}
            onClose={closePanel}
          />
        </div>
      )}
    </div>
  )
}
