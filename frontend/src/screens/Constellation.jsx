import { useCallback, useEffect, useMemo, useState } from 'react'
import AddEventPanel from '@/components/AddEventPanel'
import ArrivalToast from '@/components/ArrivalToast'
import CardGuide from '@/components/CardGuide'
import ClubList from '@/components/ClubList'
import ClubPanel from '@/components/ClubPanel'
import Mascot from '@/components/Mascot'
import StarField from '@/components/StarField'
import StarGraph from '@/components/StarGraph'
import { Button } from '@/components/ui/button'
import { clubIdsForPulse } from '@/lib/buildGraph'
import { sanitizeClub } from '@/lib/club'
import { applyArrivals, applyArrivalsToDetail } from '@/lib/events'
import { SHOW_MASCOT } from '@/lib/flags'
import { sky } from '@/lib/theme'
import { clubIdsUnderOutcome } from '@/lib/highlight'
import { layoutGraph } from '@/lib/layout'
import { useClub } from '@/lib/useClub'
import { cn } from '@/lib/utils'
import { useLiveEvents } from '@/lib/useLiveEvents'
import { useMascotState } from '@/lib/useMascotState'

// Dev only: backend /recommend is a stub. Remove after real data lands.
const USE_PREVIEW_DATA = import.meta.env.DEV && new URLSearchParams(window.location.search).has('previewData')

const noop = () => {}
const NO_CLUBS = new Set()
const MAX_TOASTS = 3

const cardFor = (clubId) =>
  [...document.querySelectorAll('[data-club-id]')].find((n) => n.dataset.clubId === String(clubId)) ?? null

/** Is at least half of this club's card on screen (inside the list's scroll area and the window)? */
function cardOnScreen(clubId) {
  const el = cardFor(clubId)
  if (!el) return false
  const r = el.getBoundingClientRect()
  const half = r.height / 2
  const inside = (box) => r.bottom - half > box.top && r.top + half < box.bottom
  const viewport = el.closest('[data-slot="scroll-area-viewport"]')?.getBoundingClientRect()
  return (!viewport || inside(viewport)) && inside({ top: 0, bottom: window.innerHeight })
}

