import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow } from '@xyflow/react'
import { PANEL_GAP, PANEL_WIDTH } from '@/components/ClubPanel'
import StarField from '@/components/StarField'
import StarEdge from '@/components/StarEdge'
import { ClubNode, EventNode, OutcomeNode, YouNode } from '@/components/StarNode'
import { DIMMED_OPACITY } from '@/lib/graphTuning'
import { GraphViewContext } from '@/lib/graphView'
import { useStarPhysics } from '@/lib/useStarPhysics'
import { computeHighlight } from '@/lib/highlight'
import { layoutGraph } from '@/lib/layout'
import { clubBrightness, motion, nodeStyles, outcomeColor, sky } from '@/lib/theme'

const nodeTypes = { you: YouNode, outcome: OutcomeNode, club: ClubNode, event: EventNode }
const edgeTypes = { star: StarEdge }
const NO_PULSE = new Set()

// Edges are hairlines: nearly invisible until a club is focused, when its path turns brighter.
const EDGE = `${sky.heading}1A`
const EDGE_EVENT = `${sky.heading}12` // event edges are the faintest

/**
 * How an edge looks. You -> outcome: the outcome's color, solid, 1.5px. Outcome -> club: the same color at 35%, 1px,
 * drawn at full strength when lit. Anything else (club -> event, you -> club) stays neutral and quiet.
 * @param {{ source: string, target: string }} e
 */
function edgeLook(e) {
  const key = e.source.startsWith('outcome:') ? e.source.slice(8) : e.target.startsWith('outcome:') ? e.target.slice(8) : null
  if (key == null) {
    const quiet = e.target.startsWith('event:')
    return { base: quiet ? EDGE_EVENT : EDGE, baseWidth: 1, lit: sky.textMuted, litWidth: 1.25 }
  }
  const { color } = outcomeColor(key)
  if (e.source === 'you') return { base: color, baseWidth: 1.5, lit: color, litWidth: 1.5 }
  return { base: `${color}59`, baseWidth: 1, lit: color, litWidth: 1.5 }
}

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

  // Cursor physics and idle drift: a frame loop outside React (lib/useStarPhysics.js). It needs the current viewport
  // to turn screen pixels into flow units, so it is kept in a ref, never in state.
  const rootRef = useRef(null)
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 })
  useStarPhysics(rootRef, graph, viewRef)
  useEffect(() => {
    if (import.meta.env.DEV) window.__starGraphRenders = (window.__starGraphRenders ?? 0) + 1 // dev only: render counter for tests
  })

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

  const reducedMotion = useMemo(() => matches(REDUCED_MOTION), [])
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
          nodeId: n.id,
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

  // What the node components read (through context) to dim, light and enlarge themselves. `nodes` itself never changes
  // on hover, so React Flow does no work and keeps its edge elements (see lib/graphView.js).
  const view = useMemo(
    () => ({ active, hoverHL, selectionHL, selectedId, hoveredId, hoveredOutcome, panelOpen }),
    [active, hoverHL, selectionHL, selectedId, hoveredId, hoveredOutcome, panelOpen],
  )

  const edges = useMemo(
    () =>
      graph.edges.map((e) => {
        const id = `${e.source}->${e.target}`
        return {
          id,
          source: e.source,
          target: e.target,
          type: 'star',
          focusable: false,
          selectable: false,
          data: { ...edgeLook(e), instant: reducedMotion },
        }
      }),
    [graph, reducedMotion], // not `active`: a changing edge list makes React Flow replace every edge element
  )

  // The hovered constellation's connections, applied straight to the (persistent) edge elements so their CSS
  // transitions run: the bright line draws in, the rest of the faint lines ease down. See StarEdge.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let raf = 0
    let tries = 0
    const apply = () => {
      let missing = false
      for (const e of graph.edges) {
        const id = `${e.source}->${e.target}`
        const [base, over] = root.querySelectorAll(`path[data-edge="${id}"]`)
        if (!base || !over) {
          missing = true // React Flow adds its edges a beat after the first render
          continue
        }
        const lit = !!active?.edgeIds.has(id)
        base.style.opacity = active && !lit ? DIMMED_OPACITY : 1
        over.style.strokeDashoffset = lit ? 0 : 1
      }
      if (missing && tries++ < 30) raf = requestAnimationFrame(apply)
    }
    apply()
    return () => cancelAnimationFrame(raf)
  }, [graph, active, baseNodes])

  const handleInit = useCallback((instance) => {
    viewRef.current = instance.getViewport()
    setFlow(instance)
  }, [])
  const handleMove = useCallback((_, viewport) => {
    viewRef.current = viewport
  }, [])

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
    <div ref={rootRef} className="absolute inset-0">
      <StarField />
      <GraphViewContext.Provider value={view}>
        <ReactFlow
          key={graph.nodes.map((n) => n.id).join('|')} // refit when the graph changes
          nodes={baseNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: fitPadding(panelOpen) }}
          onInit={handleInit}
        onMove={handleMove}
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
      </GraphViewContext.Provider>
      <p
        className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-muted-foreground"
        style={{ opacity: showHint && !panelOpen ? 1 : 0, transition: `opacity ${motion.slow}ms` }}
      >
        Tap a club to see why it fits.
      </p>
    </div>
  )
}
