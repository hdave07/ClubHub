// Field names follow src/lib/api.js. onboarding-flow.md's example still shows id: number and why; the repo wins.

/**
 * The main plan's fixed list of 8 outcomes. Never draw other outcome labels.
 * @typedef {"make_friends" | "build_skills" | "career" | "leadership" | "give_back" | "culture" | "wellness" | "academic"} Outcome
 */

/** @type {Record<Outcome, string>} */
export const OUTCOME_LABELS = {
  make_friends: 'Make friends',
  build_skills: 'Build skills/portfolio',
  career: 'Career and networking',
  leadership: 'Leadership',
  give_back: 'Give back',
  culture: 'Culture and identity',
  wellness: 'Wellness and recreation',
  academic: 'Academic/research',
}

// Backend currently sends display labels (e.g. "Make friends", backend/app/models.py FIXED_OUTCOMES);
// UI always works with keys via normalizeOutcome.
/**
 * Accepts an outcome key ("make_friends") or label ("Make friends") and returns the key.
 * @param {string} value
 * @returns {Outcome | null} null for unknown values
 */
export function normalizeOutcome(value) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (Object.hasOwn(OUTCOME_LABELS, v)) return /** @type {Outcome} */ (v)
  const key = Object.keys(OUTCOME_LABELS).find((k) => OUTCOME_LABELS[k] === v)
  return /** @type {Outcome | undefined} */ (key) ?? null
}

/** @typedef {"casual" | "moderate" | "intense" | "unknown"} Commitment */

/**
 * Only published events reach the frontend (main plan safety rule).
 * No organizer or contact fields (main plan privacy rule).
 * @typedef {Object} EventLite
 * @property {string} id
 * @property {string} title
 * @property {string} start ISO string
 * @property {string} [location]
 * @property {"sop" | "dropbox"} source
 * @property {string} [source_file]
 * @property {string} [dropbox_link]
 */

/**
 * Item from GET /events?since=
 * @typedef {EventLite & { club_id: string }} LiveEvent
 */

/**
 * @typedef {Object} ClubMatch
 * @property {string} id
 * @property {string} name
 * @property {string | null} summary null or "limited info" means the limited-info state
 * @property {Outcome[]} outcomes
 * @property {string[]} tags
 * @property {Commitment} commitment
 * @property {string} why_it_fits
 * @property {string} last_updated
 * @property {EventLite | null} next_event
 */

/**
 * @typedef {Object} GraphNode
 * @property {string} id
 * @property {"you" | "outcome" | "club" | "event"} type
 * @property {string} label
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} source
 * @property {string} target
 */

/** @typedef {{ blurb: string }} RecommendRequest */

/**
 * @typedef {Object} RecommendResponse
 * @property {Outcome[]} outcomes
 * @property {ClubMatch[]} clubs
 * @property {{ nodes: GraphNode[], edges: GraphEdge[] }} graph
 */

/** @typedef {"campus" | "welcome" | "major" | "blurb" | "results"} Step */

/** @typedef {{ major: string, blurb_text: string }} UserInput */
