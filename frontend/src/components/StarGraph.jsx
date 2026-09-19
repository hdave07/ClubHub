import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState } from 'react'
import { ReactFlow } from '@xyflow/react'
import StarField from '@/components/StarField'
import { ClubNode, EventNode, OutcomeNode, YouNode } from '@/components/StarNode'
import { buildGraph } from '@/lib/buildGraph'
import { radialLayout } from '@/lib/layout'
import { clubBrightness, motion, sky } from '@/lib/theme'

const nodeTypes = { you: YouNode, outcome: OutcomeNode, club: ClubNode, event: EventNode }
const NO_PULSE = new Set()
const EDGE_DIM = 0.2

// Constellation lines: the star color at 18% (brighter when highlighted).
const EDGE_STROKE = `${sky.stars}2E`
const EDGE_STROKE_ACTIVE = `${sky.stars}99`

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

  // Focus = hovered club, else selected club. Everything not connected to it fades.
  const focusId = hoveredId ?? selectedId
  const active = useMemo(() => {
    const focusNode = focusId != null && graph.nodes.find((n) => n.id === `club:${focusId}`)
    if (!focusNode) return null
    const ids = new Set(['you', focusNode.id])
    for (const e of graph.edges) {
      if (e.target === focusNode.id || e.source === focusNode.id) {
        ids.add(e.source)
        ids.add(e.target)
      }
    }
    return ids
  }, [graph, focusId])

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
            selected: n.type === 'club' && clubId === selectedId,
            hovered: n.type === 'club' && clubId === hoveredId,
            pulse: pulseIds.has(n.id),
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
        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          type: 'straight',
          focusable: false,
          selectable: false,
          style: {
            stroke: lit ? EDGE_STROKE_ACTIVE : EDGE_STROKE,
            strokeWidth: 1,
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
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.4}
        maxZoom={2}
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
        Tap a star to learn more.
      </p>
    </div>
  )
}
