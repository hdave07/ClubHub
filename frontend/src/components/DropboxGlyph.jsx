import { useState } from 'react'

// The official Dropbox glyph, black, used exactly as supplied: no recolor, outline, rotation, stretch or crop. Height
// is the text height and width follows from the file's own aspect ratio. Until public/brand/dropbox-glyph-black.svg is
// added, the image fails to load and the button simply renders without an icon (no substitute).
export default function DropboxGlyph() {
  const [missing, setMissing] = useState(false)
  if (missing) return null
  return (
    <img
      src="/brand/dropbox-glyph-black.svg"
      alt=""
      draggable={false}
      onError={() => setMissing(true)}
      className="h-[1em] w-auto shrink-0"
    />
  )
}
