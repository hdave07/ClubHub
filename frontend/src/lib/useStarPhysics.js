import { useEffect } from 'react'
import { createSimulation } from '@/lib/starPhysics'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const WRITE_THRESHOLD = 0.02 // px: smaller changes are invisible, so they are not written to the DOM

/**
 * Cursor physics and idle drift for the star graph, driven by one requestAnimationFrame loop that lives outside React.
 * Nothing here sets state: pointer events only write into a plain object, and each frame the simulation
 * (lib/starPhysics.js) is stepped and the result written straight to the DOM:
 *   - each star's own root element gets a CSS transform (React Flow keeps the star's resting position), and
 *   - each connection's `d` attribute is redrawn between the moved stars, so lines follow them.
 * The loop pauses while the graph is offscreen or the tab is hidden, and is switched off (stars ease home and stay
 * there) under prefers-reduced-motion. Touch pointers are ignored; there is no hover on touch.
 *
 * @param {{ current: HTMLElement | null }} rootRef the graph container
 * @param {{ nodes: object[], edges: object[] }} graph laid-out graph from lib/layout.js
 * @param {{ current: { x: number, y: number, zoom: number } }} viewRef React Flow's viewport, kept current by StarGraph
 */
export function useStarPhysics(rootRef, graph, viewRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const sim = createSimulation(graph.nodes, graph.edges)
    const n = sim.count
    const nodeIds = graph.nodes.map((node) => node.id)
    const nodeEls = new Array(n).fill(null)
    const lastX = new Float32Array(n).fill(NaN) // last offsets written (flow units); NaN forces the first write
    const lastY = new Float32Array(n).fill(NaN)
    const moved = new Uint8Array(n)
    const edgeDefs = graph.edges
      .map((e) => ({ a: sim.index.get(e.source), b: sim.index.get(e.target), id: `${e.source}->${e.target}`, els: null }))
      .filter((e) => e.a !== undefined && e.b !== undefined)

    const pointer = { x: 0, y: 0, active: false }
    let clientX = 0
    let clientY = 0
    let rect = root.getBoundingClientRect()
    let rectDirty = false
    let visible = true
    let raf = 0
    let last = 0
    const reduced = window.matchMedia(REDUCED_MOTION)
    let physics = !reduced.matches

    // React Flow may (re)create these elements, so they are looked up lazily and re-checked with isConnected.
    const nodeEl = (i) => {
      let el = nodeEls[i]
      if (el && el.isConnected) return el
      el = root.querySelector(`.react-flow__node[data-id="${nodeIds[i]}"]`)?.firstElementChild ?? null
      nodeEls[i] = el
      lastX[i] = NaN
      lastY[i] = NaN
      return el
    }
    const edgeEls = (def) => {
      const els = def.els
      if (els && els[0].isConnected && els[1].isConnected) return els
      const found = root.querySelectorAll(`path[data-edge="${def.id}"]`)
      def.els = found.length === 2 ? [found[0], found[1]] : null
      def.fresh = true // new elements start at the resting layout, so they must be redrawn even if nothing moved
      return def.els
    }

    const write = (zoom) => {
      const inv = 1 / zoom
      for (let i = 0; i < n; i++) {
        moved[i] = 0
        if (sim.fixed[i]) continue
        const el = nodeEl(i)
        if (!el) continue
        const x = sim.ox[i] * inv
        const y = sim.oy[i] * inv
        if (!Number.isNaN(lastX[i]) && Math.abs(x - lastX[i]) < WRITE_THRESHOLD && Math.abs(y - lastY[i]) < WRITE_THRESHOLD) continue
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
        lastX[i] = x
        lastY[i] = y
        moved[i] = 1
      }
      for (const def of edgeDefs) {
        const els = edgeEls(def)
        if (!els) continue
        if (!moved[def.a] && !moved[def.b] && !def.fresh) continue
        def.fresh = false
        const d = `M${(sim.cx[def.a] + sim.ox[def.a] * inv).toFixed(2)},${(sim.cy[def.a] + sim.oy[def.a] * inv).toFixed(2)} L${(sim.cx[def.b] + sim.ox[def.b] * inv).toFixed(2)},${(sim.cy[def.b] + sim.oy[def.b] * inv).toFixed(2)}`
        els[0].setAttribute('d', d)
        els[1].setAttribute('d', d)
      }
    }

    const settled = () => {
      for (let i = 0; i < n; i++) if (Math.abs(sim.ox[i]) > WRITE_THRESHOLD || Math.abs(sim.oy[i]) > WRITE_THRESHOLD) return false
      return true
    }

    const dev = import.meta.env.DEV ? (window.__starPhysics ??= { frames: 0, running: false, ms: 0 }) : null

    const tick = (now) => {
      raf = 0
      if (!visible || document.hidden) return
      const t0 = dev ? performance.now() : 0
      const dt = last ? Math.min(now - last, 64) : 16.667
      last = now
      if (rectDirty) {
        rect = root.getBoundingClientRect()
        rectDirty = false
      }
      pointer.x = clientX - rect.left
      pointer.y = clientY - rect.top
      const view = viewRef.current
      sim.step(dt, now / 1000, pointer, view, physics)
      write(view.zoom || 1)
      if (dev) {
        dev.frames++
        dev.ms += performance.now() - t0
      }
      if (physics || !settled()) raf = requestAnimationFrame(tick)
      else if (dev) dev.running = false
    }
    const wake = () => {
      if (raf || !visible || document.hidden) return
      last = 0
      if (dev) dev.running = true
      raf = requestAnimationFrame(tick)
    }
    const sleep = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      if (dev) dev.running = false
    }

    const onMove = (e) => {
      if (e.pointerType === 'touch') return
      clientX = e.clientX
      clientY = e.clientY
      pointer.active = true
    }
    const onLeave = () => {
      pointer.active = false
    }
    const markRect = () => {
      rectDirty = true
    }
    const onVisibility = () => (document.hidden ? sleep() : wake())
    const onReducedChange = () => {
      physics = !reduced.matches
      wake()
    }

    root.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('pointercancel', onLeave)
    window.addEventListener('scroll', markRect, { passive: true, capture: true })
    document.addEventListener('visibilitychange', onVisibility)
    reduced.addEventListener('change', onReducedChange)
    const resize = new ResizeObserver(markRect)
    resize.observe(root)
    const intersect = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) {
        rectDirty = true
        wake()
      } else sleep()
    })
    intersect.observe(root)
    wake()

    return () => {
      sleep()
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointercancel', onLeave)
      window.removeEventListener('scroll', markRect, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
      reduced.removeEventListener('change', onReducedChange)
      resize.disconnect()
      intersect.disconnect()
    }
  }, [rootRef, graph, viewRef])
}
