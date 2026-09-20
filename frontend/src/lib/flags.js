// Feature flags, in one place. Flip a value and rebuild.

// The puffer-bot mascot (components/Mascot.jsx): Welcome and the results page. false removes it, along with the
// space the results page reserves for it, and its code and assets are never loaded.
export const SHOW_MASCOT = true

// ?demo: deterministic mascot (it never falls asleep on its own), for rehearsals and recordings.
export const IS_DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')
