import { EDGE_REVEAL_MS, TRANSITION_MS } from '@/lib/graphTuning'
import { sky } from '@/lib/theme'

/**
 * A straight connection made of two stacked paths: a faint one that is always there, and a brighter one that is drawn
 * over it (pathLength=1 and a dash offset) when the edge is part of the hovered constellation, so the line grows
 * outward instead of popping in.
 *
 * It is deliberately static: React Flow replaces every edge element whenever its `edges` array changes, which would
 * cancel any CSS transition. So StarGraph hands React Flow a stable edge list and applies the highlight (opacity and
 * dash offset) straight to these persistent elements. The star physics rewrites `d` on them the same way.
 * @param {{ id: string, sourceX: number, sourceY: number, targetX: number, targetY: number,
 *   data: { base: string, instant: boolean } }} props
 */
export default function StarEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const d = `M${sourceX},${sourceY} L${targetX},${targetY}`
  return (
    <g style={{ pointerEvents: 'none' }}>
      <path
        data-edge={id}
        d={d}
        fill="none"
        stroke={data.base}
        strokeWidth={1}
        style={{ opacity: 1, transition: data.instant ? 'none' : `opacity ${TRANSITION_MS}ms ease` }}
      />
      <path
        data-edge={id}
        data-lit
        d={d}
        pathLength={1}
        fill="none"
        stroke={sky.textMuted}
        strokeWidth={1.25}
        strokeDasharray="1 1"
        style={{
          strokeDashoffset: 1, // hidden until StarGraph reveals it
          transition: data.instant ? 'none' : `stroke-dashoffset ${EDGE_REVEAL_MS}ms ease-out`,
        }}
      />
    </g>
  )
}
