import { formatEventTime } from '@/lib/format'
import { OUTCOME_LABELS, normalizeOutcome } from '@/types'

export const MAX_NODES = 25
const MAX_OUTCOMES = 4
const MAX_CLUBS = 8

/**
 * GraphNode from types.js plus the data the star nodes need.
 * @typedef {import('@/types').GraphNode & { data?: Record<string, any> }} StarGraphNode
 */

const stripPrefix = (id, prefix) => String(id).replace(new RegExp(`^${prefix}:`), '')
const eventLabel = (ev) => [ev.title, formatEventTime(ev.start)].filter(Boolean).join(' · ')

function outcomeKeys(club) {
  return [...new Set((club.outcomes ?? []).map(normalizeOutcome).filter(Boolean))]
}

function clubData(club, rank) {
  return {
    clubId: String(club.id),
    rank,
    primaryOutcome: outcomeKeys(club)[0] ?? null,
    last_updated: club.last_updated ?? null,
  }
}

function eventData(club, ev) {
  return {
    clubId: String(club.id),
    source: ev.source,
    title: ev.title,
    start: ev.start,
    source_file: ev.source_file,
    arrival: !!ev.arrival, // arrived live this session (lib/events.js applyArrivals): never capped away
  }
}

/**
 * Stars for events that arrived live this session: a club's `live_events`, plus its next event when that is itself
 * an arrival the graph doesn't show yet (a backend graph names the old next event).
 */
function addLiveEventStars({ nodes, edges }, clubs) {
  const ids = new Set(nodes.map((n) => n.id))
  for (const club of clubs) {
    const clubId = `club:${club.id}`
    if (!ids.has(clubId)) continue
    const next = club.next_event?.arrival ? [club.next_event] : []
    for (const ev of [...next, ...(club.live_events ?? [])]) {
      const eventId = `event:${ev.id}`
      if (ids.has(eventId)) continue
      ids.add(eventId)
      nodes.push({ id: eventId, type: 'event', label: eventLabel(ev), data: eventData(club, ev) })
      edges.push({ source: clubId, target: eventId })
    }
  }
  return { nodes, edges }
}

