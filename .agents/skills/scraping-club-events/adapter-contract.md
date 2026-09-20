# Adapter contract

An adapter is a module in `backend/app/services/event_sources/` exposing two
names and nothing else:

```python
SOURCE_NAME: str                                        # stable slug, lands in Event.source
def fetch(*, limit: int | None = None) -> list[ScrapedEvent]
```

It fetches and maps. It does not open a session, write rows, filter by date, or
decide what publishes — `runner.py` does that for every source at once, so the
safety rules cannot be skipped one adapter at a time. An adapter that imports
`Session` is doing something wrong.

## ScrapedEvent

Defined in `base.py`.

| Field | Type | Notes |
|---|---|---|
| `title` | `str` | Required. Entity-decoded. |
| `club_name_guess` | `str` | Required. The name `matcher` resolves to a `Club`. |
| `start` | `datetime \| None` | **Naive UTC.** Use `to_utc()`. `None` is allowed and routes to review. |
| `end` | `datetime \| None` | Same rules as `start`. |
| `location` | `str \| None` | Free text. |
| `description` | `str \| None` | Plain text, HTML stripped. |
| `rsvp_url` | `str \| None` | Registration or detail link. |
| `confidence` | `float` | `1.0` for a stated time from structured data; lower when inferred. |
| `source_url` | `str \| None` | Page a human can open to verify. Becomes `Event.source_file`. |
| `external_id` | `str \| None` | Upstream record id. Dedupe key, preferred over `source_url`. |
| `all_day` | `bool` | `True` when the source gives only a date. |
| `is_reschedule` | `bool` | `True` only when the source says this replaces an earlier date. |
| `raw` | `dict \| None` | Upstream record, for debugging. Never persisted. |

### The four that cause silent damage

**`start` must be naive UTC.** `to_utc()` handles both a naive local wall-clock
string and an offset-aware one, and gets DST right. Parsing dates yourself is how
every event ends up four hours off — a bug that stores cleanly and only shows up
when someone reads the time. The validator fails on any tz-aware `start`.

**`all_day` must be explicit.** A local midnight in UTC is 04:00 or 05:00, so
`start` alone cannot distinguish "the source only gave a date" from "this really
starts at 4am". Without the flag a date-only event publishes with a start time
nobody stated.

**`confidence` feeds the publish gate.** It is the same gate `extraction.py` uses,
so a value below `0.8` sends the event to `pending_review` instead of the live
feed. A JSON API that states a start time is `1.0`. Anything a language model
inferred from prose should be lower — that is the mechanism for keeping guessed
dates off the feed, not a formality.

**`external_id` or `source_url` is the dedupe key.** With neither, `IngestLog`
cannot suppress a repeat and every run re-examines every record.

### Never map organizer contacts

CLAUDE.md: event-organizer emails must never reach the frontend or an API
response. These payloads carry students' personal addresses. Read the organizer's
**name** — that is the club — and never the `email` or `phone` beside it.

The runner scrubs text as a backstop and the validator fails on a leak, but the
fix is to not read the field.

## Worked example

`sop_events.py` in full is the reference. The shape:

```python
from app.services.event_sources.base import CAMPUS_TZ, ScrapedEvent

SOURCE_NAME = "sop"

def to_scraped_event(record: dict) -> ScrapedEvent | None:
    title = _clean_text(record.get("title"))
    club = _club_name(record)            # organizer NAME only
    if not title or not club:
        return None                      # no club means no graph edge

    return ScrapedEvent(
        title=title,
        club_name_guess=club,
        start=_parse_utc(record.get("utc_start_date")),   # already UTC
        end=_parse_utc(record.get("utc_end_date")),
        location=_venue(record),
        description=_strip_html(record.get("description")),
        rsvp_url=record.get("website") or record.get("url"),
        confidence=1.0,                  # the API states the time outright
        source_url=record.get("url"),
        external_id=str(record["id"]),
        all_day=bool(record.get("all_day")),
        raw=record,
    )

def fetch(*, limit: int | None = None) -> list[ScrapedEvent]:
    today = datetime.now(CAMPUS_TZ).date()
    params = {"per_page": 50, "start_date": today.isoformat()}
    # page with a cap, throttle between pages, respect `limit`
```

Returning `None` for an unusable record and filtering it out is the pattern: one
bad record should never abort the other 49 on the page.

## Checklist before validating

```
- [ ] SOURCE_NAME set, module named the same as the slug
- [ ] fetch() honours `limit` (the validator relies on it)
- [ ] Every date goes through to_utc() or is already UTC
- [ ] all_day set for date-only events
- [ ] external_id or source_url on every event
- [ ] No organizer email or phone read anywhere
- [ ] HTML entities decoded; descriptions HTML-stripped
- [ ] Page loop capped, 0.5-1s throttle, real User-Agent
- [ ] _smoke_test() under __main__ printing what it parsed
```

Then:

```bash
cd backend
python ../.cursor/skills/scraping-club-events/scripts/validate_adapter.py <slug>
python -m app.services.event_sources.runner <slug> --dry-run
```
