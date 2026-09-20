import { lazy, Suspense, useState } from 'react'
import { buildBlurb } from '@/lib/blurb'
import { motion } from '@/lib/theme'
import { useRecommend } from '@/lib/useRecommend'
import Blurb from '@/screens/Blurb'
import Campus from '@/screens/Campus'
import Constellation from '@/screens/Constellation'
import Directory from '@/screens/Directory'
import Major from '@/screens/Major'
import Welcome from '@/screens/Welcome'

// One particle background behind Welcome, Major and Blurb. It lives here, above the step wrapper, so it keeps running
// (no restart or flash) as the steps change. Loaded only when needed.
const LandingBackground = lazy(() => import('@/components/LandingBackground'))

// Dev only: with ?previewData, open straight on the results screen. Remove after real data lands.
const PREVIEW_DATA = import.meta.env.DEV && new URLSearchParams(window.location.search).has('previewData')

// The Full Directory opens in its own browser tab (Constellation's "Full Directory" button does
// window.open) rather than a step in this file's flow, so browsing/searching there can never touch this
// tab's own graph. No router: one query param, same pattern as ?previewData above.
const VIEW = new URLSearchParams(window.location.search).get('view')

// The answers (major, blurb) live only in this tab's memory: every visit starts with empty boxes. They used to be
// saved in localStorage and restored, so this drops that old key once (no other site data is touched).
const LEGACY_STORAGE_KEY = 'campus-compass:input'
try {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
} catch {
  // storage unavailable: nothing to clear
}
const EMPTY_INPUT = { major: '', blurb_text: '' }

function MainFlow() {
  const [step, setStep] = useState(PREVIEW_DATA ? 'results' : 'campus') // campus | welcome | major | blurb | results
  const [input, setInput] = useState(EMPTY_INPUT)
  // Reduced motion: no animated background (Welcome keeps its static stars).
  const [animate] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const { data, loading, error, run, retry } = useRecommend()

  function launch(text) {
    run(buildBlurb(input.major, text))
    setStep('results')
  }

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      {animate && step !== 'results' && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
          <Suspense fallback={null}>
            <LandingBackground />
          </Suspense>
        </div>
      )}
      <div
        key={step}
        className="relative z-10 animate-in fade-in"
        style={{ animationDuration: `${motion.base}ms` }}
      >
        {step === 'campus' && <Campus onChoose={() => setStep('welcome')} />}
        {step === 'welcome' && <Welcome onExplore={() => setStep('major')} />}
        {step === 'major' && (
          <Major
            major={input.major}
            onChange={(major) => setInput((i) => ({ ...i, major }))}
            onNext={() => setStep('blurb')}
          />
        )}
        {step === 'blurb' && (
          <Blurb
            text={input.blurb_text}
            onChange={(blurb_text) => setInput((i) => ({ ...i, blurb_text }))}
            onLaunch={launch}
          />
        )}
        {step === 'results' && (
          <Constellation
            data={data}
            loading={loading}
            error={error}
            retry={retry}
            onEdit={() => setStep('blurb')}
          />
        )}
      </div>
    </div>
  )
}

function App() {
  return VIEW === 'directory' ? <Directory /> : <MainFlow />
}

export default App
