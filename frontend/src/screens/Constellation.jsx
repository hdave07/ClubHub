import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// TODO Sprint 4 (ClubCard) / Sprint 5 (StarGraph): replace the plain list below with
// ranked ClubCards (left) and the React Flow star graph (right).
export default function Constellation({ data, loading, error, retry, onEdit, skipped, onTellUs }) {
  if (loading) {
    return (
      <div className="mx-auto min-h-svh max-w-3xl px-6 py-16" aria-busy="true">
        <h2 className="text-3xl">Mapping your constellation…</h2>
        <div aria-hidden className="mt-4 flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="twinkle size-1.5 rounded-full bg-foreground"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-1/2" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <h2 className="text-3xl">Couldn't map your stars. Try again.</h2>
        <div className="flex gap-3">
          <Button onClick={retry}>Retry</Button>
          <Button variant="ghost" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    )
  }

  const clubs = data?.clubs ?? []
  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl">Your constellation</h2>
        <Button variant="outline" onClick={onEdit}>
          Edit
        </Button>
      </div>

      {skipped && (
        <Button variant="link" className="mt-2 px-0" onClick={onTellUs}>
          ✦ Tell us what you want for better matches
        </Button>
      )}

      {clubs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No matches yet.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {clubs.map((club) => (
            <li key={club.id}>
              <h3 className="text-lg">{club.name}</h3>
              <p className="text-sm text-muted-foreground">{club.why_it_fits}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
