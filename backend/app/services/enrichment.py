"""Claude (Haiku) enrichment: raw club description -> summary, outcomes, tags, commitment.

Prompt shape (see project spec / CLAUDE.md):
  "Given this student club's name and description, return: a 2-sentence
   neutral summary, 1-3 outcomes from [fixed list], 5-8 lowercase tags,
   commitment level (or 'unknown'). Use ONLY the given text. If a field
   can't be determined, return null. Do not invent details."

Use tool use / JSON schema output so the response is structured, not
free text. Run a pilot batch (~100 clubs) before the full async run.
"""

from app.models import FIXED_OUTCOMES

ENRICHMENT_TOOL_SCHEMA = {
    "name": "enrich_club",
    "description": "Structured enrichment for a student club listing.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": ["string", "null"]},
            "outcomes": {
                "type": "array",
                "items": {"type": "string", "enum": FIXED_OUTCOMES},
                "maxItems": 3,
            },
            "tags": {"type": "array", "items": {"type": "string"}},
            "commitment": {
                "type": "string",
                "enum": ["casual", "moderate", "intense", "unknown"],
            },
        },
        "required": ["summary", "outcomes", "tags", "commitment"],
    },
}


def enrich_club(name: str, description: str) -> dict:
    """TODO: call Anthropic messages.create with ENRICHMENT_TOOL_SCHEMA and
    tool_choice forcing `enrich_club`, then return the tool_use input."""
    raise NotImplementedError
