// What lights up when something is hovered, computed from the already laid-out graph.
// Pure and cheap: callers memoize it, so hover never touches buildGraph or the layout (no node moves).

// The same id StarGraph gives its edges.
const edgeId = (e) => `${e.source}->${e.target}`

/**
 * Ids of the clubs attached to an outcome node.
 * @param {{ edges: { source: string, target: string }[] }} graph
 * @param {string | null | undefined} outcomeNodeId e.g. "outcome:career"
 * @returns {string[]} club ids (without the "club:" prefix)
 */
export function clubIdsUnderOutcome(graph, outcomeNodeId) {
  if (!outcomeNodeId) return []
  return graph.edges.filter((e) => e.source === outcomeNodeId && e.target.startsWith('club:')).map((e) => e.target.slice(5))
}

/**
 * The path that explains a hover.
 * - club(s): You -> the club's outcome(s) -> the club -> its event(s), and the edges between them
 * - outcome: You -> that outcome -> every club under it (their events stay quiet)
 * @param {{ nodes: { id: string }[], edges: { source: string, target: string }[] }} graph
 * @param {{ clubIds?: string[], outcomeId?: string | null }} [target]
 * @returns {{ nodeIds: Set<string>, edgeIds: Set<string>, clubIds: Set<string> } | null} null when nothing is hovered
 */
export function computeHighlight(graph, { clubIds = [], outcomeId = null } = {}) {
  const has = new Set(graph.nodes.map((n) => n.id))
  const nodeIds = new Set()
  const edgeIds = new Set()
  const clubs = new Set()
  const addEdge = (e) => {
    nodeIds.add(e.source)
    nodeIds.add(e.target)
    edgeIds.add(edgeId(e))
  }

  if (outcomeId && has.has(outcomeId)) {
    nodeIds.add(outcomeId)
    for (const e of graph.edges) {
      if (e.source === outcomeId && e.target.startsWith('club:')) {
        addEdge(e)
        clubs.add(e.target.slice(5))
      }
    }
  }

  for (const id of clubIds) {
    const clubNode = `club:${id}`
    if (!has.has(clubNode)) continue
    clubs.add(String(id))
    nodeIds.add(clubNode)
    for (const e of graph.edges) {
      const inbound = e.target === clubNode && (e.source.startsWith('outcome:') || e.source === 'you') // you -> club when it has no outcome
      const toEvent = e.source === clubNode && e.target.startsWith('event:')
      if (inbound || toEvent) addEdge(e)
    }
  }

  if (!nodeIds.size) return null
  nodeIds.add('you')
  // You -> outcome edges for every outcome that is lit
  for (const e of graph.edges) {
    if (e.source === 'you' && e.target.startsWith('outcome:') && nodeIds.has(e.target)) addEdge(e)
  }
  return { nodeIds, edgeIds, clubIds: clubs }
}
