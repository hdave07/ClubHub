"""Claude (Sonnet) file extraction: poster/PDF -> structured events + club updates.

Prompt shape (see project spec / CLAUDE.md):
  "Today is {date}, timezone America/Toronto. This file was dropped by a
   student club. Return: doc_type (poster | schedule | roster | other),
   club_name_guess, events[] (title, start, end, location, description,
   rsvp_url), club_updates (meeting_info, links), confidence (0-1),
   uncertainties[]. Only extract what is visibly stated. If the date or
   year is ambiguous, list it under uncertainties instead of guessing."

Safety rule: auto-publish (status="published") only if title + start are
present AND confidence is high; otherwise status="pending_review".
Wrong dates in a live demo are the #1 failure mode -- always pass today's
date and never let the model guess an ambiguous year.

Scope: this module turns bytes into structured data and nothing else. No
database writes, no club matching, no Dropbox. That keeps the safety rule a
pure function of the extracted fields, testable without a network call.
"""

import base64
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import anthropic

from app.config import settings

MODEL = "claude-sonnet-5"
CAMPUS_TZ = ZoneInfo("America/Toronto")

# Auto-publish threshold. Below this an event still gets written, but as
# pending_review, so it never reaches the live feed unreviewed.
CONFIDENCE_THRESHOLD = 0.8

EXTRACTION_TOOL_SCHEMA = {
    "name": "extract_club_file",
    "description": "Structured extraction from a club-dropped poster/PDF/doc.",
    "input_schema": {
        "type": "object",
        "properties": {
            "doc_type": {"type": "string", "enum": ["poster", "schedule", "roster", "other"]},
            "club_name_guess": {"type": ["string", "null"]},
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "start": {
                            "type": ["string", "null"],
                            "description": (
                                "Local Toronto wall-clock time as naive ISO 8601 "
                                "(2026-09-24T19:00:00). No UTC offset, no 'Z'. "
                                "Null if the date cannot be determined without guessing."
                            ),
                        },
                        "end": {
                            "type": ["string", "null"],
                            "description": "Same format as start. Null if not stated.",
                        },
                        "location": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]},
                        "rsvp_url": {"type": ["string", "null"]},
                    },
                    "required": ["title"],
                },
            },
            "club_updates": {
                "type": "object",
                "properties": {
                    "meeting_info": {"type": ["string", "null"]},
                    "links": {"type": "object"},
                },
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "uncertainties": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["doc_type", "events", "confidence", "uncertainties"],
    },
}


@dataclass(frozen=True)
class ExtractedEvent:
    """One event read off a document, with times already converted to UTC."""

    title: str
    start: datetime | None  # naive UTC
    end: datetime | None  # naive UTC
    location: str | None
    description: str | None
    rsvp_url: str | None
    status: str  # published | pending_review
    start_local: str | None = None  # what the model actually said, for debugging


@dataclass(frozen=True)
class Extraction:
    doc_type: str
    club_name_guess: str | None
    events: list[ExtractedEvent]
    club_updates: dict
    confidence: float
    uncertainties: list[str]
    raw: dict = field(repr=False)  # unmodified tool input


class ExtractionError(RuntimeError):
    """Claude returned something we can't use (refusal, truncation, no tool call)."""


_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    """The single Anthropic client.

    The key is passed explicitly rather than left to the SDK's env lookup: this
    project keeps config in .env loaded by pydantic-settings, which populates
    `settings` but never touches os.environ. A bare Anthropic() finds nothing.
    """
    global _client
    if _client is None:
        if not settings.anthropic_api_key:
            raise ExtractionError("ANTHROPIC_API_KEY is not set in backend/.env")
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def decide_status(title: str | None, start: datetime | None, confidence: float) -> str:
    """The safety rule, as a pure function.

    Auto-publish only when we have both a title and a resolved start time AND the
    model was confident. Everything else waits for a human. A wrong date on the
    live feed is the single most damaging failure mode, so the bar to reach it is
    deliberately explicit and in one place.
    """
    if title and start is not None and confidence >= CONFIDENCE_THRESHOLD:
        return "published"
    return "pending_review"


