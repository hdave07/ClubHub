import { useCallback, useMemo, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import ClubList from '@/components/ClubList'
import ClubPanel from '@/components/ClubPanel'
import DirectoryFilters from '@/components/DirectoryFilters'
import StarField from '@/components/StarField'
import StarGraph from '@/components/StarGraph'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_CLUBS } from '@/lib/buildGraph'
import { emptyFilters, filterClubs } from '@/lib/directory'
import { clubIdsUnderOutcome } from '@/lib/highlight'
import { layoutGraph } from '@/lib/layout'
import { useMyClubs } from '@/lib/myClubs'
import { useAllClubs } from '@/lib/useAllClubs'
import { useClub } from '@/lib/useClub'
import { useRecommend } from '@/lib/useRecommend'

const NO_CLUBS = new Set()

/**
 * The Full Directory: every club, filterable, in a new tab (App.jsx renders this for ?view=directory) so
 * browsing here never touches the main page's own graph. Same shell as Constellation (ClubList + StarGraph +
 * ClubPanel), same hover/highlight model (lib/highlight.js, lib/graphView.js) and the same soft-physics graph.
 *
 * The left list has two modes: browsing (every club, narrowed only by the filter chips) and searching (once the
 * top prompt has been submitted, the list shows the same ranked, reasoned clubs as the graph -- searching is
 * itself the strongest filter there is, and showing anything else would mean the list and the graph disagree
 * about what matched). The filter chips still apply on top of either set. "Clear" returns to browsing without
 * losing the last search (useRecommend keeps it; only `searchActive` is toggled).
 */
