import { useEffect, useRef } from 'react'
import ClubCard, { ClubCardSkeleton } from '@/components/ClubCard'
import { ScrollArea } from '@/components/ui/scroll-area'

const SCROLL_DELAY = 200 // ms a graph hover must last before the list scrolls to its card

/**
 * @param {{ clubs?: object[], selectedId?: string | null, hoveredId?: string | null, hoveredIds?: Set<string>,
 *   scrollToId?: string | null, highlightIds?: Set<string>, onSelect?: Function, onHover?: Function, loading?: boolean }} props
 * `hoveredIds`: every card to highlight (one club, or all clubs under a hovered outcome).
 * `dimOthers`: while an outcome is hovered, the cards outside `hoveredIds` fade to match the dimmed graph.
 * `scrollToId`: a single club hovered in the graph; if its card is not fully visible the list scrolls to it after a
 * short delay (cancelled when the hover ends). Only this list scrolls, never the page.
 */
export default function ClubList({
  clubs = [],
  selectedId,
  hoveredId,
  hoveredIds,
  scrollToId = null,
  highlightIds,
  dimOthers = false,
  onSelect,
  onHover,
  loading,
}) {
  const listRef = useRef(null)

  useEffect(() => {
    if (scrollToId == null) return undefined
    const timer = setTimeout(() => {
      const card = [...(listRef.current?.querySelectorAll('[data-club-id]') ?? [])].find(
        (n) => n.dataset.clubId === String(scrollToId),
      )
      const viewport = card?.closest('[data-slot="scroll-area-viewport"]')
      if (!card || !viewport) return
      const c = card.getBoundingClientRect()
      const v = viewport.getBoundingClientRect()
      const delta = c.top < v.top ? c.top - v.top - 4 : c.bottom > v.bottom ? c.bottom - v.bottom + 4 : 0 // "nearest"
      if (!delta) return // already fully visible
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      viewport.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' })
    }, SCROLL_DELAY)
    return () => clearTimeout(timer)
  }, [scrollToId])

  // Bring the selected card into view (graph clicks in Sprint 5).
  useEffect(() => {
    if (selectedId == null || !listRef.current) return
    const el = [...listRef.current.querySelectorAll('[data-club-id]')].find(
      (n) => n.dataset.clubId === String(selectedId),
    )
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }, [selectedId])

  return (
    <ScrollArea className="h-[70svh] w-full lg:h-full lg:w-[380px] lg:shrink-0">
      <div ref={listRef} className="flex flex-col gap-2.5 p-1 pr-3">
        {loading
          ? [0, 1, 2, 3, 4].map((i) => <ClubCardSkeleton key={i} />)
          : clubs.map((club, i) => (
              <ClubCard
                key={club.id}
                club={club}
                rank={i + 1}
                selected={club.id === selectedId}
                hovered={club.id === hoveredId || (hoveredIds?.has(String(club.id)) ?? false)}
                highlighted={highlightIds?.has(String(club.id)) ?? false}
                dimmed={dimOthers && !!hoveredIds?.size && !hoveredIds.has(String(club.id))}
                onSelect={onSelect}
                onHover={onHover}
              />
            ))}
      </div>
    </ScrollArea>
  )
}
