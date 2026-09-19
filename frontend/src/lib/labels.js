import { OUTCOME_LABELS } from '@/types'

/**
 * Display label for an outcome key. OUTCOME_LABELS stays the main plan's wording; this only softens
 * "and" to "&" and, with { short: true }, trims "Build skills/portfolio" for tight metadata lines.
 * @param {import('@/types').Outcome} key
 * @param {{ short?: boolean }} [opts]
 */
export function outcomeLabel(key, { short = false } = {}) {
  if (short && key === 'build_skills') return 'Build skills'
  return (OUTCOME_LABELS[key] ?? '').replace(' and ', ' & ')
}
