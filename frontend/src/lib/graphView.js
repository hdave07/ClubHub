import { createContext, useContext } from 'react'
import { DIMMED_OPACITY, NEIGHBOR_OPACITY } from '@/lib/graphTuning'

// What the graph is highlighting right now, shared with the node components through context.
//
// Why context and not per-node `data`: every time the `nodes` array changes, React Flow re-measures the nodes and,
// for a moment, cannot place their edges, so it drops and re-adds every edge element. That would cancel the edges'
// CSS transitions and re-run their layout on every hover. So StarGraph gives React Flow one stable `nodes` array and
// each node reads the highlight from here; a change re-renders only the node components.
export const GraphViewContext = createContext(null)

const IDLE = { lit: false, opacity: 1, selected: false, hovered: false, direct: false, labelHidden: false }

/**
 * @param {string} id node id, e.g. "club:42"
 * @param {'you' | 'outcome' | 'club' | 'event'} type
 * @param {string} [clubId] for club and event nodes
 */
export function useNodeView(id, type, clubId) {
  const v = useContext(GraphViewContext)
  if (!v) return IDLE
  const { active, hoverHL, selectionHL, selectedId, hoveredId, hoveredOutcome, panelOpen } = v
  const lit = !!active?.nodeIds.has(id)
  return {
    lit,
    // three tiers: the hovered star (100%), its direct neighbors, and everything else (dimmed but still visible)
    opacity: !active ? 1 : id === active.focus ? 1 : lit ? NEIGHBOR_OPACITY : DIMMED_OPACITY,
    selected: type === 'club' && selectedId != null && clubId === String(selectedId),
    hovered: type === 'club' && !!hoverHL?.clubIds.has(clubId),
    // the star (or outcome) directly under the pointer or focus, as opposed to merely being on the hovered path
    direct: (type === 'club' && hoveredId != null && clubId === String(hoveredId)) || (type === 'outcome' && id === hoveredOutcome),
    // with the club panel open the graph is small: only the focused path (and a hovered one) keeps its labels
    labelHidden: panelOpen && !!(selectionHL || hoverHL) && !(selectionHL?.nodeIds.has(id) || hoverHL?.nodeIds.has(id)),
  }
}
