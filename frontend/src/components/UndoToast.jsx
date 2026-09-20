import { useEffect } from 'react'
import { X } from 'lucide-react'
import { motion } from '@/lib/theme'
import { cn } from '@/lib/utils'

const DISMISS_MS = 6000

/**
 * A single bottom toast with an Undo action, for a reversible destructive action (removing a club from your
 * map). Same visual language as ArrivalToast, simpler: one message, one undo, one auto-dismiss.
 * @param {{ message: string, onUndo: () => void, onDismiss: () => void, className?: string }} props
 */
export default function UndoToast({ message, onUndo, onDismiss, className }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, DISMISS_MS)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      role="status"
      style={{ animationDuration: `${motion.base}ms` }}
      className={cn(
        'fixed inset-x-3 bottom-3 z-30 flex animate-in items-center gap-3 rounded-lg border border-border bg-card py-2.5 pr-2.5 pl-4 shadow-[0_12px_36px_rgba(0,0,0,0.5)] fade-in slide-in-from-bottom-2 motion-reduce:animate-none lg:inset-x-auto lg:right-6 lg:left-auto lg:w-80',
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 rounded-sm px-1.5 py-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        Undo
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}
