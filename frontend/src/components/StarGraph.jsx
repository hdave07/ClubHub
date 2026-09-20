import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow } from '@xyflow/react'
import { PANEL_GAP, PANEL_WIDTH } from '@/components/ClubPanel'
import StarField from '@/components/StarField'
import { ClubNode, EventNode, OutcomeNode, YouNode } from '@/components/StarNode'
import { computeHighlight } from '@/lib/highlight'
import { layoutGraph } from '@/lib/layout'
import { clubBrightness, gold, motion, nodeStyles, sky } from '@/lib/theme'

const nodeTypes = { you: YouNode, outcome: OutcomeNode, club: ClubNode, event: EventNode }
const NO_PULSE = new Set()

// Edges are hairlines: nearly invisible until a club is focused, when its path turns gold.
const EDGE = `${sky.heading}1A`
const EDGE_EVENT = `${sky.heading}12` // event edges are the faintest
const EDGE_DIM = 0.25 // everything outside the hovered path recedes (nodes use the same 0.25, see StarNode)

const BASE_PADDING = { top: 56, bottom: 56, left: 140, right: 140 } // room for the labels beside the outer nodes
const DESKTOP = '(min-width: 1024px)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const matches = (query) => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches

/**
 * fitView padding. With the club panel open on desktop it sits over the right of the graph, so the stars refit
 * into the space to its left (the panel's width replaces the label margin on that side).
 */
function fitPadding(panelOpen) {
  const p =
    panelOpen && matches(DESKTOP)
      ? { ...BASE_PADDING, left: 100, right: PANEL_WIDTH + PANEL_GAP + 24 }
      : BASE_PADDING
  return { top: `${p.top}px`, bottom: `${p.bottom}px`, left: `${p.left}px`, right: `${p.right}px` }
}

// With the panel open the graph is small and the panel covers its right side, so the focused club's label goes above
// or below its dot (whichever side its event dot is not on) and grows toward the middle, never outward.
function panelLabelSide(club, event) {
  const centerX = club.position.x + nodeStyles.club.size / 2
  const vertical = event && event.position.y < club.position.y ? 'bottom' : 'top'
  return `${vertical}${centerX > 0 ? 'End' : 'Start'}`
}

/**
 * Hover is transient and selection is sticky: while something is hovered its path is the highlight, on leave the
 * highlight falls back to the selected club (or nothing). Highlight state never touches the layout.
 * @param {{ response?: object, graph?: { nodes: object[], edges: object[] }, selectedId?: string | null,
 *   hoveredId?: string | null, hoveredOutcome?: string | null, onSelect?: (id: string | null) => void,
 *   onHover?: (clubId: string | null) => void, onHoverOutcome?: (outcomeNodeId: string | null) => void,
 *   pulseIds?: Set<string>, panelOpen?: boolean }} props
 * `graph` is the laid-out graph (lib/layout.js layoutGraph); pass it to share one memoized layout with the list,
 * otherwise it is built from `response`.
 */
