"""Run enrichment and Voyage indexing for a bounded batch of SQLite club rows.

Usage:
    python -m app.services.enrichment_batch --limit 5
    python -m app.services.enrichment_batch --limit 100
    python -m app.services.enrichment_batch --limit 100 --force
    python -m app.services.enrichment_batch --limit 100 --index-only
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass

from anthropic import Anthropic
from sqlmodel import Session, select

from app.config import settings
from app.database import engine, init_db
from app.models import Club
from app.services.embeddings import get_client as get_voyage_client
from app.services.embeddings import upsert_club_records
from app.services.enrichment import EnrichmentError, enrich_club


@dataclass(frozen=True)
class BatchResult:
    selected: int
    enriched: int
    failed: int
    indexed: int


def run(limit: int = 100, *, force: bool = False) -> BatchResult:
    """Enrich up to ``limit`` clubs missing summaries, then index successful rows.

    Database updates are committed before embeddings are sent. Use ``--index-only``
    to retry the vector write without re-running Claude enrichment.
    """
    if limit < 1:
        raise ValueError("limit must be at least 1")
    if not settings.anthropic_api_key:
        raise EnrichmentError("ANTHROPIC_API_KEY is required to run enrichment batches")
    if not settings.voyage_api_key:
        raise EnrichmentError("VOYAGE_API_KEY is required to run enrichment batches")

    init_db()
    anthropic_client = Anthropic(api_key=settings.anthropic_api_key)
    voyage_client = get_voyage_client()

    with Session(engine) as session:
        query = select(Club).order_by(Club.name)
        if not force:
            query = query.where(Club.summary.is_(None))
        clubs = list(session.exec(query.limit(limit)))

        enriched: list[Club] = []
        failures = 0
        for club in clubs:
            try:
                result = enrich_club(club.name, club.description_raw, client=anthropic_client)
                club.summary = result["summary"]
                club.outcomes = result["outcomes"]
                club.tags = result["tags"]
                club.commitment = result["commitment"]
                session.add(club)
                enriched.append(club)
                print(f"[enrichment] enriched {club.name}")
            except Exception as error:  # Continue through a pilot even if one row is bad.
                failures += 1
                print(f"[enrichment] failed {club.name}: {error}")

        session.commit()

        if enriched:
            upsert_club_records(enriched, client=voyage_client)
            print(f"[embeddings] indexed {len(enriched)} club vector(s)")

    return BatchResult(
        selected=len(clubs),
        enriched=len(enriched),
        failed=failures,
        indexed=len(enriched),
    )


def index_existing(limit: int = 100) -> BatchResult:
    """Index already-enriched club rows without invoking Claude."""
    if limit < 1:
        raise ValueError("limit must be at least 1")
    if not settings.voyage_api_key:
        raise EnrichmentError("VOYAGE_API_KEY is required to index club records")

    init_db()
    with Session(engine) as session:
        clubs = list(session.exec(select(Club).where(Club.summary.is_not(None)).order_by(Club.name).limit(limit)))
        if clubs:
            upsert_club_records(clubs, client=get_voyage_client())
            print(f"[embeddings] indexed {len(clubs)} existing club vector(s)")
    return BatchResult(selected=len(clubs), enriched=0, failed=0, indexed=len(clubs))


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich and index Campus Compass clubs")
    parser.add_argument("--limit", type=int, default=100, help="Maximum clubs to process (default: 100)")
    parser.add_argument("--force", action="store_true", help="Re-enrich clubs that already have summaries")
    parser.add_argument("--index-only", action="store_true", help="Index enriched clubs without calling Claude")
    args = parser.parse_args()

    if args.force and args.index_only:
        parser.error("--force and --index-only cannot be used together")
    result = index_existing(args.limit) if args.index_only else run(args.limit, force=args.force)
    print(
        "[enrichment] complete "
        f"selected={result.selected} enriched={result.enriched} "
        f"failed={result.failed} indexed={result.indexed}"
    )


if __name__ == "__main__":
    main()
