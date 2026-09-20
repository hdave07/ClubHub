import { Check, X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { motion, sky } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * What happened to the poster the student just chose: reading it, the server's answer, or a plain error. It is
 * feedback only: the "Drop a poster" button in the header opens the file picker, and this hangs under it. It never
 * promises an event will appear; the wording of a result comes from the server.
 * @param {{ state: { phase: 'idle' | 'uploading' | 'done' | 'error', name?: string, ok?: boolean, message?: string },
 *   onClose: () => void, onAgain: () => void, className?: string }} props
 */
export default function AddEventPanel({ state, onClose, onAgain, className }) {
  const { phase } = state
  useEffect(() => {
    if (phase === 'idle' || phase === 'uploading') return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, onClose])

  if (phase === 'idle') return null

  return (
    <div
      role={phase === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      style={{ animationDuration: `${motion.base}ms` }}
      className={cn(
        'absolute top-full right-0 z-30 mt-2 flex w-[min(21rem,calc(100vw-3rem))] flex-col gap-3 rounded-xl border border-border bg-card p-4',
        'shadow-[0_16px_48px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none',
        className,
      )}
    >
      {phase === 'uploading' ? (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <div aria-hidden className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="twinkle size-1.5 rounded-full"
                style={{ background: sky.stars, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <p className="text-sm">Reading your poster…</p>
          <p className="max-w-full truncate text-xs text-muted-foreground">{state.name} · about 10 seconds</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="flex gap-2 text-sm leading-snug">
              {phase === 'done' && state.ok && <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />}
              <span>{state.message}</span>
            </p>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onAgain}>
              {phase === 'error' ? 'Try again' : 'Add another'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              {phase === 'error' ? 'Dismiss' : 'Done'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
