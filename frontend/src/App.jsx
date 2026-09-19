import { useEffect, useState } from 'react'
import { SKIP_BLURB, buildBlurb } from '@/lib/blurb'
import { motion } from '@/lib/theme'
import { useRecommend } from '@/lib/useRecommend'
import Blurb from '@/screens/Blurb'
import Constellation from '@/screens/Constellation'
import Major from '@/screens/Major'
import Welcome from '@/screens/Welcome'

const STORAGE_KEY = 'campus-compass:input'
const EMPTY_INPUT = { major: '', blurb_text: '' }

function loadInput() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && typeof saved.major === 'string' && typeof saved.blurb_text === 'string') {
      return { major: saved.major, blurb_text: saved.blurb_text }
    }
  } catch {
    // storage unavailable or corrupt: start empty
  }
  return EMPTY_INPUT
}

function App() {
  const [step, setStep] = useState('welcome') // welcome | major | blurb | results
  const [input, setInput] = useState(loadInput)
  const [skipped, setSkipped] = useState(false)
  const { data, loading, error, run, retry } = useRecommend()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
    } catch {
      // storage unavailable: the app still works from state
    }
  }, [input])

  function launch(text) {
    setSkipped(false)
    run(buildBlurb(input.major, text))
    setStep('results')
  }

  function lookAround() {
    setSkipped(true)
    run(SKIP_BLURB)
    setStep('results')
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div
        key={step}
        className="animate-in fade-in"
        style={{ animationDuration: `${motion.base}ms` }}
      >
        {step === 'welcome' && <Welcome onExplore={() => setStep('major')} onSkip={lookAround} />}
        {step === 'major' && (
          <Major
            major={input.major}
            onChange={(major) => setInput((i) => ({ ...i, major }))}
            onNext={() => setStep('blurb')}
            onSkip={() => {
              setInput((i) => ({ ...i, major: '' }))
              setStep('blurb')
            }}
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
            skipped={skipped}
            onEdit={() => setStep('blurb')}
            onTellUs={() => setStep('major')}
          />
        )}
      </div>
    </div>
  )
}

export default App
