import { CalendarDays, CalendarX2, Info } from 'lucide-react'
import DropboxProvenance from '@/components/DropboxProvenance'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEventTime } from '@/lib/format'
import { outcomeLabel } from '@/lib/labels'
import { motion } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { normalizeOutcome } from '@/types'

// The card has fixed zones in a fixed order, so every card scans the same way:
//   header (rank, name, commitment) → why it fits you → what it offers (outcome pills) → next event (+ Dropbox)
// Hover and selected are neutral (raised surface + border). Blue is for the Dropbox arrival and provenance only.

const MAX_PILLS = 2
const LEVELS = { casual: 1, moderate: 2, intense: 3 }

const isLimited = (summary) =>
  summary === null || (typeof summary === 'string' && summary.trim().toLowerCase() === 'limited info')

function outcomeKeys(outcomes) {
  const keys = (outcomes ?? []).map(normalizeOutcome).filter(Boolean) // unknown values are skipped
  return [...new Set(keys)]
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Three bars plus the word, e.g. ▮▮▯ Moderate. Hidden when unknown. */
function Commitment({ value }) {
  const level = LEVELS[value]
  if (!level) return null
  return (
    <span
      aria-label={`${capitalize(value)} commitment`}
      className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span aria-hidden className="flex gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn('h-2.5 w-[5px] rounded-[1px]', i <= level ? 'bg-foreground' : 'bg-border')} />
        ))}
      </span>
      <span aria-hidden>{capitalize(value)}</span>
    </span>
  )
}

/** Outline pills, one neutral color (no per-outcome colors). At most 2, then "+N". */
function Offers({ keys, limited }) {
  if (!keys.length && !limited) return null
  const shown = keys.slice(0, MAX_PILLS)
  const extra = keys.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((k) => (
        <span key={k} className="rounded-full border border-border px-2 py-0.5 text-xs leading-4 text-muted-foreground">
          {outcomeLabel(k, { short: true })}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title={keys.slice(MAX_PILLS).map((k) => outcomeLabel(k)).join(', ')}
        >
          +{extra}
        </span>
      )}
      {limited && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Info aria-hidden className="size-3.5" />
          Limited info
        </span>
      )}
    </div>
  )
}

/** Footer under a hairline: the next thing to show up to, and where it came from. */
function NextEvent({ event }) {
  if (event === undefined) return null // backend didn't send next_event at all: no footer
  if (event === null) {
    return (
      <div className="flex items-center gap-2 border-t border-border pt-2.5 text-xs text-muted-foreground/80">
        <CalendarX2 aria-hidden className="size-3.5 shrink-0" />
        No upcoming events yet
      </div>
    )
  }
  const detail = [formatEventTime(event.start), event.location].filter(Boolean).join(' · ')
  return (
    <div className="flex gap-2 border-t border-border pt-2.5">
      <CalendarDays aria-hidden className="mt-px size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[0.8125rem] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{event.title}</span>
          {detail && ` · ${detail}`}
        </p>
        <DropboxProvenance event={event} />
      </div>
    </div>
  )
}

/**
 * @param {{ club: object, rank?: number, selected?: boolean, hovered?: boolean, highlighted?: boolean,
 *   onSelect?: (id: string) => void, onHover?: (id: string | null) => void }} props
 * `highlighted`: a new Dropbox event just arrived for this club (one restrained blue highlight, no loop).
 */
export default function ClubCard({ club, rank, selected = false, hovered = false, highlighted = false, onSelect, onHover }) {
  const keys = outcomeKeys(club.outcomes)

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
          ? 'border-foreground bg-secondary'
          : hovered
            ? 'border-muted-foreground bg-secondary'
            : 'border-transparent bg-card hover:border-muted-foreground hover:bg-secondary',
      )}
    >
      {highlighted && (
        <span
          aria-hidden
          className="arrival pointer-events-none absolute inset-0 -z-10 rounded-lg border border-starlight bg-starlight-muted"
        />
      )}
      {rank != null && (
        <span className={cn('w-5 shrink-0 pt-[3px] text-xs tabular-nums', selected ? 'text-foreground' : 'text-muted-foreground')}>
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-baseline gap-3">
          <h3 className="min-w-0 flex-1 truncate text-[1.0625rem] leading-tight" title={club.name}>
            {club.name}
          </h3>
          <Commitment value={club.commitment} />
        </div>
        {club.why_it_fits && (
          <p className="line-clamp-2 text-[0.9375rem] leading-snug text-foreground">{club.why_it_fits}</p>
        )}
        <Offers keys={keys} limited={isLimited(club.summary)} />
        <NextEvent event={club.next_event} />
      </div>
    </div>
  )
}

export function ClubCardSkeleton() {
  return (
    <div aria-hidden className="flex gap-3 rounded-lg bg-card px-4 py-3.5">
      <Skeleton className="mt-0.5 h-3 w-5" />
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}