def to_utc(value: str | None) -> datetime | None:
    """Naive local Toronto ISO string -> naive UTC datetime.

    The prompt asks for wall-clock time with no offset, because a poster states
    wall-clock time and nothing else -- making the model also compute a UTC offset
    invites it to get DST wrong on top of everything else. It reports what it sees;
    this function does the arithmetic.

    Returns None rather than raising on garbage: one unparseable date shouldn't
    discard the other events on the same poster, and a None start means the safety
    rule routes that event to pending_review anyway.
    """
    if not value:
        return None
    try:
        local = datetime.fromisoformat(value.strip())
    except ValueError:
        return None

    if local.tzinfo is not None:
        # Model supplied an offset despite the instruction -- trust it rather than
        # double-applying a zone.
        return local.astimezone(timezone.utc).replace(tzinfo=None)

    return local.replace(tzinfo=CAMPUS_TZ).astimezone(timezone.utc).replace(tzinfo=None)


def _build_content_blocks(file_bytes: bytes, mime_type: str, prompt: str) -> list[dict]:
    """Wrap the file in the content block Claude expects for its type.

    Images and PDFs take different block shapes -- this is the only place that
    distinction exists. The mime_type comes from dropbox_store.mime_type_for(), so
    the allowlist and this branch can't drift apart.
    """
    data = base64.standard_b64encode(file_bytes).decode()

    if mime_type == "application/pdf":
        source_block = {
            "type": "document",
            "source": {"type": "base64", "media_type": mime_type, "data": data},
        }
    elif mime_type.startswith("image/"):
        source_block = {
            "type": "image",
            "source": {"type": "base64", "media_type": mime_type, "data": data},
        }
    else:
        raise ValueError(f"Unsupported mime type for extraction: {mime_type}")

    return [source_block, {"type": "text", "text": prompt}]


def _build_prompt(today: date) -> str:
    """Assembled per call, because interpolating today's date is the whole point.

    Without an anchor date the model has nothing to resolve "Thursday the 24th"
    against and will invent a year. The repeated instruction to push ambiguity into
    `uncertainties` is the other half: an event that admits it couldn't confirm the
    year is recoverable on stage, a confidently wrong one is not.
    """
    return f"""Today is {today:%A, %B %d, %Y}. The timezone is America/Toronto.

This file was shared by a student club at the University of Toronto. Extract any
events and club details it advertises.

Rules:
- Extract only what is visibly stated. Do not infer a location, an RSVP link, or a
  description that isn't there.
- Report times as local Toronto wall-clock time in naive ISO 8601
  (e.g. 2026-09-24T19:00:00). Do not add a UTC offset or convert the time yourself.
- If the poster does not print a year, infer it from today's date ONLY when the
  result is unambiguous. If there is any doubt, set `start` to null and describe the
  problem in `uncertainties`.
- Same for a missing time of day: if only a date is given, say so in `uncertainties`.
- `confidence` should reflect how legible and complete this document is: high for a
  clear poster stating an explicit date and time, low for a blurry photo, a partial
  schedule, or anything where you had to work to read it.
- If this isn't an event document at all (a roster, a logo, a random photo), set
  `doc_type` accordingly and return an empty `events` list.

Never guess a date to fill the field. An empty field is useful; a wrong date is not."""


