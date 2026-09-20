import { Camera, Check, FolderOpen, Image as ImageIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import DropboxLogo from '@/components/DropboxLogo'
import { Button } from '@/components/ui/button'
import { uploadFlier } from '@/lib/api'
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
 * "Add an event": a student drops a poster or flyer; the backend stores it in Dropbox and reads it (POST /upload).
 * Published events for the student's own result clubs go to `onPublished` (they light up at once); everything else
 * is explained in the panel. Never promises an event will appear: unclear details wait for review.
 * @param {{ open: boolean, onClose: () => void, resultClubIds: Set<string>,
 *   onPublished: (events: object[]) => void, className?: string }} props
 */
export default function AddEventPanel({ open, onClose, resultClubIds, onPublished, className }) {
  const [state, setState] = useState({ phase: 'idle' }) // idle | uploading | done | error
  const [dragging, setDragging] = useState(false)
  const [menu, setMenu] = useState(false) // the three ways to add a file
  const browseInput = useRef(null)
  const cameraInput = useRef(null)
  const libraryInput = useRef(null)
  const panel = useRef(null)

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
      const published = (res.events ?? []).filter((e) => e.status === 'published')
      const mine = clubId != null && resultClubIds.has(clubId)
      if (mine && published.length) {
        onPublished(published.map((e) => ({ ...e, club_id: clubId, source: 'dropbox' })))
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

  const choose = (ref) => {
    setMenu(false)
    ref.current?.click()
  }
  const busy = state.phase === 'uploading'

  return (
    <div
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-label="Add an event"
      style={{ animationDuration: `${motion.base}ms` }}
      className={cn(
        'absolute top-full right-0 z-30 mt-2 flex w-[min(26rem,calc(100vw-3rem))] flex-col gap-3 rounded-xl border border-border bg-card p-4 outline-none',
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

      {/* Browse: any allowed file. Camera: opens the rear camera on a phone. Library: the photo album. On a desktop
          the last two fall back to the ordinary file dialog. */}
      {[
        [browseInput, [...ACCEPT, 'image/*'].join(','), undefined],
        [cameraInput, 'image/*', 'environment'],
        [libraryInput, 'image/*', undefined],
      ].map(([ref, accept, capture], i) => (
        <input
          key={i}
          ref={ref}
          type="file"
          accept={accept}
          capture={capture}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // choosing the same file again still fires
            if (file) send(file)
          }}
        />
      ))}

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
      ) : state.phase === 'done' ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="flex gap-2 text-sm leading-snug">
            {state.ok && <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />}
            <span>
              {state.message}
              {state.note && <span className="text-muted-foreground"> {state.note}</span>}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setState({ phase: 'idle' })
                setMenu(true)
              }}
            >
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
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
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
              'flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-9 text-center outline-none',
              'transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              dragging
                ? 'border-dropbox bg-dropbox/15'
                : 'border-dropbox/45 bg-dropbox/[0.07] hover:border-dropbox/80 hover:bg-dropbox/[0.12]',
            )}
            style={{ transitionDuration: `${motion.base}ms` }}
          >
            <DropboxLogo className="size-20 text-dropbox" />
            <span className="text-base">Drop a poster here</span>
            <span className="text-xs text-muted-foreground">or click to add one</span>
          </button>
          {menu && (
            <ul className="flex flex-col gap-1" aria-label="Add a poster from">
              {[
                [FolderOpen, 'Browse files', browseInput],
                [Camera, 'Take a photo', cameraInput],
                [ImageIcon, 'Photo library', libraryInput],
              ].map(([Icon, label, ref]) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => choose(ref)}
                    className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left text-sm outline-none hover:border-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon aria-hidden className="size-4 text-muted-foreground" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state.phase === 'error' && (
            <p role="alert" className="text-xs text-foreground/90">
              {state.message}
            </p>
          )}
        </>
      )}
    </div>
  )
}
