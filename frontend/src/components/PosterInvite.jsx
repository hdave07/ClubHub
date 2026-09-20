import { useOpenPosterPicker } from '@/lib/posterPicker'

/**
 * " · Have a poster?" after an empty-events line: a cream underlined link that opens the same file picker as the
 * header's "Drop a poster" button. POST /upload takes no club id, so nothing is passed along; the backend finds the
 * club from the poster. Renders nothing where there is no picker (outside the results screen).
 */
export default function PosterInvite() {
  const open = useOpenPosterPicker()
  if (!open) return null
  return (
    <>
      {' · '}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation() // on a card, this must not select the card
          open()
        }}
        className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Have a poster?
      </button>
    </>
  )
}
