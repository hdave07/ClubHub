import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { gold, motion, nodeStyles, outcomeColor, sky } from '@/lib/theme'
import { OUTCOME_LABELS } from '@/types'

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

const labelStyle = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginTop: 6,
  whiteSpace: 'nowrap',
  fontSize: 12,
  lineHeight: 1.2,
  color: sky.body,
  pointerEvents: 'none',
}

function fade(dim) {
  return { opacity: dim ? 0.2 : 1, transition: `opacity ${motion.base}ms` }
}

// Node sizes are the visible circle only, so the layout's centering stays exact; labels are absolutely positioned.
export function YouNode({ data }) {
  const { size } = nodeStyles.you
  return (
    <div style={{ position: 'relative', width: size, height: size, ...fade(data.dim) }}>
      <Handles />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: sky.heading,
          boxShadow: `0 0 32px 12px ${sky.heading}80`,
        }}
      />
      <span style={{ ...labelStyle, color: sky.heading }}>You</span>
    </div>
  )
}

export function OutcomeNode({ data }) {
  const { size } = nodeStyles.outcome
  const color = outcomeColor(data.key)
  return (
    <div style={{ position: 'relative', width: size, height: size, ...fade(data.dim) }}>
      <Handles />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 16px 4px ${color}66`,
        }}
      />
      <span style={labelStyle}>{OUTCOME_LABELS[data.key] ?? data.label}</span>
    </div>
  )
}

const STAR_PATH = 'M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z' // 4-point star

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function activateOnKey(e, onActivate) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    e.stopPropagation()
    onActivate()
  }
}

export function ClubNode({ data }) {
  const { size } = nodeStyles.club
  const color = outcomeColor(data.primaryOutcome)
  const name = data.label ?? ''
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${data.rank ?? ''}. ${name}`.trim()}
      aria-pressed={data.selected}
      onClick={(e) => {
        e.stopPropagation() // don't count as an empty-space click
        data.onSelect()
      }}
      onKeyDown={(e) => activateOnKey(e, data.onSelect)}
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
      onFocus={() => data.onHover(true)}
      onBlur={() => data.onHover(false)}
      className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ position: 'relative', width: size, height: size, ...fade(data.dim) }}
    >
      <Handles />
      {data.selected && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            border: `1.5px solid ${sky.heading}`,
          }}
        />
      )}
      {data.pulse && <PulseRing size={size} />}
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden
        style={{
          display: 'block',
          opacity: data.brightness,
          filter: `drop-shadow(0 0 5px ${color})`,
          transform: data.hovered ? 'scale(1.2)' : 'none',
          transition: `transform ${motion.fast}ms`,
        }}
      >
        <path d={STAR_PATH} fill={color} />
      </svg>
      <span style={labelStyle} title={name}>
        {truncate(name, 22)}
      </span>
    </div>
  )
}

function PulseRing({ size }) {
  return (
    <span
      aria-hidden
      className="star-pulse"
      style={{
        position: 'absolute',
        inset: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${gold.color}`,
        pointerEvents: 'none',
      }}
    />
  )
}

export function EventNode({ data }) {
  const [active, setActive] = useState(false)
  const dropbox = data.source === 'dropbox'
  const style = dropbox ? nodeStyles.eventDropbox : nodeStyles.event
  const { size } = style
  const set = (on) => {
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
      onMouseEnter={() => set(true)}
      onMouseLeave={() => set(false)}
      onFocus={() => set(true)}
      onBlur={() => set(false)}
      className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ position: 'relative', width: size, height: size, ...fade(data.dim) }}
    >
      <Handles />
      {/* larger invisible hit area: the dot itself is only 8px */}
      <span aria-hidden style={{ position: 'absolute', inset: -8, borderRadius: '50%' }} />
      {data.pulse && <PulseRing size={size} />}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: style.background,
          boxShadow: style.boxShadow,
        }}
      />
      {active && <span style={{ ...labelStyle, color: sky.heading }}>{data.label}</span>}
    </div>
  )
}
