import { Fragment, useEffect, useRef } from 'react'
import { ArrowUpRight, Info, Mail, X } from 'lucide-react'
import DropboxProvenance from '@/components/DropboxProvenance'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isLimitedSummary, scrubText, toEventLite } from '@/lib/club'
import { formatEventTime } from '@/lib/format'
import { outcomeLabel } from '@/lib/labels'
import { motion } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { normalizeOutcome } from '@/types'

/** Width of the panel over the graph on large screens. StarGraph refits the stars into the space left of it. */
export const PANEL_WIDTH = 340
export const PANEL_GAP = 12

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  )
}

function ExternalLink({ href, children, className, kind = 'link' }) {
  const isEmail = kind === 'email' || href.startsWith('mailto:')
  return (
    <a
      href={href}
      {...(isEmail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm text-sm text-foreground underline-offset-2 outline-none',
        'hover:underline focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children}
      {isEmail ? (
        <Mail aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </a>
  )
}

function EventItem({ event }) {
  const line = [formatEventTime(event.start), event.location].filter(Boolean).join(' · ')
  return (
    <li className="flex flex-col gap-1 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
      <p className="text-sm leading-snug">{event.title}</p>
      {line && <p className="text-xs text-muted-foreground">{line}</p>}
      {(event.source === 'dropbox' || event.rsvp_url) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <DropboxProvenance event={event} />
          {event.rsvp_url && (
            <ExternalLink href={event.rsvp_url} className="text-xs">
              RSVP
            </ExternalLink>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Club detail over the right side of the graph (a bottom sheet on small screens).
 * Renders at once from the ranked match (why it fits, next event); GET /clubs/:id fills in the rest.
 * Never shows organizer contacts: `detail` comes from sanitizeClub in lib/club.js.
 * @param {{ club: object, rank?: number, detail: import('@/lib/club').ClubDetail | null, loading: boolean,
 *   error: Error | null, notFound?: boolean, onRetry: () => void, onClose: () => void }} props
 */
export default function ClubPanel({ club, rank, detail, loading, error, notFound = false, onRetry, onClose }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [club.id])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const keys = [...new Set((club.outcomes ?? []).map(normalizeOutcome).filter(Boolean))]
  const commitment = detail?.commitment ?? club.commitment
  const meta = [
    ...keys.map((k) => outcomeLabel(k)),
    commitment && commitment !== 'unknown' ? `${capitalize(commitment)} commitment` : null,
  ].filter(Boolean)

  const why = scrubText(club.why_it_fits)
  const summary = detail ? detail.summary : scrubText(club.summary) || null
  // Before details arrive (or if they can't), fall back to the match's next event.
  const events = detail ? detail.events : club.next_event ? [toEventLite(club.next_event)] : []
  const links = detail?.links ?? []

  return (
    <aside
      aria-label={`${club.name} details`}
      style={{ '--panel-w': `${PANEL_WIDTH}px`, '--panel-gap': `${PANEL_GAP}px`, animationDuration: `${motion.base}ms` }}
      className={cn(
        'z-20 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_48px_rgba(0,0,0,0.5)]',
        'fixed inset-x-3 bottom-3 max-h-[75svh]',
        'lg:absolute lg:inset-x-auto lg:top-(--panel-gap) lg:right-(--panel-gap) lg:bottom-(--panel-gap) lg:max-h-none lg:w-(--panel-w)',
        'animate-in fade-in slide-in-from-right-2 motion-reduce:animate-none',
      )}
    >
      <header className="flex items-start gap-3 border-b border-border px-5 pt-4 pb-3.5">
        {rank != null && (
          <span className="shrink-0 pt-[7px] text-xs text-muted-foreground tabular-nums">{String(rank).padStart(2, '0')}</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-xl leading-tight">{club.name}</h3>
          {meta.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {/* the dot stays attached to the item before it, so a wrapped line never starts with "·" */}
              {meta.map((item, i) => (
                <Fragment key={item}>
                  {i > 0 && ' '}
                  <span className="whitespace-nowrap">
                    {item}
                    {i < meta.length - 1 && ' ·'}
                  </span>
                </Fragment>
              ))}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-1.5 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Close details"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>

      <div ref={scrollRef} className="flex flex-col gap-5 overflow-y-auto px-5 pt-4 pb-5">
        {why && (
          <Section title="Why it fits you">
            <p className="text-sm leading-relaxed text-foreground/90">{why}</p>
          </Section>
        )}

        <Section title="About">
          {isLimitedSummary(summary) ? (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Limited info so far. The SOP listing may have more.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
          )}
        </Section>

        {detail?.meeting_info && (
          <Section title="Meets">
            <p className="text-sm text-foreground/90">{detail.meeting_info}</p>
          </Section>
        )}

        <Section title="Upcoming">
          {events.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {events.map((ev) => (
                <EventItem key={ev.id} event={ev} />
              ))}
            </ul>
          ) : loading ? (
            <div aria-hidden className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming events listed yet.</p>
          )}
        </Section>

        {loading && !detail ? (
          <div aria-hidden className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : (
          links.length > 0 && (
            <Section title="Links">
              <ul className="flex flex-col gap-1.5">
                {links.map((l) => (
                  <li key={l.href}>
                    <ExternalLink href={l.href} kind={l.kind}>{l.label}</ExternalLink>
                  </li>
                ))}
              </ul>
            </Section>
          )
        )}

        {error && (
          <p className="text-xs text-muted-foreground">
            Couldn't load the full listing.{' '}
            <button
              type="button"
              onClick={onRetry}
              className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Try again
            </button>
          </p>
        )}
        {import.meta.env.DEV && notFound && (
          <p className="text-xs text-muted-foreground">Dev: GET /clubs/{club.id} returned 404.</p>
        )}
      </div>
    </aside>
  )
}