export default function Directory() {
  const { clubs: allClubs, loading: clubsLoading, error: clubsError } = useAllClubs()
  const [filters, setFilters] = useState(emptyFilters())
  const allClubsById = useMemo(() => new Map(allClubs.map((c) => [c.id, c])), [allClubs])

  const [query, setQuery] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const { data: searchData, loading: searchLoading, error: rawSearchError, run: search, retry: retrySearch } = useRecommend()
  // Stale data/error from a previous search shouldn't linger once the user has cleared back to browsing.
  const activeData = searchActive ? searchData : null
  const searchError = searchActive ? rawSearchError : null
  const searchClubs = useMemo(() => activeData?.clubs ?? [], [activeData])
  const searchIndex = useMemo(() => new Map(searchClubs.map((c, i) => [String(c.id), i])), [searchClubs])
  // One memoized layout shared by the graph and the hover logic (Constellation's own pattern): hovering never
  // rebuilds it, and clubIdsUnderOutcome below reads the same laid-out edges the graph renders.
  const graph = useMemo(() => layoutGraph(activeData), [activeData])

  // While searching, the list IS the search result (ranked, with why_it_fits) -- browsing only otherwise. Facet
  // filters (lib/directory.js) apply to either: they read name/summary/tags/commitment, which both shapes carry.
  const baseClubs = searchActive && activeData ? searchClubs : allClubs
  const filteredClubs = useMemo(() => filterClubs(baseClubs, filters), [baseClubs, filters])

  const onSearch = useCallback(
    (e) => {
      e.preventDefault()
      const text = query.trim()
      if (!text) return
      setSearchActive(true)
      setLastQuery(text)
      search(text)
    },
    [query, search],
  )
  const onClear = useCallback(() => {
    setSearchActive(false)
    setQuery('')
  }, [])

  // window.close() only works on a tab the browser recognizes as script-opened, and it fails silently -- there is
  // no callback or promise. If the page is still here a beat later, closing was refused, so say so instead of
  // leaving the button looking broken. This never navigates anywhere on its own.
  const [closeRefused, setCloseRefused] = useState(false)
  const onBack = useCallback(() => {
    window.close()
    window.setTimeout(() => setCloseRefused(true), 400)
  }, [])

  const [selectedId, setSelectedId] = useState(null)
  // Hover is transient, selection is sticky: same split as Constellation. hoveredOutcome lights every club under
  // that outcome at once (cards + graph); a single club hover lights just that one path.
  const [hoveredClubId, setHoveredClubId] = useState(null)
  const [hoveredOutcome, setHoveredOutcome] = useState(null)
  const [scrollToId, setScrollToId] = useState(null)
  const closePanel = useCallback(() => setSelectedId(null), [])

  const hoverFromCard = useCallback((id) => {
    setHoveredClubId(id)
    setHoveredOutcome(null)
    setScrollToId(null)
  }, [])
  const hoverFromGraph = useCallback((id) => {
    setHoveredClubId(id)
    setHoveredOutcome(null)
    setScrollToId(id)
  }, [])
  const hoverOutcome = useCallback((outcomeId) => {
    setHoveredOutcome(outcomeId)
    setHoveredClubId(null)
    setScrollToId(null)
  }, [])
  const hoveredClubIds = useMemo(() => {
    if (hoveredClubId != null) return new Set([String(hoveredClubId)])
    if (hoveredOutcome) return new Set(clubIdsUnderOutcome(graph, hoveredOutcome))
    return NO_CLUBS
  }, [hoveredClubId, hoveredOutcome, graph])

  // A club selected from the search graph carries its rank + why-it-fits; one selected from the plain browse
  // list doesn't have either, and ClubPanel already renders that absence gracefully (see lib/club.js).
  const searchHit = selectedId != null && searchIndex.has(selectedId) ? searchClubs[searchIndex.get(selectedId)] : null
  const selectedClub = searchHit ?? (selectedId != null ? allClubsById.get(selectedId) : null) ?? null
  const selectedRank = searchHit ? searchIndex.get(selectedId) + 1 : null

  const panel = useClub(selectedClub ? String(selectedClub.id) : null)

  // "Add to your map": this tab can't see the main tab's match list, only the shared store (lib/myClubs.js) and
  // the map size the main tab last reported into it, which is what caps adding here.
  const { isAdded, addClub, mapSize } = useMyClubs()
  const atCap = mapSize >= MAX_CLUBS
  const selectedAdded = selectedClub ? isAdded(selectedClub.id) : false
  const mapAction = selectedClub && {
    label: selectedAdded ? 'Added to your map' : atCap ? 'Your map is full' : 'Add to your map',
    onClick: () => addClub(selectedClub),
    disabled: selectedAdded || atCap,
    variant: selectedAdded ? 'secondary' : 'default',
    icon: selectedAdded ? <Check /> : <Plus />,
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-7xl flex-col px-6 py-10 lg:h-svh">
      <div className="flex flex-col gap-1">
        {closeRefused ? (
          <p className="self-start text-xs text-muted-foreground">
            This tab won't close itself here — close it manually to get back to your constellation.
          </p>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="self-start text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            ← Close and return to your constellation
          </button>
        )}
        <h2 className="text-2xl md:text-3xl">Full Directory</h2>
      </div>

      <form onSubmit={onSearch} className="mt-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Write what you're looking for…"
          aria-label="Search clubs by what you're looking for"
          className="h-9"
        />
        <Button type="submit" disabled={!query.trim() || searchLoading}>
          {searchLoading ? 'Searching…' : 'Search'}
        </Button>
        {searchActive && (
          <Button type="button" variant="ghost" size="icon" aria-label="Clear search" onClick={onClear}>
            <X />
          </Button>
        )}
      </form>

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:w-[380px] lg:shrink-0">
          {searchActive && activeData && (
            <p className="text-xs text-muted-foreground">
              Showing matches for "{lastQuery}" ·{' '}
              <button type="button" onClick={onClear} className="underline underline-offset-2 hover:text-foreground">
                Browse all clubs
              </button>
            </p>
          )}
          <DirectoryFilters filters={filters} onChange={setFilters} resultCount={filteredClubs.length} />
          {clubsError && (
            <p className="text-xs text-muted-foreground">Couldn't load the club list. Try refreshing.</p>
          )}
          <div className="min-h-0 flex-1">
            <ClubList
              clubs={filteredClubs}
              loading={clubsLoading}
              selectedId={selectedId}
              hoveredIds={hoveredClubIds}
              scrollToId={scrollToId}
              onSelect={setSelectedId}
              onHover={hoverFromCard}
            />
          </div>
        </div>

        <div className="relative min-h-96 flex-1 overflow-hidden rounded-xl border border-border bg-card lg:min-h-0">
          {searchLoading ? (
            <StarField twinkle />
          ) : activeData && searchClubs.length > 0 ? (
            <StarGraph
              graph={graph}
              selectedId={selectedId}
              hoveredId={hoveredClubId}
              hoveredOutcome={hoveredOutcome}
              onSelect={setSelectedId}
              onSelectEvent={setSelectedId} // no event tab here yet (ClubPanel isn't given selectedEventId); an event star still opens its club
              onHover={hoverFromGraph}
              onHoverOutcome={hoverOutcome}
              panelOpen={!!selectedClub}
            />
          ) : (
            <StarField />
          )}

          {!searchLoading && !searchError && !activeData && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-muted-foreground">Search above to build a graph of what fits.</p>
              <p className="text-xs text-muted-foreground/70">Your main constellation stays exactly as you left it.</p>
            </div>
          )}

          {!searchLoading && activeData && searchClubs.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-muted-foreground">No stars matched that search. Try describing it differently.</p>
            </div>
          )}

          {searchError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-muted-foreground">Couldn't search right now.</p>
              <Button size="sm" onClick={retrySearch}>
                Retry
              </Button>
            </div>
          )}

          {selectedClub && (
            <ClubPanel
              club={selectedClub}
              rank={selectedRank}
              detail={panel.detail}
              loading={panel.loading}
              error={panel.error}
              notFound={panel.notFound}
              onRetry={panel.retry}
              onClose={closePanel}
              mapAction={mapAction}
            />
          )}
        </div>
      </div>
    </div>
  )
}
