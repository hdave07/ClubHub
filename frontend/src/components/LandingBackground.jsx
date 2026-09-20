import '@designcodeio/threeui/style.css'
import { PredictiveArcCanvas } from '@designcodeio/threeui/components/PredictiveArcCanvas'

/**
 * ThreeUI "signal-particles" (https://threeui.com). The preset was speed 0.59, hue -35, saturation 0.31, brightness 1.21;
 * retuned for the landing page: slower and more saturated. Change the numbers here.
 * `speed` is a multiplier (1 = normal).
 */
export const LANDING_PARTICLES = {
  variant: 'signal-particles',
  mode: 'dark',
  speed: 0.3,
  hue: -35,
  saturation: 0.65,
  brightness: 1.21,
}

/** Fills its parent. Decorative only: not focusable, not clickable, hidden from screen readers. */
export default function LandingBackground() {
  return (
    <div aria-hidden inert className="pointer-events-none absolute inset-0 overflow-hidden">
      <PredictiveArcCanvas {...LANDING_PARTICLES} />
    </div>
  )
}
