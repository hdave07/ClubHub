export const SKIP_BLURB = 'Student open to exploring anything; show a varied mix of clubs.'
export const SURPRISE_ME = '✨ Surprise me'

/**
 * Blurb construction per onboarding-flow.md.
 * @param {string} major
 * @param {string} text
 * @returns {string}
 */
export function buildBlurb(major, text) {
  const t = (text ?? '').trim()
  if (!t || t === SURPRISE_ME) return SKIP_BLURB
  const m = (major ?? '').trim()
  return `${m ? m + ' student. ' : ''}${t}`
}
