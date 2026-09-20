import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { HOVER_SCALE, TRANSITION_MS } from '@/lib/graphTuning'
import { useNodeView } from '@/lib/graphView'
import { gold, motion, nodeStyles, sky } from '@/lib/theme'
import { outcomeLabel } from '@/lib/labels'

// Handles exist only so edges have an anchor. They sit at the node center and are never visible.
const handleStyle = {
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  background: 'transparent',
  opacity: 0,
  pointerEvents: 'none',
}

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} isConnectable={false} />
    </>
  )
}

// Labels sit on the outward side of a node (chosen by the layout) so edges don't run through the text.
const SIDES = {
  right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 9, textAlign: 'left' },
  left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 9, textAlign: 'right' },
  top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, textAlign: 'center' },
  bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8, textAlign: 'center' },
  // With the club panel open: above or below the dot, growing toward the middle of the graph (never outward).
  topStart: { bottom: '100%', left: -2, marginBottom: 8, textAlign: 'left' },
  topEnd: { bottom: '100%', right: -2, marginBottom: 8, textAlign: 'right' },
  bottomStart: { top: '100%', left: -2, marginTop: 8, textAlign: 'left' },
  bottomEnd: { top: '100%', right: -2, marginTop: 8, textAlign: 'right' },
}

function Label({ side = 'bottom', color, weight = 400, title, hidden = false, children }) {
  return (
    <span
      title={title}
      style={{
        position: 'absolute',
        width: 'max-content',
        maxWidth: 132,
        fontSize: 12.5,
        lineHeight: 1.25,
        fontWeight: weight,
        color,
        // a faint halo in the panel color, only enough to stay legible where an edge passes behind the text
        textShadow: `0 0 3px ${sky.surface}, 0 0 6px ${sky.surface}`,
        pointerEvents: 'none',
        opacity: hidden ? 0 : 1,
        transition: `color ${motion.base}ms, opacity ${motion.base}ms`,
        ...SIDES[side],
      }}
    >
      {children}
    </span>
  )
}

// A node's emphasis (1 = the hovered star, less for its neighbors and the rest) eases in and out.
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const fade = (opacity = 1) => ({ opacity, transition: `opacity ${TRANSITION_MS}ms ${EASE}` })

function activateOnKey(e, onActivate) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    e.stopPropagation()
    onActivate()
  }
}

// Node sizes are the visible circle only, so the layout's centering stays exact; labels are absolutely positioned.
export function YouNode({ data }) {
  const { size } = nodeStyles.you
  const v = useNodeView(data.nodeId, 'you')
  return (
    <div style={{ position: 'relative', width: size, height: size, ...fade(v.opacity) }}>
      <Handles />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: sky.heading,
          color: sky.bg,
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // a hairline warm ring, no glow
          boxShadow: `0 0 0 4px ${sky.surface}, 0 0 0 5px ${gold.color}66`,
        }}
      >
        You
      </div>
    </div>
  )
}

