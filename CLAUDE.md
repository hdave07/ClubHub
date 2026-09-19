# CLAUDE.md

Guidance for Claude Code (and future contributors) working in this repo.

## What this is

**Campus Compass** — a hackathon (24h) "StudentOS for Clubs" project. Full original
brainstorming spec lives at [`central-hub-for-clubs.md`](./central-hub-for-clubs.md);
this file is the condensed, code-facing version. Two things it does:

1. **Match**: student types a free-text blurb ("first-year CS, want internships and
   friends, not too intense") -> 5-8 ranked clubs with a "why this fits you" line,
   rendered as a small personal graph (you -> outcomes -> clubs -> next events).
2. **Dropbox drop-to-update**: a club drops a poster/PDF into a shared Dropbox folder;
   Claude extracts event details; it appears in the app live with a "from Dropbox"
   badge and a provenance link back to the source file.

The demo is **three flows working flawlessly** (SOP sync, match, Dropbox
drop-to-update). Everything else — auth, notifications, Instagram scraping, multi-campus
— is roadmap only. Don't build it.

## Repo layout

```
frontend/   React + Vite + JavaScript (JSX), Tailwind v4 (via @tailwindcss/vite), @xyflow/react
backend/    FastAPI + SQLModel (SQLite) + ChromaDB + Anthropic SDK + Dropbox SDK
```

Current state: **boilerplate**. Models, routers, and service modules exist with
docstring TODOs describing exactly what to implement — see "Build order" below.

## Commands

```bash
# backend (macOS/Linux; .venv\Scripts\activate on Windows)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# verify Dropbox auth + all four OAuth scopes (writes/deletes one temp file in /Inbox)
cd backend && python -m app.services.dropbox_store

# frontend (proxies /api -> localhost:8000, see frontend/vite.config.js)
cd frontend && npm run dev

# one-time SOP sync (writes to SQLite + Chroma, do NOT call from a request handler)
cd backend && python -m app.services.sop_sync
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
        I6[embeddings: sentence-transformers -> Chroma]
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
  labels, that's what keeps the personal graph small and legible.
- `Event` — `status` is `published` or `pending_review`; see the safety rule below.
- `IngestLog` — keyed on `(dropbox_file_id, content_hash)` so the watcher never
  reprocesses the same file twice.

## Hard constraints (from real incidents in the spec, not style preferences)

- **Never display event-organizer emails.** SOP's event data includes students'
  personal emails; they must not reach the frontend or API responses.
- **Auto-publish only if `title` + `start` are present AND confidence is high**
  (`app/services/extraction.py`); otherwise the event goes to `pending_review`.
  Wrong dates during the live demo are the single most likely failure mode — always
  pass the *current* date into the extraction prompt and never let the model guess an
  ambiguous year; push ambiguity into `uncertainties` instead.
- **Dedupe before enrichment**, not after — `copy-of-*` slugs are yearly re-listings,
  not new clubs. Collapse on `_oasis_original`, then fuzzy-match leftovers.
- **Thin descriptions get "limited info" summaries**, never invented detail. The
  enrichment prompt explicitly forbids inventing facts not in the source text.
- **The personal graph is always small** (~15-25 nodes: you, ~3 outcomes, 5-8 clubs,
  next events). Never render the full club graph (hairball of ~1,250 nodes).
- **SOP etiquette**: `sop_sync.py` runs as a one-off script with a real User-Agent and
  throttling — never call SOP's API from a per-request code path.
- **Dropbox tokens**: use the refresh-token (offline access) flow
  (`DROPBOX_REFRESH_TOKEN` in `.env`), not a raw short-lived access token — it will
  expire mid-demo otherwise.

## Claude usage

- **Enrichment** (`app/services/enrichment.py`) — Haiku, tool-use/JSON schema
  (`ENRICHMENT_TOOL_SCHEMA`), one club at a time, bulk/async for the full run.
- **Extraction** (`app/services/extraction.py`) — Sonnet, vision for images / native
  PDF input, tool-use schema (`EXTRACTION_TOOL_SCHEMA`), always includes today's date
  and `America/Toronto` in the prompt.
- **Rerank + "why it fits"** (`app/routers/recommend.py`, not yet implemented) —
  Sonnet, given the blurb + ~20 vector-search candidates, returns 5-8 ranked clubs
  mapped to `FIXED_OUTCOMES` with a one-line rationale each.

No embeddings API from Anthropic — embeddings are local
(`sentence-transformers/all-MiniLM-L6-v2`) via `app/services/embeddings.py`, stored in
ChromaDB (`backend/data/chroma/`, gitignored).

## Build order (see original spec's 24h timeline for the full version)

1. SOP sync + dedupe -> SQLite (`app/services/sop_sync.py`)
2. Enrichment (pilot ~100 clubs, then the rest) + embeddings to Chroma
3. `POST /recommend` — vector search, then Claude rerank + why
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
