import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEventTime } from '@/lib/format'
import { gold, motion, outcomeColor, sky } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { OUTCOME_LABELS, normalizeOutcome } from '@/types'

const isLimited = (summary) =>
  summary === null || (typeof summary === 'string' && summary.trim().toLowerCase() === 'limited info')

function outcomeKeys(outcomes) {
  const keys = (outcomes ?? []).map(normalizeOutcome).filter(Boolean) // unknown values are skipped
  return [...new Set(keys)]
}

function EventRow({ event }) {
  if (event === undefined) return null // backend doesn't send next_event yet
  if (event === null) return <p className="text-xs text-muted-foreground">No upcoming events listed</p>

  const line = [event.title, formatEventTime(event.start), event.location].filter(Boolean).join(' · ')
  const label = `Updated from Dropbox${event.source_file ? `: ${event.source_file}` : ''}`
  const badgeStyle = { background: gold.color, color: sky.bg, boxShadow: `0 0 12px 2px ${gold.glow}` }

  return (
    <div className="flex flex-col items-start gap-1.5 text-xs">
      <p className="text-muted-foreground">{line}</p>
      {event.source === 'dropbox' &&
        (event.dropbox_link ? (
          <a
            href={event.dropbox_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} // the link must not select the card
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge style={badgeStyle}>{label}</Badge>
          </a>
        ) : (
          <Badge style={badgeStyle}>{label}</Badge>
        ))}
    </div>
  )
}

export default function ClubCard({ club, rank, selected = false, hovered = false, onSelect, onHover }) {
  const keys = outcomeKeys(club.outcomes)
  const showCommitment = club.commitment && club.commitment !== 'unknown'

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
      style={{ transitionDuration: `${motion.fast}ms` }}
      className={cn(
        'flex cursor-pointer flex-col gap-3 rounded-xl border p-4 outline-none',
        'transition-[background-color,border-color,box-shadow]',
        'focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-transparent bg-secondary ring-[1.5px] ring-heading/80'
          : hovered
            ? 'border-foreground/25 bg-secondary'
            : 'border-border bg-card hover:border-foreground/25 hover:bg-secondary',
      )}
    >
      <div className="flex items-baseline gap-2">
        {rank != null && <span className="text-xs text-muted-foreground">#{rank}</span>}
        <h3 className="truncate text-base" title={club.name}>
          {club.name}
        </h3>
      </div>

      {club.why_it_fits && (
        <div className="flex flex-col gap-1">
          <p className="text-[0.65rem] tracking-widest text-muted-foreground">WHY THIS FITS YOU</p>
          <p className="line-clamp-3 text-sm text-foreground">{club.why_it_fits}</p>
        </div>
      )}

      {keys.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keys.map((key) => {
            const color = outcomeColor(key)
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                style={{ color, background: `${color}1F` }} // 12% tint
              >
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: color }} />
                {OUTCOME_LABELS[key]}
              </span>
            )
          })}
        </div>
      )}

      {showCommitment && (
        <div>
          <Badge variant="outline" className="capitalize">
            {club.commitment}
          </Badge>
        </div>
      )}

      <EventRow event={club.next_event} />

      {isLimited(club.summary) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden className="size-3.5" />
          Limited info so far
        </p>
      )}
    </div>
  )
}

export function ClubCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <Skeleton className="h-5 w-3/5" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}
