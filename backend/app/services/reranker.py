"""Claude (Sonnet) rerank: a student's blurb + candidate clubs -> a ranked shortlist.

Vector search gets us the ~20 clubs whose descriptions sit nearest the blurb.
That is a similarity score, not a recommendation: it has no view on whether a
first-year should join an intense competition team, and it cannot write the
one-line reason that makes a match legible to the student. This module is that
second pass.

Two things it deliberately does NOT do:

  - Re-derive each club's outcomes. Those come from enrichment and live on the
    Club row; asking the model to invent them again per request would make the
    same club hang off different outcomes on different searches, and the graph
    would shift under the student between reloads.
  - Invent clubs. It is handed candidate ids and may only return those; anything
    else is dropped (see rank_clubs).

The `outcomes` it does return describe the *student* -- what the blurb is asking
for -- and become the middle layer of the personal graph.
"""

from __future__ import annotations

from dataclasses import dataclass

import anthropic

from app.config import settings
from app.models import FIXED_OUTCOMES, Club

MODEL = "claude-sonnet-5"

# The spec's graph budget: ~15-25 nodes total, so 5-8 clubs and ~3 outcomes.
MIN_CLUBS = 5
MAX_CLUBS = 8
MAX_OUTCOMES = 4


class RerankError(RuntimeError):
    """Claude returned nothing usable (refusal, truncation, or no tool call)."""


RERANK_TOOL_SCHEMA = {
    "name": "rank_clubs",
    "description": "Rank the candidate clubs for this student and say why each fits.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "outcomes": {
                "type": "array",
                "items": {"type": "string", "enum": FIXED_OUTCOMES},
                "description": (
                    "What THIS STUDENT is looking for, 1-3 items, most important "
                    "first. Not a summary of the clubs -- a reading of the blurb."
                ),
            },
            "clubs": {
                "type": "array",
                "description": (
                    f"Best {MIN_CLUBS}-{MAX_CLUBS} candidates, best first. Use only "
                    "the ids given. Drop candidates that genuinely do not fit "
                    "rather than padding the list."
                ),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {"type": "string", "description": "Candidate club id."},
                        "why_it_fits": {
                            "type": "string",
                            "description": (
                                "One sentence, max ~20 words, addressed to the "
                                "student as 'you'. Tie something concrete in the "
                                "club's description to something they actually "
                                "asked for. No hype, no invented facts."
                            ),
                        },
                    },
                    "required": ["id", "why_it_fits"],
                },
            },
        },
        "required": ["outcomes", "clubs"],
    },
}


@dataclass(frozen=True)
class RankedClub:
    club: Club
    why_it_fits: str


@dataclass(frozen=True)
class Ranking:
    outcomes: list[str]
    clubs: list[RankedClub]


_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    """The key is passed explicitly: pydantic-settings loads .env into `settings`
    but never into os.environ, so a bare Anthropic() finds nothing."""
    global _client
    if _client is None:
        if not settings.anthropic_api_key:
            raise RerankError("ANTHROPIC_API_KEY is not set in backend/.env")
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def _candidate_block(club: Club) -> str:
    """One club, as the model sees it.

    Uses the enriched summary rather than description_raw: the raw SOP field is
    unbounded HTML-stripped marketing copy, and 20 of them would both blow up the
    prompt and bias ranking toward whoever wrote the most words.
    """
    lines = [f"id: {club.id}", f"name: {club.name}"]
    if club.summary:
        lines.append(f"summary: {club.summary}")
    if club.outcomes:
        lines.append(f"outcomes: {', '.join(club.outcomes)}")
    if club.tags:
        lines.append(f"tags: {', '.join(club.tags)}")
    if club.commitment:
        lines.append(f"commitment: {club.commitment}")
    return "\n".join(lines)


def _build_prompt(blurb: str, candidates: list[Club]) -> str:
    blocks = "\n\n".join(_candidate_block(c) for c in candidates)
    return f"""A student at the University of Toronto described what they want out of
university. Below are candidate clubs retrieved by semantic search -- similarity
only, so some will not actually fit.

STUDENT:
{blurb}

CANDIDATES:
{blocks}

Pick the {MIN_CLUBS}-{MAX_CLUBS} that genuinely fit and rank them best first.

- Use only the ids above. Never invent a club.
- Take the student's constraints seriously. "Not too intense" should push an
  intense competition team down, even if the topic matches well.
- Each why_it_fits must point at something real in that club's text and
  something the student actually said. If the only honest thing you can say is
  generic, that club probably does not belong on the list.
- Say nothing the candidate text does not support -- several of these listings
  are thin, and a confident sentence about a club we know little about is worse
  than leaving it out.
- Return fewer than {MIN_CLUBS} if fewer genuinely fit."""


def rank_clubs(blurb: str, candidates: list[Club]) -> Ranking:
    """Rank candidates for this blurb. Synchronous; callers use asyncio.to_thread."""
    if not candidates:
        return Ranking(outcomes=[], clubs=[])

    response = get_client().messages.create(
        model=MODEL,
        max_tokens=4000,
        output_config={"effort": "medium"},
        tools=[RERANK_TOOL_SCHEMA],
        tool_choice={
            "type": "tool",
            "name": RERANK_TOOL_SCHEMA["name"],
            "disable_parallel_tool_use": True,
        },
        messages=[{"role": "user", "content": _build_prompt(blurb, candidates)}],
    )

    if response.stop_reason == "refusal":
        detail = getattr(response.stop_details, "explanation", None)
        raise RerankError(f"Model declined to rank these clubs: {detail}")
    if response.stop_reason == "max_tokens":
        raise RerankError("Ranking hit max_tokens and may be truncated.")

    raw = next(
        (
            block.input
            for block in response.content
            if block.type == "tool_use" and block.name == RERANK_TOOL_SCHEMA["name"]
        ),
        None,
    )
    if raw is None:
        raise RerankError(f"No tool_use block (stop_reason={response.stop_reason})")

    by_id = {club.id: club for club in candidates}
    ranked: list[RankedClub] = []
    seen: set[str] = set()
    for item in raw.get("clubs") or []:
        if not isinstance(item, dict):
            continue
        club = by_id.get(item.get("id"))
        # Silently drop ids we did not offer. strict mode constrains the shape of
        # the response, not whether an id is real, and a hallucinated id would
        # otherwise surface as a club card with no club behind it.
        if club is None or club.id in seen:
            continue
        seen.add(club.id)
        ranked.append(RankedClub(club=club, why_it_fits=(item.get("why_it_fits") or "").strip()))
        if len(ranked) >= MAX_CLUBS:
            break

    outcomes = [o for o in (raw.get("outcomes") or []) if o in set(FIXED_OUTCOMES)]
    return Ranking(outcomes=outcomes[:MAX_OUTCOMES], clubs=ranked)
