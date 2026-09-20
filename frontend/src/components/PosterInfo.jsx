import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { motion } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * The "i" beside "Drop a poster". Same pattern as CardGuide's "i": hover shows it, and so do keyboard focus and tap
 * (hover alone would leave those users out); Esc, moving away, or tapping elsewhere closes it.
 * The popover hangs under the icon, right-aligned to it, and sizes to its longest line. From 640px up each line stays
 * on one line. Below that the buttons can wrap to the left of the header, so the popover anchors to the header row
 * instead (the icon wrapper is not positioned there) and lines wrap inside a 16px gutter on both sides.
 */
export default function PosterInfo() {
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
    <span ref={ref} className="inline-flex sm:relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="What is Drop a poster?"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className={cn(
          'grid size-6 place-items-center rounded-full outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          open ? 'text-foreground' : 'text-muted-foreground',
        )}
        style={{ transitionDuration: `${motion.fast}ms` }}
      >
        <Info aria-hidden className="size-[18px]" />
      </button>
      {open && (
        <div
          role="tooltip"
          id={id}
          style={{ animationDuration: `${motion.fast}ms` }}
          className={cn(
            // phones: 8px past the header's right edge, so the popover's own edge sits 16px inside the screen (the page
            // has 24px sides); from 640px it is right-aligned to the icon
            'pointer-events-none absolute top-[calc(100%+8px)] right-0 z-40 max-sm:-right-2',
            'w-max max-w-[calc(100vw-32px)] rounded-[12px] border-[0.5px] border-border bg-secondary px-4 py-3.5',
            'flex flex-col gap-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]',
            'animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none',
          )}
        >
          <p className="text-[15px] leading-snug font-medium text-foreground sm:whitespace-nowrap">Flyers? Event Graphics? Drop it.</p>
          <p className="text-[13px] leading-snug text-muted-foreground sm:whitespace-nowrap">We pull the date, time and place.</p>
          <p className="text-[13px] leading-snug text-foreground sm:whitespace-nowrap">
            <span aria-hidden className="mr-1.5">
              ✦
            </span>
            Add stars to people's constellations.
          </p>
        </div>
      )}
    </span>
  )
}
