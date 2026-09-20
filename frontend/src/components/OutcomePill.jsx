import { outcomeLabel } from '@/lib/labels'
import { outcomeColor } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * An outcome as a pill: its color as text on its tinted background, no border. Color means "outcome" and nothing
 * else, and the label is always there. Shared by the club card and the club panel so the list and the graph match.
 * @param {{ outcomeKey: import('@/types').Outcome, short?: boolean, className?: string }} props
 */
export default function OutcomePill({ outcomeKey, short = false, className }) {
  const { color, pillBg } = outcomeColor(outcomeKey)
  return (
    <span
      className={cn('rounded-full px-2 py-0.5 text-xs leading-4', className)}
      style={{ color, backgroundColor: pillBg }}
    >
      {outcomeLabel(outcomeKey, { short })}
    </span>
  )
}
