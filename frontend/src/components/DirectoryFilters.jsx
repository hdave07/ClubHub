import { ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COMMITMENTS, PROFESSIONAL_TAGS, SKILL_TAGS, TAG_GROUPS, emptyFilters, hasActiveFilters } from '@/lib/directory'
import { cn } from '@/lib/utils'

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function toggle(set, value) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function Chip({ label, on, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs capitalize transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        on
          ? 'border-foreground bg-secondary text-foreground'
          : 'border-border text-muted-foreground hover:border-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function Section({ title, count, defaultOpen = false, children }) {
  return (
    <details className="group border-b border-border py-2 first:pt-0 last:border-b-0" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>
          {title}
          {count > 0 && <span className="text-foreground"> ({count})</span>}
        </span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2.5 pt-2 pb-1">{children}</div>
    </details>
  )
}

function ChipGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <Chip key={opt} label={opt} on={selected.has(opt)} onClick={() => onToggle(opt)} />
      ))}
    </div>
  )
}

/**
 * Filter controls for the Full Directory's browse list (all clubs, not just a matched 5-8). Facets: free-text
 * name search, curated "skills to build" / "professional field" tag subsets, commitment, and the full tag
 * vocabulary grouped the way models.py groups it. See lib/directory.js for the matching logic and why the two
 * curated subsets exist (there's no such field on a club, only FIXED_TAGS).
 * @param {{ filters: import('@/lib/directory').DirectoryFilters, onChange: (next: any) => void, resultCount: number }} props
 */
export default function DirectoryFilters({ filters, onChange, resultCount }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: toggle(filters[key], value) })

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search club names…"
            aria-label="Search club names"
            className="pl-8"
          />
        </div>
        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="icon-sm" aria-label="Clear filters" onClick={() => onChange(emptyFilters())}>
            <X />
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{resultCount} club{resultCount === 1 ? '' : 's'}</p>

      <div>
        <Section title="Skills to build" count={filters.skills.size}>
          <ChipGroup options={SKILL_TAGS} selected={filters.skills} onToggle={set('skills')} />
        </Section>
        <Section title="Professional field" count={filters.fields.size}>
          <ChipGroup options={PROFESSIONAL_TAGS} selected={filters.fields} onToggle={set('fields')} />
        </Section>
        <Section title="Commitment" count={filters.commitments.size}>
          <ChipGroup
            options={COMMITMENTS.map((c) => capitalize(c))}
            selected={new Set([...filters.commitments].map(capitalize))}
            onToggle={(label) => set('commitments')(label.toLowerCase())}
          />
        </Section>
        <Section title="Tags" count={filters.tags.size}>
          <div className="flex flex-col gap-3">
            {TAG_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[0.65rem] text-muted-foreground/70">{group.label}</p>
                <ChipGroup options={group.tags} selected={filters.tags} onToggle={set('tags')} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
