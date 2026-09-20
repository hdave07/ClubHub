import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * "Choose your campus": a search box that opens a dropdown of schools (University of Toronto first, as in the data).
 * Typing filters the list. Choosing an available school calls onChoose; any other shows a "coming soon" note.
 * A combobox with a listbox: arrow keys, Enter and Escape work, and it closes on outside click or Tab.
 * @param {{ schools: { id: string, name: string, available: boolean }[], onChoose: (school: object) => void }} props
 */
export default function CampusPicker({ schools, onChoose }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [note, setNote] = useState('')
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? schools.filter((s) => s.name.toLowerCase().includes(q)) : schools
  }, [schools, query])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // keep the keyboard-highlighted option in view
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function choose(school) {
    setQuery(school.name)
    setOpen(false)
    if (school.available) {
      setNote('')
      onChoose(school)
    } else {
      setNote(`${school.name} is coming soon. ClubHub is live at the University of Toronto for now.`)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault()
        choose(results[active])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative w-full max-w-md text-left"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        aria-label="Choose your campus"
        placeholder="Choose your campus"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setNote('')
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-11 pr-10 pl-9 dark:bg-card" // solid, so the background particles do not run through the text
      />
      <ChevronDown
        aria-hidden
        className={cn('pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground transition-transform', open && 'rotate-180')}
      />

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Campuses"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        >
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No campus found</li>}
          {results.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()} // keep focus in the box
              onClick={() => choose(s)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm',
                i === active ? 'bg-secondary text-foreground' : 'text-foreground/90',
              )}
            >
              <span>{s.name}</span>
              {!s.available && <span className="text-xs text-muted-foreground">Coming soon</span>}
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p role="status" className="mt-3 text-center text-sm text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  )
}
