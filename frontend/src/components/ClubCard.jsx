import { Info } from 'lucide-react'
import DropboxProvenance from '@/components/DropboxProvenance'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEventTime } from '@/lib/format'
import { outcomeLabel } from '@/lib/labels'
import { motion } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { normalizeOutcome } from '@/types'

const isLimited = (summary) =>
  summary === null || (typeof summary === 'string' && summary.trim().toLowerCase() === 'limited info')

function outcomeKeys(outcomes) {
  const keys = (outcomes ?? []).map(normalizeOutcome).filter(Boolean) // unknown values are skipped
  return [...new Set(keys)]
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function EventRow({ event }) {
  if (event === undefined) return null // backend doesn't send next_event yet
  if (event === null) return <p className="text-xs text-muted-foreground">No upcoming events listed</p>
  const line = [event.title, formatEventTime(event.start), event.location].filter(Boolean).join(' · ')
  return (
    <>
      <p className="text-xs text-muted-foreground">{line}</p>
      <DropboxProvenance event={event} />
    </>
  )
}

/**
 * @param {{ club: object, rank?: number, selected?: boolean, hovered?: boolean, highlighted?: boolean,
 *   onSelect?: (id: string) => void, onHover?: (id: string | null) => void }} props
 * `highlighted`: a new Dropbox event just arrived for this club (one restrained gold highlight, no loop).
 */
export default function ClubCard({ club, rank, selected = false, hovered = false, highlighted = false, onSelect, onHover }) {
  const keys = outcomeKeys(club.outcomes)
  const meta = [
    ...keys.map((k) => outcomeLabel(k, { short: true })),
    club.commitment && club.commitment !== 'unknown' ? capitalize(club.commitment) : null,
  ].filter(Boolean)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-club-id={club.id}
      onClick={() => onSelect?.(club.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return // keys on the inner link are not ours
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(club.id)
        }
      }}
      onMouseEnter={() => onHover?.(club.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(club.id)}
      onBlur={() => onHover?.(null)}
      style={{ transitionDuration: `${motion.base}ms` }}
      className={cn(
        'relative isolate flex cursor-pointer gap-3 rounded-lg border px-4 py-3.5 outline-none',
        'transition-[background-color,border-color,box-shadow]',
        'focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-gold bg-secondary ring-1 ring-gold/50'
          : hovered
            ? 'border-gold/40 bg-secondary'
            : 'border-transparent bg-card hover:border-gold/40 hover:bg-secondary',
      )}
    >
      {highlighted && (
        <span
          aria-hidden
          className="arrival pointer-events-none absolute inset-0 -z-10 rounded-lg border border-gold bg-gold-muted/60"
        />
      )}
      {rank != null && (
        <span className={cn('w-5 shrink-0 pt-[3px] text-xs tabular-nums', selected ? 'text-gold' : 'text-muted-foreground')}>
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="truncate text-base" title={club.name}>
          {club.name}
        </h3>
        {club.why_it_fits && <p className="line-clamp-3 text-sm leading-snug text-foreground/90">{club.why_it_fits}</p>}
        {meta.length > 0 && <p className="text-xs text-muted-foreground">{meta.join(' · ')}</p>}
        <EventRow event={club.next_event} />
        {isLimited(club.summary) && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info aria-hidden className="size-3.5" />
            Limited info so far
          </p>
        )}
      </div>
    </div>
  )
}

export function ClubCardSkeleton() {
  return (
    <div aria-hidden className="flex gap-3 rounded-lg bg-card px-4 py-3.5">
      <Skeleton className="mt-0.5 h-3 w-5" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}
