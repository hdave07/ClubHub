import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import ClubCard, { ClubCardSkeleton } from '@/components/ClubCard'
import ClubList from '@/components/ClubList'
import StarGraph from '@/components/StarGraph'
import { clubIdsForPulse } from '@/lib/buildGraph'
import { button, gold, sage, sky } from '@/lib/theme'
import { previewClubs } from './previewClubs'

// ?preview=live  -> only the cards + graph pair (add &hover=0 or &pulse to start in those states)
// ?preview=many  -> only the 8-club graph
const params = new URLSearchParams(window.location.search)
const mode = params.get('preview')

const PULSE_ID = 'event:preview-event-1' // the Dropbox event in previewClubs
const GRAPH_RESPONSE = { clubs: previewClubs }

const OUTCOMES = [
  'Make friends',
  'Build skills/portfolio',
  'Career and networking',
  'Leadership',
  'Give back',
  'Culture and identity',
  'Wellness and recreation',
  'Academic/research',
]
const NAMES = [
  'UofT Venture Capital Club',
  'St. George Board Games Society',
  'UofT Robotics Team',
  'Hart House Debating Club',
  'Engineering Society',
  'Women in Tech at UofT',
  'UofT Consulting Group',
  'Outdoors Club',
]
const MANY = {
  clubs: NAMES.map((name, i) => ({
    ...previewClubs[i % 3],
    id: `many-${i}`,
    name,
    outcomes: [OUTCOMES[i % 8], OUTCOMES[(i + 3) % 8]],
    next_event: i % 2 ? { ...previewClubs[0].next_event, id: `many-ev-${i}`, source: i % 4 === 1 ? 'dropbox' : 'sop' } : null,
  })),
}

function Swatch({ name, color }) {
  return (
    <div className="flex w-28 flex-col gap-1 text-xs">
      <div className="h-12 rounded-lg border border-border" style={{ background: color }} />
      <span className="text-foreground">{name}</span>
      <span className="text-muted-foreground">{color}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl">{title}</h2>
      {children}
    </section>
  )
}

function LiveDemo() {
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(() => (params.has('hover') ? (previewClubs[Number(params.get('hover'))]?.id ?? null) : null))
  const [pulsing, setPulsing] = useState(() => params.has('pulse'))
  const pulseIds = useMemo(() => (pulsing ? new Set([PULSE_ID]) : undefined), [pulsing])
  const highlightIds = useMemo(() => clubIdsForPulse(previewClubs, pulseIds), [pulseIds])

  // Unmount and remount so the one-shot highlight plays again.
  const replay = () => {
    setPulsing(false)
    setTimeout(() => setPulsing(true), 60)
  }

  return (
    <>
      <Button variant="outline" size="sm" className="mb-3" onClick={replay}>
        Pulse test: play the arrival highlight
      </Button>
      <div className="flex h-[600px] gap-6">
        <ClubList
          clubs={previewClubs}
          selectedId={selectedId}
          hoveredId={hoveredId}
          highlightIds={highlightIds}
          onSelect={setSelectedId}
          onHover={setHoveredId}
        />
        <div className="relative flex-1 overflow-hidden rounded-xl bg-card">
          <StarGraph
            response={GRAPH_RESPONSE}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            pulseIds={pulseIds}
          />
        </div>
      </div>
    </>
  )
}

function ManyGraph() {
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  return (
    <div className="relative h-[640px] overflow-hidden rounded-xl bg-card">
      <StarGraph
        response={MANY}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onSelect={setSelectedId}
        onHover={setHoveredId}
      />
    </div>
  )
}

export default function Preview() {
  if (mode === 'live') return <div className="mx-auto max-w-6xl px-6 py-10"><LiveDemo /></div>
  if (mode === 'many') return <div className="mx-auto max-w-6xl px-6 py-10"><ManyGraph /></div>

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-6 py-12">
      <p className="text-xs tracking-widest text-muted-foreground">DEV PREVIEW · THEME CHECK</p>

      <Section title="Palette">
        <div className="flex flex-wrap gap-4">
          {Object.entries(sky).map(([k, v]) => (
            <Swatch key={k} name={k} color={v} />
          ))}
          <Swatch name="gold" color={gold.color} />
          <Swatch name="gold muted" color={gold.muted} />
          <Swatch name="sage" color={sage} />
          <Swatch name="button" color={button.bg} />
        </div>
      </Section>

      <Section title="Typography">
        <h1 className="text-4xl">Your U of T Universe</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          1,250 clubs are out there, waiting to be found. Why not by you? This is Inter body text on charcoal.
        </p>
      </Section>

      <Section title="shadcn components">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Explore →</Button>
          <Button variant="outline">Skip this</Button>
          <Button variant="ghost">Just look around</Button>
          <Badge>Badge</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input placeholder="What are you studying?" />
          <Textarea placeholder="e.g. first-year CS, want internships and friends, not too intense" />
        </div>
      </Section>

      <Section title="Club cards">
        <div className="grid gap-4 md:grid-cols-3">
          {previewClubs.map((c, i) => (
            <ClubCard key={c.id} club={c} rank={i + 1} />
          ))}
        </div>
        <p className="mt-6 mb-3 text-xs tracking-widest text-muted-foreground">STATES: SELECTED · HOVERED · ARRIVAL · SKELETON</p>
        <div className="grid gap-4 md:grid-cols-4">
          <ClubCard club={previewClubs[0]} rank={1} selected />
          <ClubCard club={previewClubs[1]} rank={2} hovered />
          <ClubCard club={previewClubs[0]} rank={1} highlighted />
          <ClubCardSkeleton />
        </div>
      </Section>

      <Section title="Cards + graph (hover a card or a dot; the button plays the Dropbox arrival highlight)">
        <LiveDemo />
      </Section>

      <Section title="Graph with 8 clubs (density check)">
        <ManyGraph />
      </Section>
    </div>
  )
}
