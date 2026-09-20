import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, Info, RefreshCw } from 'lucide-react'
import { motion } from '@/lib/theme'
import { cn } from '@/lib/utils'

// A legend for the club cards. It mirrors the zones of ClubCard (rank, name + commitment, why it fits,
// outcome pills, next event + Dropbox line), with each zone showing what it means instead of real data.
// Keep it in step with ClubCard when the card's zones change.
// It is deliberately the one light (inverted) card on the page, so it reads as guidance and can't be mistaken for a
// club card or for a highlight (real cards are dark; a raised surface and lighter border mark selected/hover; blue marks arrival).
// The overlay is positioned against the header row (the nearest positioned ancestor), so it lines up with the
// cards and always fits the screen, instead of hanging off the small circle.

function GuideCard({ id }) {
  return (
    <div
      role="tooltip"
      id={id}
      style={{ animationDuration: `${motion.fast}ms` }}
      className={cn(
        'pointer-events-none absolute top-[calc(100%+8px)] left-0 z-40 w-[min(380px,calc(100vw-3rem))]',
        'animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none',
      )}
    >
      <div className="flex flex-col gap-2.5 rounded-lg bg-primary px-4 py-3.5 text-primary-foreground shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
        <p className="text-[0.65rem] font-medium tracking-[0.12em] uppercase opacity-60">How to read a card</p>
        <div className="flex gap-3">
        <span className="w-5 shrink-0 pt-[3px] text-xs tabular-nums opacity-65">01</span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-baseline gap-3">
            <p className="min-w-0 flex-1 font-heading text-[1.0625rem] leading-tight">Club name</p>
            <span className="flex shrink-0 items-center gap-1.5 text-xs opacity-70">
              <span aria-hidden className="flex gap-[2px]">
                {[1, 2, 3].map((i) => (
                  <span key={i} className={cn('h-2.5 w-[5px] rounded-[1px]', i <= 2 ? 'bg-primary-foreground' : 'bg-primary-foreground/25')} />
                ))}
              </span>
              Time commitment
            </span>
          </div>
          <p className="text-[0.9375rem] leading-snug">Why this is a good fit for you</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-primary-foreground/30 px-2 py-0.5 text-xs leading-4 opacity-80">
              Club outcomes
            </span>
            <span className="text-xs opacity-70">+ more</span>
          </div>
          <div className="flex gap-2 border-t border-primary-foreground/20 pt-2.5">
            <CalendarDays aria-hidden className="mt-px size-3.5 shrink-0 opacity-70" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[0.8125rem] leading-snug opacity-80">
                <span className="font-medium">Next event</span> · when · where
              </p>
              <span className="inline-flex items-center gap-1 text-[0.7rem] leading-none opacity-70">
                <RefreshCw aria-hidden className="size-3 shrink-0" />
                Updated from Dropbox: file name
              </span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A small "i" circle. Hover shows the legend; keyboard focus and tap do too (hover alone would leave those users out).
 * Esc, moving away, or tapping elsewhere closes it.
 */
export default function CardGuide() {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <span ref={ref} className="inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="What's on a club card?"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        style={{ transitionDuration: `${motion.fast}ms` }}
      >
        <Info aria-hidden className="size-[18px]" />
      </button>
      {open && <GuideCard id={id} />}
    </span>
  )
}
