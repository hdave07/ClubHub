---
name: scraping-club-events
description: Discovers the JSON fetch endpoints behind club and campus event listings using Playwright network inspection, then generates a Python adapter that writes future-dated Event rows. Use when adding a new event data source, scraping a club website or campus events directory, or investigating what API a listing page calls.
---

# Scraping Club Events

Find the request a listing page makes for its own data, then wrap it in an adapter.

Almost every event listing renders from a JSON endpoint its JavaScript calls. That
endpoint is the source worth having: stated start times, stable ids, no HTML
parsing, no language model. Parsing the rendered page is the fallback, not the
plan.

## Scope

**In:** campus event calendars, club-owned sites, department and college
newsletters, faculty listings.

**Out:** Instagram, Facebook, and other social platforms. CLAUDE.md lists
Instagram scraping as roadmap only. `scripts/candidate_domains.py` already
excludes them, so do not add them back.

## Workflow

Copy this checklist and work through it in order:

```
- [ ] Phase 1: Pick a target by club coverage
- [ ] Phase 2: Find the fetch endpoint in the network tab
- [ ] Phase 3: Confirm the contract (pagination, date filter, club field)
- [ ] Phase 4: Write the adapter
- [ ] Phase 5: Validate, then run
```

### Phase 1: Pick a target

```bash
cd backend
python ../.cursor/skills/scraping-club-events/scripts/candidate_domains.py --min-clubs 2
```

Ranks the domains in `Club.links` by how many clubs share them. Work down that
list. One adapter for a platform hosting 15 clubs is worth more than 15 bespoke
scrapers, and a campus-wide calendar beats both.

Link-in-bio and site-builder domains (`linktr.ee`, `carrd.co`, `wixsite.com`)
rank high but are not event sources — they are redirects to other pages. Skip
them.

### Phase 2: Find the fetch endpoint

Use the Playwright tools. Read [reference.md](reference.md) for the platform
fingerprints worth trying before you look at all, and the heuristics for spotting
the real data call.

1. `browser_navigate` to the events page.
2. Make it load the data: scroll, click through to "Events", change the month.
   A calendar usually fetches on navigation, so changing month is the single most
   reliable trigger.
3. `browser_network_requests` and look for JSON responses.
4. `browser_network_request` on the candidate URL to confirm it returns the same
   data standalone — without cookies, without a referer.

**An endpoint that only works in the browser is not usable.** If it needs a
session or a CSRF token, stop and note that in the registry rather than trying to
reproduce the handshake.

### Phase 3: Confirm the contract

Before writing code, establish four things and record them in
[REGISTRY.md](../../../backend/app/services/event_sources/REGISTRY.md):

| Question | Why it matters |
|---|---|
| How does pagination work? | `page`/`per_page`, a cursor, or a `next` URL. Never loop unbounded. |
| Is there a start-date parameter? | Without one you transfer the whole archive to throw most of it away. |
| Which field carries the club name? | No club means no graph edge. An event that can't be attributed is not usable. |
| Does it state a time of day, or only a date? | Date-only events must not publish with a fabricated midnight start. |

### Phase 4: Write the adapter

Create `backend/app/services/event_sources/<slug>.py` exposing exactly two names:

```python
SOURCE_NAME: str
def fetch(*, limit: int | None = None) -> list[ScrapedEvent]
```

Read [adapter-contract.md](adapter-contract.md) for the field-by-field contract.
`sop_events.py` is a complete worked example against a real API.

The adapter fetches and maps. It does not open a database session, decide what
publishes, or filter by date — `runner.py` does all of that for every source, so
the safety rules cannot be forgotten one adapter at a time.

Rules that are not negotiable:

- **Use `base.to_utc()` for every date.** Never `datetime.fromisoformat` straight
  into `start`. A tz-aware or local value stores fine and displays four hours off.
- **Never map an organizer's email or phone.** Read the organizer's *name* only.
  CLAUDE.md forbids event-organizer contacts reaching the frontend, and these
  payloads routinely carry students' personal addresses.
- **Set `all_day=True` when the source gives only a date.** The publish gate needs
  it; `start` alone cannot distinguish midnight-because-unknown from a real 00:00.
- **Supply `external_id` or `source_url`.** That is the dedupe key. Without one,
  every run re-examines every record.
- **Decode HTML entities** on anything a human reads or the matcher compares.
  `&amp;` left in a club name becomes the token `amp` and skews the fuzzy match.
- **Throttle** about 0.5-1s between pages, send a real User-Agent, and cap your
  page loop. These run as one-off scripts, never from a request handler.

### Phase 5: Validate, then run

```bash
cd backend
python ../.cursor/skills/scraping-club-events/scripts/validate_adapter.py <slug>
```

Read-only against the live source. Every check maps to a rule that fails
silently and plausibly when broken, so **do not proceed while anything says
FAIL.** Fix and re-run until it passes.

Then write rows:

```bash
python -m app.services.event_sources.runner <slug> --dry-run   # stages, rolls back
python -m app.services.event_sources.runner <slug>             # commits
```

Run it twice. The second run should report everything as already seen — if it
writes the same events again, the dedupe key is missing or unstable.

Finally, check attribution. `clubs created` in the output means a club name did
not match anything in the database. A couple is normal (clubs outside the synced
sample). A lot means the club-name field is wrong. **Read the list** — see the
attribution hazard in [reference.md](reference.md), because a confident wrong
match is the failure mode nobody notices.

## Files

- [reference.md](reference.md) — network-tab technique, platform fingerprints, known hazards
- [adapter-contract.md](adapter-contract.md) — `ScrapedEvent` field reference and a worked example
- `scripts/candidate_domains.py` — phase 1 target ranking
- `scripts/validate_adapter.py` — phase 5 gate
