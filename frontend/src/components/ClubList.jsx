import { useEffect, useRef } from 'react'
import ClubCard, { ClubCardSkeleton } from '@/components/ClubCard'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function ClubList({ clubs = [], selectedId, hoveredId, highlightIds, onSelect, onHover, loading }) {
  const listRef = useRef(null)

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
                hovered={club.id === hoveredId}
                highlighted={highlightIds?.has(String(club.id)) ?? false}
                onSelect={onSelect}
                onHover={onHover}
              />
            ))}
      </div>
    </ScrollArea>
  )
}
