/**
 * A slow, endless horizontal scroll of school names: a demonstration, not a control (nothing here is clickable).
 * The list is rendered twice and the track slides by exactly half its width, so the loop has no seam. The second
 * copy is aria-hidden. It pauses on hover. Under prefers-reduced-motion it stops and can be scrolled by hand
 * (see .school-marquee in index.css).
 * @param {{ schools: { id: string, name: string }[] }} props
 */
export default function SchoolMarquee({ schools }) {
  return (
    <div
      role="group"
      aria-label="Partner schools"
      className="school-marquee w-full"
      style={{
        // fade the two ends so names glide in and out
        maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
      }}
    >
      <ul className="school-marquee-track">
        {[0, 1].map((copy) =>
          schools.map((s) => (
            <li
              key={`${copy}-${s.id}`}
              aria-hidden={copy === 1 || undefined}
              className={copy === 1 ? 'school-marquee-copy' : undefined}
            >
              {s.name}
            </li>
          )),
        )}
      </ul>
    </div>
  )
}
