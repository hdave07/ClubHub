import { Check, FileUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { confirmEvent, uploadFlier } from '@/lib/api'
import { motion, sky } from '@/lib/theme'
import { cn } from '@/lib/utils'

// Same allowlist and size cap as backend/app/routers/upload.py, checked here first so a bad file never costs a
// Claude call.
const ACCEPT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf']
const MAX_BYTES = 10 * 1024 * 1024
const WRONG_FILE = 'Try a PNG, JPG or PDF under 10 MB.'

const extOf = (name) => (name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()

function problemWith(file) {
  if (!file) return null
  if (!ACCEPT.includes(extOf(file.name)) || file.size === 0 || file.size > MAX_BYTES) return WRONG_FILE
  return null
}

/** Human message for a failed request. Backend `detail` strings are written for users; network errors are not. */
function errorMessage(e) {
  const status = e?.response?.status
  const detail = e?.response?.data?.detail
  if (status === 413 || status === 415 || status === 400) return typeof detail === 'string' ? detail : WRONG_FILE
  return "Couldn't reach the server. Try again in a moment."
}

/**
 * One event extraction couldn't fully read: title and location came through, but `event.missing` (see
 * backend/app/services/extraction.py's missing_fields) says which single piece didn't. Asks for exactly
 * that piece -- a full date+time when nothing was legible, or just a time when the date was -- and
 * publishes it immediately (POST /events/:id/confirm) rather than it sitting in pending_review forever.
 * @param {{ event: object, onConfirmed: (eventId: string, updated: object) => void }} props
 */
function ConfirmEventForm({ event, onConfirmed }) {
  const needsDate = event.missing?.includes('date') ?? true
  // start_local is a bare date ("2026-09-25") in exactly the "missing time" case (see missing_fields):
  // the model read a date but no time of day.
  const knownDate = !needsDate ? event.start_local : null
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!value || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await confirmEvent(event.id, needsDate ? value : `${knownDate}T${value}:00`)
      onConfirmed(event.id, updated)
    } catch (err) {
      setError(typeof err?.response?.data?.detail === 'string' ? err.response.data.detail : "Couldn't save that.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="truncate text-sm" title={event.title}>
        {event.title}
      </p>
      <div className="flex items-center gap-2">
        {needsDate ? (
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`Date and time for ${event.title}`}
            required
            className="h-8 flex-1"
          />
        ) : (
          <>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(`${knownDate}T00:00:00`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <Input
              type="time"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label={`Time for ${event.title}`}
              required
              className="h-8 flex-1"
            />
          </>
        )}
        <Button type="submit" size="sm" disabled={!value || busy}>
          {busy ? 'Saving…' : 'Confirm'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-foreground/90">
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * "Add an event": a student drops a poster or flyer; the backend stores it in Dropbox and reads it (POST /upload).
 * Published events for the student's own result clubs go to `onPublished` (they light up at once); everything else
 * is explained in the panel. Never promises an event will appear: unclear details wait for review.
 * @param {{ open: boolean, onClose: () => void, resultClubIds: Set<string>,
 *   onPublished: (events: object[]) => void, className?: string }} props
 */
export default function AddEventPanel({ open, onClose, resultClubIds, onPublished, className }) {
  const [state, setState] = useState({ phase: 'idle' }) // idle | uploading | confirm | done | error
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const panel = useRef(null)
  // Mirrors the confirm phase's bookkeeping, mutated synchronously so two forms confirmed close together can't
  // race: each ConfirmEventForm's onConfirmed prop is a fresh closure per render, so if one submission is still
  // in flight when another's resolves and re-renders this component, the in-flight one's callback would read a
  // stale `state.pending` when it later resolves. This ref is the same object across every render, so whichever
  // closure calls handleConfirmed always reads and mutates the current value.
  const confirming = useRef(null) // { pending, mine, clubId, publishedCount } | null

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function send(file) {
    const problem = problemWith(file)
    if (problem) {
      setState({ phase: 'error', message: problem })
      return
    }
    setState({ phase: 'uploading', name: file.name })
    try {
      const res = await uploadFlier(file)
      const clubId = res.club?.id != null ? String(res.club.id) : null
      const events = res.events ?? []
      const published = events.filter((e) => e.status === 'published')
      // Never sits in pending_review unreachable: anything else came with `missing` (extraction.py's
      // missing_fields) saying exactly what to ask for, so it goes straight to a confirm form instead.
      const pending = events.filter((e) => e.status !== 'published')
      const mine = clubId != null && resultClubIds.has(clubId)

      if (mine && published.length) {
        onPublished(published.map((e) => ({ ...e, club_id: clubId, source: 'dropbox' })))
      }

      if (pending.length) {
        confirming.current = { pending, mine, clubId, publishedCount: published.length }
        setState({ phase: 'confirm', pending })
        return
      }
      if (mine && published.length) {
        setState({ phase: 'idle' })
        onClose() // the card and star light up; the panel would only cover them
        return
      }
      let note = null
      if (published.length) note = "It'll show for students it matches."
      setState({ phase: 'done', ok: published.length > 0, message: res.message, note })
    } catch (e) {
      setState({ phase: 'error', message: errorMessage(e) })
    }
  }

  function handleConfirmed(eventId, updated) {
    const c = confirming.current
    if (!c) return
    c.pending = c.pending.filter((e) => e.id !== eventId)
    c.publishedCount += 1
    if (c.mine) onPublished([{ ...updated, club_id: c.clubId, source: 'dropbox' }])

    if (c.pending.length) {
      setState({ phase: 'confirm', pending: c.pending })
      return
    }
    confirming.current = null
    if (c.mine) {
      setState({ phase: 'idle' })
      onClose()
      return
    }
    setState({
      phase: 'done',
      ok: true,
      message: `Added ${c.publishedCount} event${c.publishedCount === 1 ? '' : 's'}.`,
      note: "It'll show for students it matches.",
    })
  }

  const pick = () => input.current?.click()
  const busy = state.phase === 'uploading'

  return (
    <div
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-label="Add an event"
      style={{ animationDuration: `${motion.base}ms` }}
      className={cn(
        'absolute top-full right-0 z-30 mt-2 flex w-[min(21rem,calc(100vw-3rem))] flex-col gap-3 rounded-xl border border-border bg-card p-4 outline-none',
        'shadow-[0_16px_48px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg">Add an event</h3>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Snap a flyer or drop a poster. It goes live once the details are clear.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept={[...ACCEPT, 'image/*'].join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // choosing the same file again still fires
          if (file) send(file)
        }}
      />

      {state.phase === 'uploading' ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border px-4 py-7 text-center" aria-live="polite">
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
      ) : state.phase === 'confirm' ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-sm leading-snug text-muted-foreground">
            {state.pending.length === 1
              ? "We couldn't read this one clearly. Mind confirming it?"
              : `We couldn't read ${state.pending.length} of these clearly. Mind confirming them?`}
          </p>
          <div className="flex flex-col gap-2.5">
            {state.pending.map((event) => (
              <ConfirmEventForm key={event.id} event={event} onConfirmed={handleConfirmed} />
            ))}
          </div>
        </div>
      ) : state.phase === 'done' ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="flex gap-2 text-sm leading-snug">
            {state.ok && <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />}
            <span>
              {state.message}
              {state.note && <span className="text-muted-foreground"> {state.note}</span>}
            </span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={pick}>
              Add another
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              send(e.dataTransfer.files?.[0])
            }}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center outline-none',
              'transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              dragging ? 'border-gold bg-gold-muted/40' : 'border-border hover:border-gold/50 hover:bg-secondary',
            )}
            style={{ transitionDuration: `${motion.base}ms` }}
          >
            <FileUp aria-hidden className={cn('size-5', dragging ? 'text-gold' : 'text-muted-foreground')} />
            <span className="text-sm">Drop a poster here</span>
            <span className="text-xs text-muted-foreground">or choose a photo or file</span>
          </button>
          {state.phase === 'error' ? (
            <p role="alert" className="text-xs text-foreground/90">
              {state.message}
            </p>
          ) : (
            <p className="text-xs leading-snug text-muted-foreground">
              PNG, JPG or PDF, up to 10 MB. It's saved to our Dropbox and linked from the event.
            </p>
          )}
        </>
      )}
    </div>
  )
}
