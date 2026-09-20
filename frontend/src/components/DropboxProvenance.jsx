import { CloudUpload } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Updated from Dropbox: {source_file}", linked to the source file. Always visible and quiet: small text,
 * no pill, no glow. Sage is the palette's one secondary accent and is used only here, so Dropbox-sourced
 * events are recognizable at a glance without borrowing gold (selected/hover/arrival).
 * Shared by the club card and the club panel's event list.
 * @param {{ event?: import('@/types').EventLite | null, className?: string }} props
 */
export default function DropboxProvenance({ event, className }) {
  if (event?.source !== 'dropbox') return null
  const text = `Updated from Dropbox${event.source_file ? `: ${event.source_file}` : ''}`
  const base = cn('inline-flex items-center gap-1 text-[0.72rem] leading-none text-sage', className)
  const content = (
    <>
      <CloudUpload aria-hidden className="size-3 shrink-0" />
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
        'rounded-sm underline-offset-2 outline-none decoration-sage/40 hover:underline focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {content}
    </a>
  )
}
