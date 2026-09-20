# Reference: finding and trusting an event endpoint

## Reading the network tab through Playwright

There is no devtools panel to open. `browser_network_requests` returns every
request the page has made since navigation, which is the same information.

```
browser_navigate      -> the events page
browser_click / browser_press_key / scroll  -> make it fetch
browser_network_requests   -> list everything
browser_network_request    -> replay one URL and read the body
```

Getting the page to fetch is the part that needs thought. A server-rendered
listing makes no XHR at all on load — its data came down inside the HTML. What
reliably triggers a fetch:

- **Changing the month** on a calendar. The single best trigger: almost every
  calendar widget loads a month at a time.
- **Paginating** or clicking "load more".
- **Filtering** by category or club.
- **Opening one event's detail view**, if it appears without a full page load.

### Telling the data call from the noise

A page makes dozens of requests. The one you want usually has all of:

- `Content-Type: application/json` — ignore images, fonts, CSS, analytics beacons.
- A response whose field names match what you can see rendered. Search the body
  for an event title visible on the page; that is the fastest confirmation.
- A path that reads like data rather than a page: `/api/`, `/wp-json/`,
  `/_next/data/`, `.json`, `/graphql`.
- Query parameters you recognise as a query: `page`, `per_page`, `limit`,
  `offset`, `start_date`, `after`, `cursor`.

Discard: analytics (`google-analytics`, `segment`, `hotjar`, `doubleclick`),
session pings, and anything returning HTML fragments.

### Confirm it standalone before writing code

Replay the URL with `browser_network_request`, then — critically — check it works
without the browser's context. An endpoint that needs a cookie, a CSRF token, or
a `Referer` is not usable from a script. Note that in the registry and move on
rather than trying to reproduce the handshake.

`curl`/`httpx` succeeding where the browser was needed is the goal; the reverse
means stop.

## Platform fingerprints

Guessing the URL beats reconnaissance when the guess is this cheap. Try these
before opening a browser.

### The Events Calendar (WordPress plugin)

```
/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-09-19&status=publish
```

The best case, and what SOP runs. Supports server-side `start_date`, paginates
via `next_rest_url`, and returns `utc_start_date` already resolved to UTC. Also
carries `all_day`, a stable numeric `id`, and an `organizer` array whose
`organizer` field is the club name.

**Its `organizer` objects also contain `email` and `phone`.** Read the name only.

Worked example: `backend/app/services/event_sources/sop_events.py`.

### WordPress REST API

```
/wp-json/wp/v2/<post_type>?per_page=100&page=2
```

Common post types for events: `event`, `events`, `tribe_events`, `ai1ec_event`.
`/wp-json/wp/v2/types` lists what exists. Taxonomy slugs often ride along in
`class_list` rather than needing separate term lookups — `sop_sync.py`'s
`_parse_taxonomy_tags()` is the pattern.

Two gotchas: `content.rendered` is HTML, and some hosts strip the `X-WP-Total`
header so you must page until a short or empty batch.

### ICS / iCalendar feeds

```
/events.ics   /?ical=1   /events/?post_type=tribe_events&ical=1
```

Underrated. A `.ics` feed is a complete structured export with `DTSTART`,
`DTEND`, `SUMMARY`, `LOCATION`, `UID` — `UID` is a ready-made `external_id`.
Watch for `VTIMEZONE`: `DTSTART;VALUE=DATE` means all-day (set `all_day=True`),
while a trailing `Z` is already UTC.

### JSON-LD embedded in HTML

```html
<script type="application/ld+json">{"@type": "Event", ...}</script>
```

No endpoint needed — parse it out of the page. `startDate`, `endDate`, `name`,
`location`, `organizer` in a documented schema. Sites with SEO plugins emit this
even when they have no API, so it is the best fallback before resorting to CSS
selectors. Note `startDate` is usually ISO 8601 *with* an offset.

### Modern JS frameworks

Next.js exposes `/_next/data/<buildId>/<path>.json`, but `buildId` changes on
every deploy, so prefer `__NEXT_DATA__` parsed from the HTML. GraphQL endpoints
(`/graphql`) need the exact query — copy the request body verbatim from the
network tab; do not try to compose your own.

## Etiquette

Matches what `sop_sync.py` already does, and it is not optional — this is a
public university service.

- Real User-Agent (`settings.sop_user_agent`), never a spoofed browser string.
- 0.5-1s between requests. Discovery calls are cheap; per-record detail fetches
  are what hurts.
- Cap the page loop (`MAX_PAGES`). A cursor that loops is otherwise infinite.
- One-off scripts only, never a per-request code path. Cache to SQLite.
- `urllib.request` if a host 403s `httpx`. SOP's WAF fingerprints the httpx TLS
  handshake specifically — same URL, same headers, different client, different
  answer. This is documented at the top of `sop_sync.py` and cost real debugging
  time.

## Known hazards

### Attribution: a wrong club match is silent

`matcher.py` deliberately sets a high bar and creates a placeholder club rather
than guessing, because "a miss is visible and recoverable; a confident wrong
attachment files a hiking trip under the Poker Club and nobody ever notices."
Two blind spots survive that, and a scraped source hits them far more often than
a hand-dropped poster does — it supplies hundreds of names instead of one.

**Token-subset names score 100.** `fuzz.token_set_ratio` returns a perfect score
when one normalized name is a strict token subset of the other, so a short name
inside a longer one always clears the threshold:

```
"Anthropology Students' Association" -> norm "anthropology"
"Anthropology Graduate Student Union" -> norm "anthropology graduate union"
token_set_ratio = 100   # different clubs, perfect score
```

**Derived acronyms collide.** `acronyms()` builds an initialism from the
distinctive words and an acronym hit is treated as decisive. That reasoning holds
for a parenthesised acronym a poster actually printed ("UTMIST"); it does not
hold for three letters the code invented:

```
"Afro-Dance and Culture Club"  -> derived "adc"
"Averroes Discourse Society ..." -> derived "adc"
acronym match = 100, checked before any fuzzy comparison
```

So: **read the `clubs created` list and spot-check attribution after a run.** Do
not assume a match is right because the runner reported no errors. Verify with:

```bash
python -c "from app.services.matcher import match_club, normalize; ..."
```

### Timezones

`start` must be **naive UTC**. `base.to_utc()` handles both shapes a source
returns — a naive local wall-clock string and an offset-aware one. A tz-aware
datetime stores without complaint and displays four or five hours off, which no
amount of looking at the feed will reveal. The validator fails on this.

### HTML entities

`&amp;`, `&#8211;`, `&#039;` appear in plain-text fields, not just HTML ones.
Beyond looking broken, an entity in a club name reaches the matcher as the token
`amp` and drags the fuzzy score off the real club. `html.unescape()` on anything
a human reads or the matcher compares.

### Date-only events

A local midnight converted to UTC becomes 04:00 or 05:00, so `start` alone cannot
tell a date-only event from an early-morning one. Set `all_day=True` explicitly.
Otherwise the event publishes with a start time nobody stated.

### Recurring events

A weekly meetup may arrive as one record with a recurrence rule, or as N records
sharing a title. If the source collapses them, expand to one `ScrapedEvent` per
occurrence with distinct `external_id`s — otherwise only the next occurrence ever
shows, and the dedupe log suppresses the rest.