function mostCommonOutcomes(clubs) {
  const counts = new Map()
  for (const club of clubs) for (const k of outcomeKeys(club)) counts.set(k, (counts.get(k) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k) // stable: ties keep first-seen order
}

function buildFromClubs(response) {
  const clubs = (response?.clubs ?? []).slice(0, MAX_CLUBS)
  let keys = [...new Set((response?.outcomes ?? []).map(normalizeOutcome).filter(Boolean))]
  if (!keys.length) keys = mostCommonOutcomes(clubs)
  keys = keys.slice(0, MAX_OUTCOMES)
  const keySet = new Set(keys)

  /** @type {StarGraphNode[]} */
  const nodes = [{ id: 'you', type: 'you', label: 'You' }]
  const edges = []
  for (const key of keys) {
    nodes.push({ id: `outcome:${key}`, type: 'outcome', label: OUTCOME_LABELS[key], data: { key } })
    edges.push({ source: 'you', target: `outcome:${key}` })
  }

  const seenEvents = new Set()
  clubs.forEach((club, i) => {
    const clubId = `club:${club.id}`
    nodes.push({ id: clubId, type: 'club', label: club.name, data: clubData(club, i + 1) })

    let parents = outcomeKeys(club).filter((k) => keySet.has(k))
    if (!parents.length && keys.length) parents = [keys[0]] // no match: connect to the first outcome
    if (parents.length) for (const k of parents) edges.push({ source: `outcome:${k}`, target: clubId })
    else edges.push({ source: 'you', target: clubId }) // no outcomes at all

    const ev = club.next_event
    if (ev && typeof ev === 'object') {
      const eventId = `event:${ev.id ?? club.id}`
      if (seenEvents.has(eventId)) return
      seenEvents.add(eventId)
      nodes.push({ id: eventId, type: 'event', label: eventLabel(ev), data: eventData(club, ev) })
      edges.push({ source: clubId, target: eventId })
    }
  })
  return { nodes, edges }
}

function normalizeBackendGraph(graph, response) {
  const clubs = response?.clubs ?? []
  const clubById = new Map(clubs.map((c, i) => [String(c.id), { club: c, rank: i + 1 }]))
  const idMap = new Map()
  /** @type {StarGraphNode[]} */
  const nodes = []
  const seen = new Set()
  const add = (rawId, node) => {
    idMap.set(rawId, node.id)
    if (seen.has(node.id)) return
    seen.add(node.id)
    nodes.push(node)
  }

  for (const n of graph.nodes) {
    if (n.type === 'you') add(n.id, { id: 'you', type: 'you', label: 'You' })
    else if (n.type === 'outcome') {
      const key = normalizeOutcome(stripPrefix(n.id, 'outcome')) ?? normalizeOutcome(n.label)
      if (key) add(n.id, { id: `outcome:${key}`, type: 'outcome', label: OUTCOME_LABELS[key], data: { key } })
    } else if (n.type === 'club') {
      const clubId = stripPrefix(n.id, 'club')
      const hit = clubById.get(clubId)
      const data = hit ? clubData(hit.club, hit.rank) : { clubId, rank: null, primaryOutcome: null, last_updated: null }
      add(n.id, { id: `club:${clubId}`, type: 'club', label: hit?.club.name ?? n.label, data })
    } else if (n.type === 'event') {
      add(n.id, { id: `event:${stripPrefix(n.id, 'event')}`, type: 'event', label: n.label })
    }
  }
  if (!seen.has('you')) {
    nodes.unshift({ id: 'you', type: 'you', label: 'You' })
    seen.add('you')
  }

  const edgeSeen = new Set()
  const edges = []
  for (const e of graph.edges ?? []) {
    const source = idMap.get(e.source) ?? e.source
    const target = idMap.get(e.target) ?? e.target
    const key = `${source}->${target}`
    if (!seen.has(source) || !seen.has(target) || edgeSeen.has(key)) continue
    edgeSeen.add(key)
    edges.push({ source, target })
  }

  // Attach event data through the club that points at each event; drop events with no club.
  const clubOfEvent = new Map(edges.filter((e) => e.source.startsWith('club:')).map((e) => [e.target, e.source]))
  const kept = []
  for (const n of nodes) {
    if (n.type !== 'event') {
      kept.push(n)
      continue
    }
    const clubNodeId = clubOfEvent.get(n.id)
    if (!clubNodeId) continue
    const clubId = stripPrefix(clubNodeId, 'club')
    const ev = clubById.get(clubId)?.club.next_event
    const matches = ev && typeof ev === 'object' && `event:${ev.id}` === n.id
    kept.push({ ...n, data: matches ? eventData(clubById.get(clubId).club, ev) : { clubId } })
  }
  return { nodes: kept, edges }
}

/**
 * Hard cap: drop events first (lowest-ranked club first), then the lowest-ranked clubs. Live arrivals and the clubs
 * they belong to are never dropped: the arrival is the demo moment.
 */
function capGraph({ nodes, edges }) {
  if (nodes.length <= MAX_NODES) return { nodes, edges }
  const arrivalClubs = new Set(nodes.filter((n) => n.type === 'event' && n.data?.arrival).map((n) => n.data.clubId))
  const protectedNode = (n) => (n.type === 'event' ? !!n.data?.arrival : arrivalClubs.has(n.data?.clubId))
  const rankOfClub = new Map(nodes.filter((n) => n.type === 'club').map((n) => [n.data?.clubId, n.data?.rank ?? Infinity]))
  const rankOf = (n) => (n.type === 'event' ? rankOfClub.get(n.data?.clubId) : n.data?.rank) ?? Infinity
  const removed = new Set()
  const remaining = () => nodes.length - removed.size
  for (const type of ['event', 'club']) {
    const order = nodes.filter((n) => n.type === type && !protectedNode(n)).sort((a, b) => rankOf(b) - rankOf(a))
    for (const n of order) {
      if (remaining() <= MAX_NODES) break
      removed.add(n.id)
    }
  }
  // An event whose club was dropped would float alone.
  const clubsLeft = new Set(nodes.filter((n) => n.type === 'club' && !removed.has(n.id)).map((n) => n.data?.clubId))
  const kept = nodes.filter((n) => !removed.has(n.id) && (n.type !== 'event' || clubsLeft.has(n.data?.clubId)))
  const ids = new Set(kept.map((n) => n.id))
  return { nodes: kept, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) }
}

/**
 * Response -> { nodes, edges } for the personal graph (about 15-25 nodes, never more than 25).
 * Clubs may carry live arrivals (lib/events.js applyArrivals); each one gets a star.
 * @param {{ outcomes?: string[], clubs?: object[], graph?: { nodes: object[], edges: object[] } | null }} response
 * @returns {{ nodes: StarGraphNode[], edges: import('@/types').GraphEdge[] }}
 */
export function buildGraph(response) {
  const g = response?.graph
  if (g?.nodes?.length) {
    const normalized = normalizeBackendGraph(g, response)
    // A backend graph with no usable club nodes falls back to the club list.
    if (normalized.nodes.some((n) => n.type === 'club')) return capGraph(addLiveEventStars(normalized, response?.clubs ?? []))
  }
  return capGraph(addLiveEventStars(buildFromClubs(response), response?.clubs ?? []))
}

/**
 * Club ids with an event node in pulseIds (a new Dropbox event just arrived), for the card highlight.
 * @param {object[] | undefined} clubs
 * @param {Set<string> | undefined} pulseIds event node ids like "event:88"
 * @returns {Set<string>}
 */
export function clubIdsForPulse(clubs, pulseIds) {
  const ids = new Set()
  if (!pulseIds?.size) return ids
  for (const c of clubs ?? []) {
    const ev = c.next_event
    if (ev && typeof ev === 'object' && pulseIds.has(`event:${ev.id ?? c.id}`)) ids.add(String(c.id))
    if ((c.live_events ?? []).some((a) => pulseIds.has(`event:${a.id}`))) ids.add(String(c.id))
  }
  return ids
}
