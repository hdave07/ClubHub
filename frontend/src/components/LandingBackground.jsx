import { useEffect, useRef } from 'react'
import '@designcodeio/threeui/style.css'
import { PredictiveArcCanvas } from '@designcodeio/threeui/components/PredictiveArcCanvas'

/**
 * ThreeUI "signal-particles" (https://threeui.com). The preset was speed 0.59, hue -35, saturation 0.31, brightness 1.21;
 * retuned for the landing page: slower and more saturated. Change the numbers here.
 * `speed` is a multiplier (1 = normal).
 */
const LANDING_PARTICLES = {
  variant: 'signal-particles',
  mode: 'dark',
  speed: 0.12,
  hue: -35,
  saturation: 0.65,
  brightness: 1.21,
}

/**
 * The package hands `speed` to its iframe with one postMessage when the iframe mounts, before the page inside has
 * loaded, so the page never hears it and runs at speed 1. (hue, saturation and brightness are CSS filters on the
 * iframe and are unaffected.) The page merges partial controls, so we re-send just the speed once it has loaded.
 */
function useSpeedSync(ref, speed) {
  useEffect(() => {
    const root = ref.current
    if (!root) return undefined
    let frame = null
    const send = () =>
      frame?.contentWindow?.postMessage({ type: 'threeui-controls', controls: { speed } }, '*')
    const attach = (el) => {
      frame = el
      el.addEventListener('load', send)
      send()
    }
    const existing = root.querySelector('iframe')
    if (existing) attach(existing)
    // the iframe is rendered by a lazy component inside the package, so it can appear after this effect runs
    const observer = new MutationObserver(() => {
      const el = root.querySelector('iframe')
      if (el && el !== frame) attach(el)
    })
    observer.observe(root, { childList: true, subtree: true })
    const retries = [400, 1200, 2500].map((ms) => setTimeout(send, ms)) // cheap insurance if `load` fired early
    return () => {
      observer.disconnect()
      frame?.removeEventListener('load', send)
      retries.forEach(clearTimeout)
    }
  }, [ref, speed])
}

/** Fills its parent. Decorative only: not focusable, not clickable, hidden from screen readers. */
export default function LandingBackground() {
  const ref = useRef(null)
  useSpeedSync(ref, LANDING_PARTICLES.speed)
  return (
    <div ref={ref} aria-hidden inert className="pointer-events-none absolute inset-0 overflow-hidden">
      <PredictiveArcCanvas {...LANDING_PARTICLES} />
    </div>
  )
}