export function OutcomeNode({ data }) {
  const { size } = nodeStyles.outcome
  const v = useNodeView(data.nodeId, 'outcome')
  return (
    <div style={{ position: 'relative', width: size, height: size, ...fade(v.opacity) }}>
      <Handles />
      <div
        style={{
          boxSizing: 'border-box',
          width: size,
          height: size,
          borderRadius: '50%',
          background: sky.surface, // hides the edge line behind the ring
          border: `1.5px solid ${v.lit ? gold.color : sky.textMuted}`,
          transform: v.direct ? `scale(${HOVER_SCALE})` : 'none',
          transition: `border-color ${TRANSITION_MS}ms ${EASE}, transform ${TRANSITION_MS}ms ${EASE}`,
        }}
      />
      <Label side={data.side} color={v.lit ? sky.heading : sky.textMuted} hidden={v.labelHidden}>
        {outcomeLabel(data.key)}
      </Label>
    </div>
  )
}

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function ClubNode({ data }) {
  const { size } = nodeStyles.club
  const v = useNodeView(data.nodeId, 'club', data.clubId)
  const emphasized = v.selected || v.hovered
  const name = data.label ?? ''
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${data.rank ?? ''}. ${name}`.trim()}
      aria-pressed={v.selected}
      onClick={(e) => {
        e.stopPropagation() // don't count as an empty-space click
        data.onSelect()
      }}
      onKeyDown={(e) => activateOnKey(e, data.onSelect)}
      // mouse hover is handled by React Flow (onNodeMouseEnter/Leave in StarGraph); keyboard focus lives here
      onFocus={() => data.onHover(true)}
      onBlur={() => data.onHover(false)}
      className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ position: 'relative', width: size, height: size, ...fade(v.opacity) }}
    >
      <Handles />
      {/* larger invisible hit area: the dot itself is only 9px */}
      <span aria-hidden style={{ position: 'absolute', inset: -8, borderRadius: '50%' }} />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: emphasized ? gold.color : sky.heading,
          opacity: emphasized ? 1 : data.brightness,
          transform: emphasized ? `scale(${HOVER_SCALE})` : 'none',
          // selected also gets a hairline ring, so the state isn't color alone
          boxShadow:
            [
              v.selected && `0 0 0 3px ${sky.surface}, 0 0 0 4px ${gold.color}`,
              v.direct && `0 0 9px 2px ${gold.color}55`, // a faint halo, only on the star under the pointer
            ]
              .filter(Boolean)
              .join(', ') || 'none',
          transition: `transform ${TRANSITION_MS}ms ${EASE}, background-color ${TRANSITION_MS}ms ${EASE}, opacity ${TRANSITION_MS}ms ${EASE}, box-shadow ${TRANSITION_MS}ms ${EASE}`,
        }}
      />
      <Label side={data.side} color={sky.heading} weight={emphasized ? 600 : 400} title={name} hidden={v.labelHidden}>
        {truncate(name, 34)}
      </Label>
    </div>
  )
}

// The quietest layer: a tiny neutral dot, labelled only on hover or focus.
export function EventNode({ data }) {
  const [active, setActive] = useState(false)
  const { size } = nodeStyles.event
  const v = useNodeView(data.nodeId, 'event', data.clubId)
  const lit = v.lit || active
  // Mouse hover on the dot only shows its own label (the club highlight comes from React Flow in StarGraph);
  // keyboard focus also lights the club.
  const focusSet = (on) => {
    setActive(on)
    data.onHover(on)
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={data.label}
      onClick={(e) => {
        e.stopPropagation()
        data.onSelect()
      }}
      onKeyDown={(e) => activateOnKey(e, data.onSelect)}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => focusSet(true)}
      onBlur={() => focusSet(false)}
      className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ position: 'relative', width: size, height: size, ...fade(v.opacity) }}
    >
      <Handles />
      <span aria-hidden style={{ position: 'absolute', inset: -9, borderRadius: '50%' }} />
      {data.pulse && <Arrival />}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: lit ? gold.color : sky.textMuted,
          opacity: lit ? 0.95 : 0.5,
          transition: `background-color ${motion.base}ms, opacity ${motion.base}ms`,
        }}
      />
      {active && (
        <Label side={data.side} color={sky.heading}>
          {data.label}
        </Label>
      )}
    </div>
  )
}

// A new Dropbox event just arrived: one restrained gold highlight (fade in, hold, fade out; see .arrival in index.css).
function Arrival() {
  return (
    <span
      aria-hidden
      className="arrival"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 32,
        height: 32,
        marginLeft: -16,
        marginTop: -16,
        borderRadius: '50%',
        border: `1.5px solid ${gold.color}`,
        background: `${gold.muted}`,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 9,
          height: 9,
          marginLeft: -4.5,
          marginTop: -4.5,
          borderRadius: '50%',
          background: gold.color,
        }}
      />
    </span>
  )
}
