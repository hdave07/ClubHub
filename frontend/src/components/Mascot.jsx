import { lazy, Suspense } from 'react'
import { IS_DEMO, SHOW_MASCOT } from '@/lib/flags'

// Lazy, so with SHOW_MASCOT off the component, its stylesheet and its images are never requested.
const Puffer = lazy(() => import('@/components/Puffer'))

/**
 * The puffer-bot, behind the SHOW_MASCOT flag. Everything else about it (cursor tracking, curiosity, sleep and the
 * blue "discovered" trim) lives in Puffer.jsx; callers only pass `state`, `size` and `onClick`.
 * @param {{ state?: 'idle' | 'scanning' | 'discovered', size?: number, onClick?: () => void }} props
 */
export default function Mascot(props) {
  if (!SHOW_MASCOT) return null
  return (
    <Suspense fallback={null}>
      <Puffer deterministic={IS_DEMO} {...props} />
    </Suspense>
  )
}
