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

## Candidate domains not yet investigated

From `scripts/candidate_domains.py` against the 250-club sample (164 have a
website link, 124 distinct domains):

| Clubs | Domain | Note |
|---|---|---|
| 15 | `sa.utoronto.ca` | Highest-value target. Student affairs club pages. |
| 5 | `skule.ca` | Engineering society. |
| 4 | `harthouse.ca` | Hart House programming. |
| 2 | `chass.utoronto.ca` | |

Skip: `linktr.ee` (11), `wordpress.com` (5), `carrd.co` (3), `wixsite.com` (2),
`google.com` (2). Link-in-bio and site-builder hosts — redirects and landing
pages, not event sources.

Excluded by policy: Instagram, Facebook and other social platforms (CLAUDE.md
lists Instagram scraping as roadmap only).