export default function StarGraph({
  response,
  graph: graphProp,
  selectedId = null,
  hoveredId = null,
  hoveredOutcome = null,
  onSelect,
  onHover,
  onHoverOutcome,
  pulseIds = NO_PULSE,
  panelOpen = false,
}) {
  const built = useMemo(() => (graphProp ? null : layoutGraph(response)), [graphProp, response])
  const graph = graphProp ?? built

  // Refit only when the panel opens or closes (with a short glide), not on first render or when switching clubs.
  const [flow, setFlow] = useState(null)
  const wasOpen = useRef(panelOpen)
  useEffect(() => {
    if (!flow || wasOpen.current === panelOpen) return
    wasOpen.current = panelOpen
    flow.fitView({ padding: fitPadding(panelOpen), duration: matches(REDUCED_MOTION) ? 0 : motion.slow })
  }, [panelOpen, flow])

  const [showHint, setShowHint] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000)
    return () => clearTimeout(t)
  }, [])

  // The highlight: the hovered path if something is hovered, else the selected club's path, else none.
  const selectionHL = useMemo(
    () => (selectedId != null ? computeHighlight(graph, { clubIds: [String(selectedId)] }) : null),
    [graph, selectedId],
  )
  const hoverHL = useMemo(() => {
    if (hoveredId != null) return computeHighlight(graph, { clubIds: [String(hoveredId)] })
    if (hoveredOutcome) return computeHighlight(graph, { outcomeId: hoveredOutcome })
    return null
  }, [graph, hoveredId, hoveredOutcome])
  const active = hoverHL ?? selectionHL

  const useBrightness = graph.nodes.some((n) => n.type === 'club' && n.data?.last_updated)

  // Base nodes: nothing here depends on hover or selection, so hovering never rebuilds them.
  const baseNodes = useMemo(() => {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    const eventOfClub = new Map(graph.edges.filter((e) => e.target.startsWith('event:')).map((e) => [e.source, byId.get(e.target)]))
    return graph.nodes.map((n) => {
      const clubId = n.data?.clubId
      return {
        id: n.id,
        type: n.type,
        position: n.position,
        draggable: false,
        selectable: false,
        focusable: false,
        ariaLabel: n.type === 'club' ? `${n.data?.rank ?? ''}. ${n.label}`.trim() : n.label,
        data: {
          ...n.data,
          label: n.label,
          side: panelOpen && n.type === 'club' ? panelLabelSide(n, eventOfClub.get(n.id)) : n.data?.side,
          pulse: n.type === 'event' && pulseIds.has(n.id),
          brightness: useBrightness ? clubBrightness(n.data?.last_updated) : 1,
          onSelect: () => onSelect?.(clubId),
          onHover: (on) => onHover?.(on ? clubId : null), // keyboard focus/blur on a club or event node
        },
      }
    })
  }, [graph, panelOpen, pulseIds, useBrightness, onSelect, onHover])

  // Highlight flags only (same positions): dim what is outside the path, light what is inside it.
  const nodes = useMemo(
    () =>
      baseNodes.map((n) => {
        const lit = !!active?.nodeIds.has(n.id)
        const clubId = n.data.clubId
        return {
          ...n,
          data: {
            ...n.data,
            lit,
            dim: !!active && !lit,
            selected: n.type === 'club' && selectedId != null && clubId === String(selectedId),
            hovered: n.type === 'club' && !!hoverHL?.clubIds.has(clubId),
            // with the club panel open the graph is small: only the focused path (and a hovered one) keeps its labels
            labelHidden:
              panelOpen && !!(selectionHL || hoverHL) && !(selectionHL?.nodeIds.has(n.id) || hoverHL?.nodeIds.has(n.id)),
          },
        }
      }),
    [baseNodes, active, hoverHL, selectionHL, selectedId, panelOpen],
  )

  const edges = useMemo(
    () =>
      graph.edges.map((e) => {
        const id = `${e.source}->${e.target}`
        const lit = !!active?.edgeIds.has(id)
        const toEvent = e.target.startsWith('event:')
        return {
          id,
          source: e.source,
          target: e.target,
          type: 'straight',
          focusable: false,
          selectable: false,
          style: {
            stroke: lit ? gold.color : toEvent ? EDGE_EVENT : EDGE,
            strokeWidth: lit ? 1.25 : 1,
            opacity: active && !lit ? EDGE_DIM : 1,
            transition: `opacity ${motion.fast}ms, stroke ${motion.fast}ms`,
          },
        }
      }),
    [graph, active],
  )

  // Graph -> card: a club or its event lights that club, an outcome lights every club under it, "you" does nothing.
  const enter = useCallback(
    (_, node) => {
      if (node.type === 'club' || node.type === 'event') onHover?.(node.data.clubId)
      else if (node.type === 'outcome') onHoverOutcome?.(node.id)
    },
    [onHover, onHoverOutcome],
  )
  const leave = useCallback(
    (_, node) => {
      if (node.type === 'club' || node.type === 'event') onHover?.(null)
      else if (node.type === 'outcome') onHoverOutcome?.(null)
    },
    [onHover, onHoverOutcome],
  )

  if (!graph.nodes.some((n) => n.type === 'club')) return null // only "you": the empty state covers it

  return (
    <div className="absolute inset-0">
      <StarField />
      <ReactFlow
        key={graph.nodes.map((n) => n.id).join('|')} // refit when the graph changes
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: fitPadding(panelOpen) }}
        onInit={setFlow}
        attributionPosition="bottom-left"
        minZoom={0.4}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        onPaneClick={() => onSelect?.(null)}
        onNodeMouseEnter={enter}
        onNodeMouseLeave={leave}
        style={{ background: 'transparent', '--xy-background-color': 'transparent' }}
      />
      <p
        className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-muted-foreground"
        style={{ opacity: showHint && !panelOpen ? 1 : 0, transition: `opacity ${motion.slow}ms` }}
      >
        Tap a club to see why it fits.
      </p>
    </div>
  )
}
