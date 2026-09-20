# AGENTS.md

Guidance for Codex (and future contributors) working in this repo.

## What this is

**Campus Compass** — a hackathon (24h) "StudentOS for Clubs" project. Full original
brainstorming spec lives at [`central-hub-for-clubs.md`](./central-hub-for-clubs.md);
this file is the condensed, code-facing version. Two things it does:

1. **Match**: student types a free-text blurb ("first-year CS, want internships and
   friends, not too intense") -> 5-8 ranked clubs with a "why this fits you" line,
   rendered as a small personal graph (you -> outcomes -> clubs -> next events).
2. **Dropbox drop-to-update**: a club drops a poster/PDF into a shared Dropbox folder;
   Codex extracts event details; it appears in the app live with a "from Dropbox"
   badge and a provenance link back to the source file.

The demo is **three flows working flawlessly** (SOP sync, match, Dropbox
drop-to-update). Everything else — auth, notifications, Instagram scraping, multi-campus
— is roadmap only. Don't build it.

## Repo layout

```
frontend/   React + Vite + JavaScript (JSX), Tailwind v4 (via @tailwindcss/vite), @xyflow/react
backend/    FastAPI + SQLModel (SQLite) + ChromaDB + Anthropic SDK + Dropbox SDK
```

Current state: **backend mostly built, frontend in progress.** `sop_sync`,
`enrichment`, `enrichment_batch`, `embeddings`, `dropbox_store`, `dropbox_watcher`,
`extraction`, `matcher`, and `ingest` are all implemented. What's still open:

- **`POST /api/recommend` is implemented** (`app/routers/recommend.py`):
  `embeddings.query_clubs()` for the ~20 nearest candidates, then
  `app/services/reranker.py` (Sonnet, forced tool use) narrows to 5-8 and writes a
  "why it fits" line per club, plus the student's own outcomes for the graph's
  middle layer.
- **The frontend graph is actively being built** — coordinate before editing
  `frontend/src/`.
- The Dropbox pipeline is written but **has not yet run end to end** — `ingestlog` and
  `event` are both empty, so treat that flow as unproven until you see rows.
- SQLite is synced with a 250-club sample, drawn from the 897 unique St. George clubs
  (1,309 groups campus-wide). Most rows are **not enriched yet** — check coverage with
  query #3 in `backend/data/validation_queries.sql`, close the gap with
  `enrichment_batch`. Match results stay thin and repetitive until that runs.

## Commands

Dev happens on Windows. **PowerShell 5.1 has no `&&`** — chain with `;` or just run
these as separate lines. Every `python -m` below assumes the venv is already active.

A `ModuleNotFoundError` means the venv is behind `requirements.txt`, not that the code
is wrong — `pip install -r requirements.txt` first. Only `sop_sync` runs without the
heavy deps; `app.main` imports `dropbox` transitively and won't even start without them.

```powershell
# backend
cd backend
.venv\Scripts\Activate.ps1                    # macOS/Linux: source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# frontend (proxies /api -> localhost:8000, see frontend/vite.config.js)
cd frontend
npm run dev
```

**Working on the frontend? Turn the Dropbox poller off first.** It starts with the app,
and `uvicorn --reload` restarts on every file save — each restart re-scans the inbox and
spends Codex calls on it.

```powershell
$env:DROPBOX_WATCHER_ENABLED = "0"            # bash: export DROPBOX_WATCHER_ENABLED=0
```

One-off pipeline scripts (never call these from a request handler):

```powershell
# SOP sync -> clubs in SQLite. Discovery is REST-only and cheap (~13 calls for the
# whole catalog); the cost is the per-club HTML scrape at ~1s each, so sample first.
python -m app.services.sop_sync --discover-only   # dry run: what would a --limit pull?
python -m app.services.sop_sync --limit 250       # default; St. George only
python -m app.services.sop_sync --targets-only    # just TARGET_GROUP_IDS -- fast path
python -m app.services.sop_sync --all             # whole catalog, ~40-60 min
python -m app.services.sop_sync --campus any      # drop the campus filter

# enrich clubs (Haiku) + push embeddings to Chroma -- build step 2
python -m app.services.enrichment_batch                  # default --limit 100
python -m app.services.enrichment_batch --limit 25       # pilot first -- check tag quality
python -m app.services.enrichment_batch --concurrency 6  # parallel Codex calls
python -m app.services.enrichment_batch --index-only     # re-embed only, no Codex calls
python -m app.services.enrichment_batch --force          # re-enrich first N clubs by name
python -m app.services.enrichment_batch --stale-tags     # re-enrich rows on an old FIXED_TAGS
python -m app.services.enrichment_batch --derive-outcomes # backfill empty outcomes from tags
```

Each service has a `_smoke_test()` on `__main__`. **They hit real APIs and write to the
database** — they are not unit tests.

```powershell
python -m app.services.dropbox_store      # Dropbox auth + all four OAuth scopes
python -m app.services.extraction         # file -> events JSON
python -m app.services.matcher            # fuzzy club-name matching
python -m app.services.ingest             # inbox -> Event rows, end to end
python -m app.services.dropbox_watcher    # watches /Inbox for 60s -- drop a poster and watch it land
```

## Architecture

Two ingestion pipelines write to the same tables — that's why `Club.source` /
`Event.source` (`sop` | `dropbox`) matters everywhere.

```mermaid
flowchart TB
    subgraph Sources
        S1[SOP Groups API] --> I1
        S2[SOP Events API] --> I1
        S3[Dropbox Inbox folder] --> I2
    end
    subgraph Ingest
        I1[sop_sync: fetch, dedupe, filter expired]
        I2[dropbox_watcher: poll, download]
        I3[enrichment (Haiku): summary, outcomes, tags]
        I4[extraction (Sonnet): file -> events JSON]
        I5[matcher: rapidfuzz name match]
        I6[embeddings: Voyage -> Chroma]
    end
    I1 --> I3 --> DB[(SQLite)]
    I3 --> I6 --> VDB[(ChromaDB)]
    I2 --> I4 --> I5 --> DB
    I5 --> I6
    subgraph API [FastAPI]
        A1[POST /recommend]
        A2[GET /clubs/:id]
        A3[GET /events]
    end
    A1 --> VDB
    A1 --> DB
    A2 --> DB
    A3 --> DB
```

## Data model (`backend/app/models.py`)

- `Club` — dedupe key is `sop_original_id` (from SOP's `_oasis_original` meta), not
  `sop_id`. `outcomes` are 1-3 values from the **fixed 8-item list**
  (`FIXED_OUTCOMES` in `models.py`) — never let the graph draw arbitrary outcome
  labels, that's what keeps the personal graph small and legible. `tags` are 3-8 values
  from `FIXED_TAGS` (~50 terms, same file) — see the tag-vocabulary constraint below.
- `Event` — `status` is `published` or `pending_review`; see the safety rule below.
- **Adding a column? Add it to `_COLUMN_MIGRATIONS` in `database.py` too.**
  `SQLModel.metadata.create_all()` creates missing tables but never alters an existing
  one, and `backend/data/campus_compass.db` is checked into git — so a teammate who
  pulls a model change gets the old table and `no such column` on the next query.
  `init_db()` applies those idempotent `ALTER TABLE`s at startup.
- `IngestLog` — keyed on `(dropbox_file_id, content_hash)` so the watcher never
  reprocesses the same file twice.

## Hard constraints (from real incidents in the spec, not style preferences)

- **Never display event-organizer emails.** SOP's event data includes students'
  personal emails; they must not reach the frontend or API responses. This covers the
  *event* path only — the organizer of an event did not publish their address as a
  public contact point.
- **Club contact emails ARE shown, on purpose.** `Club.links.email` is populated for
  242/250 synced clubs, and ~28 of those are individual students' addresses
  (`firstname.lastname@mail.utoronto.ca`) rather than role accounts. That's deliberate:
  SOP publishes them as the club's official contact, and "how do I reach this club" is
  the point of the product. Don't strip them to satisfy the rule above — it's a
  different data path. Decided 2026-09-19.
- **Auto-publish only if `title` + `start` are present AND confidence is high**
  (`app/services/extraction.py`); otherwise the event goes to `pending_review`.
  Wrong dates during the live demo are the single most likely failure mode — always
  pass the *current* date into the extraction prompt and never let the model guess an
  ambiguous year; push ambiguity into `uncertainties` instead.
- **Dedupe before enrichment**, not after — `copy-of-*` slugs are yearly re-listings,
  not new clubs. Collapse on `_oasis_original`, then fuzzy-match leftovers.
- **Thin descriptions get "limited info" summaries**, never invented detail. The
  enrichment prompt explicitly forbids inventing facts not in the source text. This is
  also why `commitment` is `unknown` for ~40% of clubs — the prompt forbids inferring
  it. Don't "fix" that by loosening the rule; let the Sonnet reranker judge intensity
  at query time, where it has the student's blurb for context.
- **Tags come from `FIXED_TAGS`, and a tag is a classification, not a claim.** That's
  the one place enrichment is allowed to be less literal than the source. Measured on a
  25-club pilot, free-form tags produced 148 unique tags across 177 assignments (14%
  reused, near-duplicates like `academic` / `academic inquiry` / `academic support`);
  the controlled enum gives 45 unique across 187 (71% reused). If you edit `FIXED_TAGS`,
  run `enrichment_batch --stale-tags` — `--force` re-runs the first N clubs *by name*
  and silently strands rows late in the alphabet.
- **`club_to_document()` embeds the summary AND the raw description**, not one or the
  other. Tags no longer carry club-specific words, so "k-pop", "poker" and "symphonic
  band" reach the vector only through the description. Dropping it on enriched clubs
  would strip out exactly the terms students search by.
- **The personal graph is always small** (~15-25 nodes: you, ~3 outcomes, 5-8 clubs,
  next events). Never render the full club graph (hairball of ~1,250 nodes).
- **Every club must carry at least one outcome**, or it has no edge in the
  you -> outcomes -> clubs graph and can never be drawn. Thin listings legitimately come
  back from Codex with none (14 of 250 did), so `_normalise_payload` falls back to
  `derive_outcomes_from_tags()` (`models.py`) and sets `Club.outcomes_derived`. The
  fallback never overrides outcomes the model actually assigned. Deriving from tags
  rather than `sop_interest_areas` is deliberate: 2 of those 14 had no SOP areas at all,
  but every club in the catalog has at least one tag.
- **SOP etiquette**: `sop_sync.py` runs as a one-off script with a real User-Agent and
  throttling — never call SOP's API from a per-request code path.
- **Filter campus by taxonomy *slug*, not `settings.sop_campus`.** `class_list` carries
  `campus-st-george`, which `_parse_taxonomy_tags()` title-cases to `"St George"` — no
  period — so comparing against `settings.sop_campus` (`"St. George"`) silently matches
  zero rows. Measured 2026-09-19: 1,309 groups total, 897 on St. George after dedupe.
- **Sample across interest areas, never the first N.** `select_diverse()` allocates each
  area its proportional share with a floor (`MIN_PER_AREA`). Plain round-robin looks
  fairer but starves `academic` — half the catalog, and the target of the demo's own
  example blurb; taking the first N instead just inherits alphabetical order.
- **Dropbox tokens**: use the refresh-token (offline access) flow
  (`DROPBOX_REFRESH_TOKEN` in `.env`), not a raw short-lived access token — it will
  expire mid-demo otherwise.

## Codex usage

- **Enrichment** (`app/services/enrichment.py`) — Haiku, tool-use/JSON schema
  (`ENRICHMENT_TOOL_SCHEMA`), one club at a time, bulk/async for the full run.
- **Extraction** (`app/services/extraction.py`) — Sonnet, vision for images / native
  PDF input, tool-use schema (`EXTRACTION_TOOL_SCHEMA`), always includes today's date
  and `America/Toronto` in the prompt.
- **Rerank + "why it fits"** (`app/routers/recommend.py`, not yet implemented) —
  Sonnet, given the blurb + ~20 vector-search candidates, returns 5-8 ranked clubs
  mapped to `FIXED_OUTCOMES` with a one-line rationale each.

No embeddings API from Anthropic — embeddings come from **Voyage AI**
(`voyage-4-lite`, 1024 dims, `VOYAGE_API_KEY`) via `app/services/embeddings.py`, stored
in ChromaDB (`backend/data/chroma/`, gitignored) under the `club_embeddings_voyage` /
`event_embeddings_voyage` collections. Voyage distinguishes *document* from *query*
embeddings and they are not interchangeable: index with `embed_documents()`, search a
student blurb with `embed_query()`. Changing the model or dimensions means re-indexing
every record — the existing collections can't be mixed with vectors from another model.

## Build order (see original spec's 24h timeline for the full version)

1. SOP sync + dedupe -> SQLite (`app/services/sop_sync.py`)
2. Enrichment (pilot ~100 clubs, then the rest) + embeddings to Chroma
3. `POST /recommend` — vector search, then Codex rerank + why
4. Dropbox watcher -> extraction -> matcher -> `Event` rows with provenance
5. Wire the frontend graph (`@xyflow/react`, already installed) to real
   `/recommend` output; club detail panel
6. Feature freeze, then polish (loading/empty/error states) and demo rehearsal

## Frontend notes

- Plain JavaScript/JSX, not TypeScript — no `.ts`/`.tsx`, no type-checking step.
- Tailwind v4 is wired via the `@tailwindcss/vite` plugin (`frontend/vite.config.js`) —
  no `tailwind.config.js`/PostCSS config needed; utility classes just work once
  `@import "tailwindcss";` is in `src/index.css`.
- `@xyflow/react` is installed for the personal graph view but not yet wired up
  (the spec allows swapping to `react-force-graph-2d` for a more Obsidian-like force
  layout if React Flow's layout gets messy — pick one early, don't build both).
- `src/lib/api.js` has the `recommend()` client; extend this file rather than
  hand-rolling fetch calls elsewhere.
