import { useCallback, useState } from 'react'
import { uploadFlier } from '@/lib/api'

/** What the native picker offers. Phones list their camera and photo library for image types. */
export const PICKER_ACCEPT = 'image/png,image/jpeg,application/pdf'

// Same allowlist and size cap as backend/app/routers/upload.py, checked here first so a bad file never costs a
// Claude call.
const ALLOWED = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf']
const MAX_BYTES = 10 * 1024 * 1024

const WRONG_FILE = 'Try a PNG, JPG or PDF under 10 MB.'
const EMPTY_FILE = 'That file looks empty. Try another.'
const UPSTREAM = "Couldn't reach Dropbox right now. Try again in a moment."
const OFFLINE = "Couldn't reach the server. Try again in a moment."

const extOf = (name) => (name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()

function problemWith(file) {
  if (!file) return null
  if (file.size === 0) return EMPTY_FILE
  if (!ALLOWED.includes(extOf(file.name)) || file.size > MAX_BYTES) return WRONG_FILE
  return null
}

/** Plain copy for a failed request, by status. Backend `detail` text is not shown. */
function errorMessage(e) {
  switch (e?.response?.status) {
    case 413:
    case 415:
      return WRONG_FILE
    case 400:
      return EMPTY_FILE
    case 502:
      return UPSTREAM
    default:
      return OFFLINE
  }
}

/**
 * The poster upload (POST /upload) and what to say about it.
 * States: idle | uploading | done | error. A published event for one of the student's own result clubs goes to
 * `onPublished` (the card and star light up, as for a Dropbox arrival) and the feedback closes; everything else is
 * reported with the server's message. Nothing here promises an event will appear.
 * @param {{ resultClubIds: Set<string>, onPublished: (events: object[]) => void }} opts
 */
export function useFlierUpload({ resultClubIds, onPublished }) {
  const [state, setState] = useState({ phase: 'idle' })
  const reset = useCallback(() => setState({ phase: 'idle' }), [])

  const upload = useCallback(
    async (file) => {
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
        if (clubId != null && resultClubIds.has(clubId) && published.length) {
          onPublished(published.map((e) => ({ ...e, club_id: clubId, source: 'dropbox' })))
          setState({ phase: 'idle' })
          return
        }
        setState({ phase: 'done', ok: published.length > 0, message: res.message })
      } catch (e) {
        setState({ phase: 'error', message: errorMessage(e) })
      }
    },
    [resultClubIds, onPublished],
  )

  return { state, upload, reset }
}
