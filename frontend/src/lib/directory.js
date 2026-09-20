// The Full Directory's browse list: every club (GET /api/clubs), filtered client-side.
// 250 rows is small enough that a full fetch + in-memory filter beats a query-param API -- no backend change needed.

import { scrubText } from './club'
import { normalizeOutcome } from '@/types'

/**
 * Same whitelisting spirit as sanitizeClub (lib/club.js), for the list instead of the detail panel: no
 * description_raw, no links, no sop ids. ClubCard only ever reads these fields, and why_it_fits/next_event
 * are deliberately absent (this club wasn't matched to anyone) -- ClubCard already renders that as "no card note"
 * / "no upcoming events listed" rather than erroring.
 * @param {any} raw one row from GET /api/clubs
 */
export function toDirectoryClub(raw) {
  return {
    id: String(raw?.id ?? ''),
    name: typeof raw?.name === 'string' ? raw.name : '(unnamed club)',
    summary: typeof raw?.summary === 'string' ? scrubText(raw.summary) || null : null,
    outcomes: Array.isArray(raw?.outcomes) ? raw.outcomes.map(normalizeOutcome).filter(Boolean) : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.filter((t) => typeof t === 'string') : [],
    commitment: typeof raw?.commitment === 'string' ? raw.commitment : 'unknown',
    last_updated: typeof raw?.last_updated === 'string' ? raw.last_updated : null,
  }
}

/**
 * FIXED_TAGS (backend/app/models.py), grouped the same way the backend's own comments group them, for the tag
 * checklist's section headings. Keep in sync if FIXED_TAGS changes.
 */
export const TAG_GROUPS = [
  {
    label: 'Fields of study',
    tags: [
      'artificial intelligence', 'technology', 'engineering', 'science', 'health and medicine',
      'mental health', 'business', 'finance', 'entrepreneurship', 'consulting', 'law', 'politics',
      'humanities', 'social sciences', 'languages', 'education',
    ],
  },
  {
    label: 'Arts & creative',
    tags: ['music', 'dance', 'theatre', 'visual arts', 'creative writing', 'film and media', 'design'],
  },
  {
    label: 'What clubs do',
    tags: [
      'workshops', 'competitions', 'conferences', 'research', 'mentorship', 'volunteering',
      'networking', 'social events', 'performance', 'training and lessons', 'hackathons',
      'publishing', 'fundraising',
    ],
  },
  {
    label: 'Community & identity',
    tags: [
      'cultural heritage', 'faith and spirituality', 'international students', 'graduate students',
      'advocacy', 'human rights', 'equity and inclusion', 'community outreach', 'sustainability',
      'student government',
    ],
  },
  {
    label: 'Recreation',
    tags: ['sports', 'fitness', 'games', 'outdoors', 'food'],
  },
]

/**
 * Two curated tag subsets standing in for "skills to build" and "professional field" -- there's no such field on
 * a club, only FIXED_TAGS (a closed enum enforced at enrichment time), so a filter chip has to resolve to actual
 * tag values or it can never match anything. "Skills" mirrors the backend's own
 * OUTCOME_TAGS["Build skills/portfolio"] grouping (models.py) -- already exactly this concept. "Professional
 * field" has no such existing mapping; "marketing" and "SWE" aren't tags themselves, so they're covered by the
 * closest real tags (business for marketing-adjacent clubs, technology/artificial intelligence/engineering for
 * SWE-adjacent ones) alongside the other classic pre-professional fields.
 */
export const SKILL_TAGS = [
  'workshops', 'training and lessons', 'hackathons', 'competitions', 'performance', 'design',
  'creative writing', 'publishing', 'visual arts', 'music', 'dance', 'theatre', 'film and media',
]

export const PROFESSIONAL_TAGS = [
  'business', 'finance', 'entrepreneurship', 'consulting', 'law', 'technology',
  'artificial intelligence', 'engineering', 'health and medicine',
]

export const COMMITMENTS = ['casual', 'moderate', 'intense', 'unknown']

/** @typedef {{ query: string, tags: Set<string>, commitments: Set<string>, skills: Set<string>, fields: Set<string> }} DirectoryFilters */

/** @returns {DirectoryFilters} */
export function emptyFilters() {
  return { query: '', tags: new Set(), commitments: new Set(), skills: new Set(), fields: new Set() }
}

export function hasActiveFilters(filters) {
  return !!filters.query.trim() || [filters.tags, filters.commitments, filters.skills, filters.fields].some((s) => s.size > 0)
}

const intersects = (tags, selected) => selected.size === 0 || tags.some((t) => selected.has(t))

/**
 * A club matches when the query matches its name OR its description (case-insensitive) AND every non-empty facet
 * has at least one overlapping tag/commitment. Facets AND together; values within a facet OR together (checking
 * "music" and "sports" under Tags means either, not both). Matching the description too is what lets a directory
 * search ("first-year CS, want internships") narrow the browse list the same way it narrows the graph -- name-only
 * matching would leave the list showing all 250 clubs while the graph shows a filtered 5-8.
 * @param {ReturnType<typeof toDirectoryClub>} club
 * @param {DirectoryFilters} filters
 */
export function matchesFilters(club, filters) {
  const q = filters.query.trim().toLowerCase()
  if (q && !club.name.toLowerCase().includes(q) && !(club.summary ?? '').toLowerCase().includes(q)) return false
  if (filters.commitments.size > 0 && !filters.commitments.has(club.commitment)) return false
  if (!intersects(club.tags, filters.tags)) return false
  if (!intersects(club.tags, filters.skills)) return false
  if (!intersects(club.tags, filters.fields)) return false
  return true
}

export function filterClubs(clubs, filters) {
  return clubs.filter((c) => matchesFilters(c, filters))
}