def extract_file(
    file_bytes: bytes, mime_type: str, today: date | None = None
) -> Extraction:
    """Poster/PDF bytes -> structured events with UTC times and a publish decision.

    `today` is a parameter rather than being read inside so tests can pin it --
    "does this poster resolve to 2026 or 2027?" is only answerable deterministically
    if the test controls the anchor date.

    Synchronous by design, matching dropbox_store: service functions are sync,
    callers wrap them in asyncio.to_thread. This call takes several seconds, so
    running it directly on the event loop would stall every other request.
    """
    if today is None:
        today = datetime.now(CAMPUS_TZ).date()

    blocks = _build_content_blocks(file_bytes, mime_type, _build_prompt(today))

    response = get_client().messages.create(
        model=MODEL,
        max_tokens=4000,
        output_config={"effort": "medium"},
        tools=[EXTRACTION_TOOL_SCHEMA],
        tool_choice={
            "type": "tool",
            "name": EXTRACTION_TOOL_SCHEMA["name"],
            "disable_parallel_tool_use": True,
        },
        messages=[{"role": "user", "content": blocks}],
    )

    # Guards before touching content. A refusal returns HTTP 200 with no tool block,
    # and a max_tokens truncation is worse: the partial tool input can still look
    # like valid JSON, so it fails silently as "this poster had fewer events".
    if response.stop_reason == "refusal":
        detail = getattr(response.stop_details, "explanation", None)
        raise ExtractionError(f"Model declined to process this file: {detail}")
    if response.stop_reason == "max_tokens":
        raise ExtractionError("Response hit max_tokens; extraction may be truncated.")

    raw = next(
        (
            block.input
            for block in response.content
            if block.type == "tool_use" and block.name == EXTRACTION_TOOL_SCHEMA["name"]
        ),
        None,
    )
    if raw is None:
        raise ExtractionError(f"No tool_use block in response (stop_reason={response.stop_reason})")

    confidence = float(raw.get("confidence") or 0.0)

    events = []
    for item in raw.get("events") or []:
        title = item.get("title")
        if not title:
            continue  # title is required by the schema; skip rather than write a blank row
        start = to_utc(item.get("start"))
        events.append(
            ExtractedEvent(
                title=title,
                start=start,
                end=to_utc(item.get("end")),
                location=item.get("location"),
                description=item.get("description"),
                rsvp_url=item.get("rsvp_url"),
                status=decide_status(title, start, confidence),
                start_local=item.get("start"),
            )
        )

    return Extraction(
        doc_type=raw.get("doc_type") or "other",
        club_name_guess=raw.get("club_name_guess"),
        events=events,
        club_updates=raw.get("club_updates") or {},
        confidence=confidence,
        uncertainties=raw.get("uncertainties") or [],
        raw=raw,
    )


def _smoke_test() -> None:
    """Extract the real posters sitting in Dropbox and show the timezone conversion.

    Uses real files rather than a fixture because they exercise the image AND document
    content-block paths, and because they are the actual demo data -- a fixture would
    prove the code runs, this proves the demo works.

    Makes one real Claude API call per file.
    """
    from app.services.dropbox_store import download_file, list_inbox, mime_type_for

    files = list_inbox()
    if not files:
        print("No supported files in the Dropbox inbox -- nothing to extract.")
        return

    print(f"Extracting {len(files)} file(s) with {MODEL}\n")

    for f in files:
        print("=" * 72)
        print(f.name)
        print("=" * 72)
        try:
            result = extract_file(download_file(f.path), mime_type_for(f.name))
        except ExtractionError as e:
            print(f"  EXTRACTION FAILED: {e}\n")
            continue

        print(f"  doc_type   {result.doc_type}")
        print(f"  club       {result.club_name_guess}")
        print(f"  confidence {result.confidence}")

        if not result.events:
            print("  events     (none)")
        for e in result.events:
            print(f"\n  - {e.title}")
            # Local and UTC side by side: a timezone bug is invisible when you only
            # see one of them. September in Toronto is UTC-4, so expect local + 4h.
            print(f"      local  {e.start_local}")
            print(f"      utc    {e.start}")
            print(f"      where  {e.location}")
            print(f"      status {e.status}")

        if result.uncertainties:
            print("\n  uncertainties:")
            for u in result.uncertainties:
                print(f"      - {u}")
        print()


if __name__ == "__main__":
    _smoke_test()
