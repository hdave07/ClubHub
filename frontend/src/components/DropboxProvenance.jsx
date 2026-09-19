import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Updated from Dropbox: {source_file}", linked to the source file. Always visible, deliberately quiet:
 * small secondary text, no pill, no glow. Shared by the club card and (later) the club panel's event list.
 * @param {{ event?: import('@/types').EventLite | null, className?: string }} props
 */
export default function DropboxProvenance({ event, className }) {
  if (event?.source !== 'dropbox') return null
  const text = `Updated from Dropbox${event.source_file ? `: ${event.source_file}` : ''}`
  const base = cn('inline-flex items-center gap-1 text-[0.7rem] leading-none text-muted-foreground', className)
  const content = (
    <>
      <RefreshCw aria-hidden className="size-3 shrink-0" />
      {text}
    </>
  )
  if (!event.dropbox_link) return <span className={base}>{content}</span>
  return (
    <a
      href={event.dropbox_link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()} // the link must not select the card
      className={cn(
        base,
        'rounded-sm underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {content}
    </a>
  )
}