function GraphPanel({
  graph,
  loading,
  selectedId,
  hoveredId,
  hoveredOutcome,
  onSelect,
  onHover,
  onHoverOutcome,
  pulseIds,
  club,
  rank,
  panel,
  onClose,
  reserveMascot,
}) {
  return (
    <div
      className={cn(
        'relative min-h-96 flex-1 overflow-hidden rounded-xl bg-card lg:min-h-0',
        reserveMascot && 'lg:mb-[4.25rem]', // a strip under the graph for the fixed mascot
      )}
    >
      {loading ? (
        <StarField twinkle />
      ) : (
        <StarGraph
          graph={graph}
          selectedId={selectedId}
          hoveredId={hoveredId}
          hoveredOutcome={hoveredOutcome}
          onSelect={onSelect}
          onHover={onHover}
          onHoverOutcome={onHoverOutcome}
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

export default function Constellation({ data, loading, error, retry, onEdit }) {
  const [selectedId, setSelectedId] = useState(null)
  // Hover is transient, selection is sticky: the graph and the cards show the hover while it lasts, then fall back
  // to the selection. Hover never opens the club panel; only a click does.
  const [hoveredClubId, setHoveredClubId] = useState(null)
  const [hoveredOutcome, setHoveredOutcome] = useState(null) // an outcome node id, e.g. "outcome:career"
  const [scrollToId, setScrollToId] = useState(null) // a single club hovered in the graph: bring its card into view
  const [previewClubs, setPreviewClubs] = useState(null)
  const [previewDetails, setPreviewDetails] = useState(null)
  const [SimulateDrop, setSimulateDrop] = useState(null)
  const [adding, setAdding] = useState(false)

  // Dev only: "Simulate Dropbox drop" button (src/dev/SimulateDrop.jsx). Stripped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    import('@/dev/SimulateDrop').then((m) => setSimulateDrop(() => m.default))
  }, [])

  useEffect(() => {
    if (!USE_PREVIEW_DATA) return
    import('@/dev/previewClubs').then((m) => {
      setPreviewClubs(m.previewClubs)
      setPreviewDetails(m.previewClubDetails)
    })
  }, [])

  const isLoading = USE_PREVIEW_DATA ? previewClubs === null : loading
  const err = USE_PREVIEW_DATA ? null : error
  const matched = useMemo(() => (USE_PREVIEW_DATA ? previewClubs : data?.clubs) ?? [], [previewClubs, data])

  // Live Dropbox arrivals (main plan flow 3): merged into the cards, the graph and the panel; each one gets a single
  // blue highlight. Preview mode has no backend to poll; arrivals there come from the dev "Simulate drop".
  const clubIds = useMemo(() => matched.map((c) => String(c.id)), [matched])
  const [toasts, setToasts] = useState([])
  // An arrival whose card is out of view also gets a toast, so it isn't missed.
  const onArrive = useCallback((events) => {
    const added = events
      .filter((e) => !cardOnScreen(e.club_id))
      .map((event) => ({ key: `${event.id}:${Date.now()}`, clubId: event.club_id, event }))
    if (added.length) setToasts((prev) => [...prev, ...added].slice(-MAX_TOASTS))
  }, [])
  const { arrivals, pulseIds, inject } = useLiveEvents({
    clubIds,
    enabled: !USE_PREVIEW_DATA && !loading && !error && clubIds.length > 0,
    onArrive,
  })
  const clubs = useMemo(() => matched.map((c) => applyArrivals(c, arrivals)), [matched, arrivals])
  const highlightIds = useMemo(() => clubIdsForPulse(clubs, pulseIds), [clubs, pulseIds])

  const dismissToast = useCallback((key) => setToasts((prev) => prev.filter((t) => t.key !== key)), [])
  const openFromToast = useCallback(
    (toast) => {
      dismissToast(toast.key)
      setSelectedId(toast.clubId)
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      cardFor(toast.clubId)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
    },
    [dismissToast],
  )
  const resultClubIds = useMemo(() => new Set(clubIds), [clubIds])
  const closeAdding = useCallback(() => setAdding(false), [])
  const onPublished = useCallback((events) => events.forEach(inject), [inject])
  const clubName = (id) => matched.find((c) => String(c.id) === String(id))?.name ?? ''
  const graphResponse = useMemo(() => (USE_PREVIEW_DATA ? { clubs } : data && { ...data, clubs }), [clubs, data])
  // One memoized layout shared by the graph and the hover logic: hovering never rebuilds it.
  const graph = useMemo(() => layoutGraph(graphResponse), [graphResponse])

  const hoverFromCard = useCallback((id) => {
    setHoveredClubId(id)
    setHoveredOutcome(null)
    setScrollToId(null) // the card under the pointer or focus is already where the user is looking
  }, [])
  const hoverFromGraph = useCallback((id) => {
    setHoveredClubId(id)
    setHoveredOutcome(null)
    setScrollToId(id)
  }, [])
  const hoverOutcome = useCallback((outcomeId) => {
    setHoveredOutcome(outcomeId)
    setHoveredClubId(null)
    setScrollToId(null) // several cards light up at once, so the list does not scroll
  }, [])
  // The cards to highlight: one club, or every club under a hovered outcome.
  const hoveredClubIds = useMemo(() => {
    if (hoveredClubId != null) return new Set([String(hoveredClubId)])
    if (hoveredOutcome) return new Set(clubIdsUnderOutcome(graph, hoveredOutcome))
    return NO_CLUBS
  }, [hoveredClubId, hoveredOutcome, graph])

  // The selected club's panel: it renders at once from the match; GET /clubs/:id (or the preview body) fills in the rest.
  const selectedIndex = clubs.findIndex((c) => String(c.id) === String(selectedId))
  const selectedClub = selectedIndex >= 0 ? clubs[selectedIndex] : null
  const live = useClub(selectedClub ? String(selectedClub.id) : null, { enabled: !USE_PREVIEW_DATA })
  const previewRaw = USE_PREVIEW_DATA && selectedClub ? previewDetails?.[selectedClub.id] : undefined
  const previewDetail = useMemo(() => (previewRaw ? sanitizeClub(previewRaw) : null), [previewRaw])
  const rawPanel = USE_PREVIEW_DATA
    ? { detail: previewDetail, loading: previewDetails === null, error: null, notFound: previewDetails !== null && !previewRaw }
    : live
  const panelDetail = useMemo(() => applyArrivalsToDetail(rawPanel.detail, arrivals), [rawPanel.detail, arrivals])
  const panel = { ...rawPanel, detail: panelDetail }
  const closePanel = useCallback(() => setSelectedId(null), [])

  // The mascot: scanning while /recommend runs, "discovered" for 2.5 s when an arrival starts its highlight.
  const mascotState = useMascotState({ loading: isLoading, pulseIds })
  // Clicking it opens the club whose next event is soonest. Only published events reach `next_event` (the API and
  // lib/events.js drop pending_review ones), and the guard below repeats that check so a pending event can never lead here.
  const openSoonestEvent = useCallback(() => {
    const now = Date.now()
    let best = null
    for (const c of clubs) {
      const ev = c.next_event
      if (!ev || typeof ev !== 'object' || (ev.status != null && ev.status !== 'published')) continue
      const t = Date.parse(ev.start)
      if (Number.isNaN(t) || t < now) continue
      if (!best || t < best.t) best = { t, id: c.id }
    }
    if (!best) return
    setSelectedId(best.id)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    cardFor(best.id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }, [clubs])

  if (err) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <h2 className="text-3xl">Couldn't map your stars. Try again.</h2>
        <div className="flex gap-3">
          <Button onClick={retry}>Retry</Button>
          <Button variant="ghost" onClick={onEdit}>
            Remap your constellation
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
      className={cn(
        'mx-auto flex min-h-svh max-w-7xl flex-col px-6 py-10 lg:h-svh',
        SHOW_MASCOT && 'max-lg:pb-28', // room under the content for the mascot
      )}
      aria-busy={isLoading}
    >
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl md:text-3xl">{isLoading ? 'Mapping your constellation…' : 'Your constellation'}</h2>
          {!isLoading && !empty && <CardGuide />}
        </div>
        {!isLoading && !empty && (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={adding ? 'text-foreground' : 'text-muted-foreground'}
              aria-expanded={adding}
              onClick={() => setAdding((v) => !v)}
            >
              Add an event
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onEdit}>
              Remap your constellation
            </Button>
          </div>
        )}
        <AddEventPanel
          open={adding && !isLoading && !empty}
          onClose={closeAdding}
          resultClubIds={resultClubIds}
          onPublished={onPublished}
        />
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

      {empty ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p className="text-muted-foreground">
            No stars matched yet. Try describing what you want a little differently.
          </p>
          <Button onClick={onEdit}>Remap your constellation</Button>
        </div>
      ) : (
        <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          <ClubList
            clubs={clubs}
            loading={isLoading}
            selectedId={selectedId}
            hoveredIds={hoveredClubIds}
            dimOthers={hoveredOutcome != null}
            scrollToId={scrollToId}
            highlightIds={highlightIds}
            onSelect={setSelectedId}
            onHover={hoverFromCard}
          />
          <GraphPanel
            graph={graph}
            loading={isLoading}
            selectedId={selectedId}
            hoveredId={hoveredClubId}
            hoveredOutcome={hoveredOutcome}
            onSelect={setSelectedId}
            onHover={hoverFromGraph}
            onHoverOutcome={hoverOutcome}
            pulseIds={pulseIds}
            club={selectedClub}
            rank={selectedIndex + 1}
            panel={panel}
            onClose={closePanel}
            reserveMascot={SHOW_MASCOT}
          />
        </div>
      )}

      {SimulateDrop && !isLoading && <SimulateDrop clubs={matched} onDrop={inject} />}

      {/* Bottom-right, in the strip reserved under the graph. Hidden while the club panel is open and under 640px. */}
      {SHOW_MASCOT && !selectedClub && !err && (
        <div className="fixed right-4 bottom-4 z-20 max-sm:hidden">
          <Mascot size={88} state={mascotState} onClick={openSoonestEvent} />
        </div>
      )}

      <ArrivalToast
        arrivals={toasts.map((t) => ({ ...t, clubName: clubName(t.clubId) }))}
        onOpen={openFromToast}
        onDismiss={dismissToast}
      />
    </div>
  )
}
