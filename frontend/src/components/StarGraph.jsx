import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow } from '@xyflow/react'
import { PANEL_GAP, PANEL_WIDTH } from '@/components/ClubPanel'
import StarField from '@/components/StarField'
import { ClubNode, EventNode, OutcomeNode, YouNode } from '@/components/StarNode'
import { buildGraph } from '@/lib/buildGraph'
import { radialLayout } from '@/lib/layout'
import { clubBrightness, gold, motion, nodeStyles, sky } from '@/lib/theme'

const nodeTypes = { you: YouNode, outcome: OutcomeNode, club: ClubNode, event: EventNode }
const NO_PULSE = new Set()

// Edges are hairlines: nearly invisible until a club is focused, when its path turns gold.
const EDGE = `${sky.heading}1A`
const EDGE_EVENT = `${sky.heading}12` // event edges are the faintest
const EDGE_DIM = 0.3

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

export default function StarGraph({
  response,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
  pulseIds = NO_PULSE,
  panelOpen = false,
}) {
  const graph = useMemo(() => {
    const g = buildGraph(response)
    return { nodes: radialLayout(g.nodes, g.edges), edges: g.edges }
  }, [response])

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

  // Focus = hovered club, else selected club. The path that explains it stays bright; the rest recedes.
  const focusId = hoveredId ?? selectedId
  const focusNodeId = focusId != null ? `club:${focusId}` : null
  const active = useMemo(() => {
    const focusNode = focusNodeId && graph.nodes.find((n) => n.id === focusNodeId)
    if (!focusNode) return null
    const ids = new Set(['you', focusNode.id])
    for (const e of graph.edges) {
      if (e.target === focusNode.id || e.source === focusNode.id) {
        ids.add(e.source)
        ids.add(e.target)
      }
    }
    return ids
  }, [graph, focusNodeId])

  const useBrightness = graph.nodes.some((n) => n.type === 'club' && n.data?.last_updated)

  const nodes = useMemo(() => {
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
            dim: active ? !active.has(n.id) : false,
            lit: active ? active.has(n.id) : false,
            // with the club panel open the graph is small: only the focused club's path keeps its labels
            labelHidden: panelOpen && !!active && !active.has(n.id),
            selected: n.type === 'club' && clubId === selectedId,
            hovered: n.type === 'club' && clubId === hoveredId,
            pulse: n.type === 'event' && pulseIds.has(n.id),
            brightness: useBrightness ? clubBrightness(n.data?.last_updated) : 1,
            onSelect: () => onSelect?.(clubId),
            onHover: (on) => onHover?.(on ? clubId : null),
          },
        }
      })
  }, [graph, active, panelOpen, selectedId, hoveredId, pulseIds, useBrightness, onSelect, onHover])

  const edges = useMemo(
    () =>
      graph.edges.map((e) => {
        const lit = active && active.has(e.source) && active.has(e.target)
        const toEvent = e.target.startsWith('event:')
        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          type: 'straight',
          focusable: false,
          selectable: false,
          style: {
            stroke: lit ? gold.color : toEvent ? EDGE_EVENT : EDGE,
            strokeWidth: lit ? 1.25 : 1,
            opacity: active && !lit ? EDGE_DIM : 1,
            transition: `opacity ${motion.base}ms, stroke ${motion.base}ms`,
          },
        }
      }),
    [graph, active],
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
