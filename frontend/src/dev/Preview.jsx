import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { OUTCOME_LABELS, normalizeOutcome } from '@/types'
import { gold, outcomeColor, outcomeColors, sky } from '@/lib/theme'
import ClubCard, { ClubCardSkeleton } from '@/components/ClubCard'
import { previewClubs } from './previewClubs'

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

function PreviewClubCard({ club }) {
  const limited = !club.summary || club.summary.toLowerCase() === 'limited info'
  const ev = club.next_event
  return (
    <Card>
      <CardHeader>
        <CardTitle>{club.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {limited && <p className="text-muted-foreground">Limited info so far</p>}
        <p>{club.why_it_fits}</p>
        <div className="flex flex-wrap gap-2">
          {club.outcomes.map((o) => (
            <Badge key={o} variant="outline" style={{ color: outcomeColor(o), borderColor: outcomeColor(o) }}>
              {OUTCOME_LABELS[normalizeOutcome(o)] ?? o}
            </Badge>
          ))}
        </div>
        {ev ? (
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>
              {ev.title} · {new Date(ev.start).toLocaleString('en-CA', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
            {ev.source === 'dropbox' && (
              <a href={ev.dropbox_link} target="_blank" rel="noreferrer">
                <Badge style={{ background: gold.color, color: sky.bg, boxShadow: `0 0 12px 2px ${gold.glow}` }}>
                  Updated from Dropbox: {ev.source_file}
                </Badge>
              </a>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No upcoming events listed</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function Preview() {
  return (
    <div className="mx-auto min-h-svh max-w-4xl px-6 py-12">
      <p className="text-xs tracking-widest text-muted-foreground">DEV PREVIEW · THEME CHECK</p>

      <Section title="Sky tokens">
        <div className="flex flex-wrap gap-4">
          {Object.entries(sky).map(([k, v]) => (
            <Swatch key={k} name={k} color={v} />
          ))}
          <Swatch name="gold" color={gold.color} />
          <Swatch name="gold glow" color={gold.glow} />
        </div>
      </Section>

      <Section title="Outcome constellations">
        <div className="flex flex-wrap gap-4">
          {Object.entries(outcomeColors).map(([k, v]) => (
            <Swatch key={k} name={OUTCOME_LABELS[k]} color={v} />
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <h1 className="text-4xl">Your U of T Universe</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          1,250 clubs are out there, waiting to be found. Why not by you? This is Inter body text on the night sky.
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
        <p className="mt-6 mb-3 text-xs tracking-widest text-muted-foreground">STATES: SELECTED · HOVERED · SKELETON</p>
        <div className="grid gap-4 md:grid-cols-3">
          <ClubCard club={previewClubs[0]} rank={1} selected />
          <ClubCard club={previewClubs[1]} rank={2} hovered />
          <ClubCardSkeleton />
        </div>
      </Section>

      <Section title="Sample clubs (raw, not the final ClubCard)">
        <div className="grid gap-4 md:grid-cols-3">
          {previewClubs.map((c) => (
            <PreviewClubCard key={c.id} club={c} />
          ))}
        </div>
      </Section>
    </div>
  )
}
