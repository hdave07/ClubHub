import { X } from 'lucide-react'
import { useEffect } from 'react'
import { formatEventTime } from '@/lib/format'
import { motion } from '@/lib/theme'
import { cn } from '@/lib/utils'

const DISMISS_MS = 8000

/**
 * @typedef {{ key: string, clubId: string, clubName: string, event: import('@/lib/events').LiveEvent }} Arrival
 */

function ArrivalItem({ arrival, onOpen, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(arrival.key), DISMISS_MS)
    return () => clearTimeout(t)
  }, [arrival.key, onDismiss])

  const { event } = arrival
  const meta = [arrival.clubName, formatEventTime(event.start)].filter(Boolean).join(' · ')
  return (
    <li
      className="relative flex animate-in items-start gap-3 rounded-lg border border-gold/60 bg-card py-3 pr-9 pl-4 shadow-[0_12px_36px_rgba(0,0,0,0.5)] fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
      style={{ animationDuration: `${motion.base}ms` }}
    >
      <button
        type="button"
        onClick={() => onOpen(arrival)}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-1.5 text-[0.65rem] tracking-[0.2em] text-gold">
          <span aria-hidden className="size-1.5 rounded-full bg-gold" />
          NEW FROM DROPBOX
        </span>
        <span className="truncate text-sm">{event.title}</span>
        {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(arrival.key)}
        className="absolute top-2 right-2 rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  )
}

/**
 * New Dropbox events for clubs whose card is scrolled out of view. Clicking one opens that club; each goes away
 * after 8 seconds. Stacks at most 3.
 * @param {{ arrivals: Arrival[], onOpen: (a: Arrival) => void, onDismiss: (key: string) => void, className?: string }} props
 */
export default function ArrivalToast({ arrivals, onOpen, onDismiss, className }) {
  return (
    <ol
      aria-live="polite"
      aria-label="New events"
      className={cn(
        'pointer-events-none fixed inset-x-3 top-3 z-30 flex flex-col gap-2 lg:inset-x-auto lg:top-auto lg:right-6 lg:bottom-6 lg:w-80',
        '[&>li]:pointer-events-auto',
        className,
      )}
    >
      {arrivals.map((a) => (
        <ArrivalItem key={a.key} arrival={a} onOpen={onOpen} onDismiss={onDismiss} />
      ))}
    </ol>
  )
}
