import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState } from 'react'
import { ReactFlow } from '@xyflow/react'
import StarField from '@/components/StarField'
import { ClubNode, EventNode, OutcomeNode, YouNode } from '@/components/StarNode'
import { buildGraph } from '@/lib/buildGraph'
import { radialLayout } from '@/lib/layout'
import { clubBrightness, gold, motion, sky } from '@/lib/theme'

const nodeTypes = { you: YouNode, outcome: OutcomeNode, club: ClubNode, event: EventNode }
const NO_PULSE = new Set()

// Edges are hairlines: nearly invisible until a club is focused, when its path turns gold.
const EDGE = `${sky.heading}1A`
const EDGE_EVENT = `${sky.heading}12` // event edges are the faintest
const EDGE_DIM = 0.3

export default function StarGraph({
  response,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
  pulseIds = NO_PULSE,
}) {
  const graph = useMemo(() => {
    const g = buildGraph(response)
    return { nodes: radialLayout(g.nodes, g.edges), edges: g.edges }
  }, [response])

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

  const nodes = useMemo(
    () =>
      graph.nodes.map((n) => {
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
            dim: active ? !active.has(n.id) : false,
            lit: active ? active.has(n.id) : false,
            selected: n.type === 'club' && clubId === selectedId,
            hovered: n.type === 'club' && clubId === hoveredId,
            pulse: n.type === 'event' && pulseIds.has(n.id),
            brightness: useBrightness ? clubBrightness(n.data?.last_updated) : 1,
            onSelect: () => onSelect?.(clubId),
            onHover: (on) => onHover?.(on ? clubId : null),
          },
        }
      }),
    [graph, active, selectedId, hoveredId, pulseIds, useBrightness, onSelect, onHover],
  )

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
        fitViewOptions={{ padding: { top: '56px', bottom: '56px', left: '140px', right: '140px' } }}
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
        style={{ opacity: showHint ? 1 : 0, transition: `opacity ${motion.slow}ms` }}
      >
        Tap a club to see why it fits.
      </p>
    </div>
  )
}
