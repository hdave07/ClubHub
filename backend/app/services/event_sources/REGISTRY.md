# Event source registry

What each source's data endpoint is and how it behaves. Written during phase 3 of
the `scraping-club-events` skill, before any adapter code exists — so a source
that turns out to be unusable is recorded once instead of re-investigated.

Add an entry per source, including the ones that failed.

---

## sop — SOP event calendar

- **Status:** live, adapter `sop_events.py`
- **Platform:** The Events Calendar (WordPress plugin)
- **Endpoint:** `https://sop.utoronto.ca/wp-json/tribe/events/v1/events`
- **Auth:** none
- **Params:** `per_page` (50), `start_date` (ISO date, filters server-side),
  `status=publish`
- **Pagination:** `next_rest_url` in the response body; absent on the last page.
  The plugin 404s past the end rather than returning an empty list.
- **Club name:** `organizer[].organizer`. Falls back to `categories[].name`.
- **Times:** `utc_start_date` / `utc_end_date` are already UTC. `start_date` is
  local Toronto. `all_day` flag present.
- **Dedupe key:** numeric `id`.
- **HTTP client:** `urllib.request`. SOP's WAF 403s `httpx` specifically (TLS
  fingerprinting) — see the note atop `sop_sync.py`.

**Contact hazard:** `organizer[]` objects also carry `email` and `phone`, often a
student's personal address. Read `organizer` (the name) only.

**Measured 2026-09-19:** 8 future events campus-wide, all with stated start times,
all publishable. Includes UTM and UTSC events — the endpoint has no campus
parameter, and events from clubs outside the synced St. George sample create
placeholder `Club` rows.

---

## sa.utoronto.ca — investigated, not usable as one adapter

- **Status:** rejected at phase 2. Not a single platform: `sa.utoronto.ca` is a
  per-club subdomain host (`<slug>.sa.utoronto.ca`), each one its own
  independent WordPress install (`Book & Media Studies` ->
  `bookandmedia.sa.utoronto.ca`, `Chemistry Students' Union` ->
  `csu.sa.utoronto.ca`, etc.) — the 15-club count in the ranking is 15 separate
  sites sharing a hosting domain, not one calendar with 15 clubs on it.
- **Checked 6 of the 15 subdomains** (`bookandmedia`, `csu`, `classu`, `ecegss`,
  `mmg`, `csbsu`): every one returns a working `/wp-json/` (confirmed
  WordPress, no WAF issue — `httpx`/`curl` both work fine, unlike SOP), but
  **none registers an event post type or an events REST namespace.**
  `/wp-json/wp/v2/types` on all six is just `post`/`page`/`attachment` plus
  editor plumbing (`wp_block`, `wp_template`, …) — no `event`, `tribe_events`,
  or `ai1ec_event`. `ecegss.sa.utoronto.ca` has a plugin literally named
  "events-calendar" (visible in its enqueued CSS path) but it registers no REST
  route at all (`/wp-json/` lists only `akismet`, `monsterinsights`, `oembed`,
  `wordfence`, `wp-site-health`, `wp/v2` — no events namespace); it's a
  front-end-only rendering plugin, no API. `csu.sa.utoronto.ca` links to an
  `/upcoming-events/` page but nothing backs it with structured data. No site
  checked embeds JSON-LD `Event` schema either.
- **Why this stops here, per the skill:** the entire value of one adapter is
  covering many clubs from one endpoint. Here there is no endpoint, structured
  or otherwise, on any subdomain checked — the only way to get events off these
  sites would be a bespoke HTML scraper *per subdomain*, which is the "15
  bespoke scrapers" case the skill explicitly says one adapter is supposed to
  beat. Not worth it for a hackathon demo. If someone wants to revisit this,
  check the remaining 9 subdomains first in case one runs an actual calendar
  plugin with a REST route (the 6 checked were not selected for any reason
  other than being first alphabetically in the DB dump) — but don't assume a
  hit on one subdomain generalizes to the rest, since each is a separately
  administered WordPress site.

---

## Candidate domains not yet investigated

From `scripts/candidate_domains.py` against the 250-club sample (164 have a
website link, 124 distinct domains):

| Clubs | Domain | Note |
|---|---|---|
| 5 | `skule.ca` | Engineering society. |
| 4 | `harthouse.ca` | Hart House programming. |
| 2 | `chass.utoronto.ca` | |

Skip: `linktr.ee` (11), `wordpress.com` (5), `carrd.co` (3), `wixsite.com` (2),
`google.com` (2). Link-in-bio and site-builder hosts — redirects and landing
pages, not event sources.

Excluded by policy: Instagram, Facebook and other social platforms (CLAUDE.md
lists Instagram scraping as roadmap only).
