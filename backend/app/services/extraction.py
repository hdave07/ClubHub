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
"""

from datetime import date

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
                        "start": {"type": ["string", "null"]},
                        "end": {"type": ["string", "null"]},
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


def extract_file(file_bytes: bytes, mime_type: str, today: date) -> dict:
    """TODO: send file_bytes as an image/PDF content block to Claude (Sonnet)
    with EXTRACTION_TOOL_SCHEMA, `today` in the prompt, tz=America/Toronto."""
    raise NotImplementedError
