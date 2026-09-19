"""Run enrichment and Voyage indexing for a bounded batch of SQLite club rows.

Usage:
    python -m app.services.enrichment_batch --limit 5
    python -m app.services.enrichment_batch --limit 100
    python -m app.services.enrichment_batch --limit 100 --force
    python -m app.services.enrichment_batch --limit 100 --index-only
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

from anthropic import Anthropic
from sqlmodel import Session, select

from app.config import settings
from app.database import engine, init_db
from app.models import FIXED_TAGS, Club, derive_outcomes_from_tags
from app.services.embeddings import get_client as get_voyage_client
from app.services.embeddings import upsert_club_records
from app.services.enrichment import EnrichmentError, enrich_club


@dataclass(frozen=True)
class BatchResult:
    selected: int
    enriched: int
    failed: int
    indexed: int


DEFAULT_CONCURRENCY = 6
COMMIT_EVERY = 10
# The SDK retries 429s/overloads itself; at a few hundred calls that's worth raising
# above the default of 2 so a transient rate limit doesn't burn a club's slot.
MAX_RETRIES = 5


def stale_tag_ids(session: Session) -> list[str]:
    """Enriched clubs holding tags that are no longer in FIXED_TAGS.

    Editing the vocabulary silently strands every row enriched under the old one, and
    --force won't find them: it re-runs the first N clubs by name, so a handful of rows
    late in the alphabet stay stale while you watch the early ones look correct.
    """
    allowed = set(FIXED_TAGS)
    clubs = session.exec(select(Club).where(Club.summary.is_not(None)))
    return [club.id for club in clubs if any(t not in allowed for t in (club.tags or []))]


def run(
    limit: int = 100,
    *,
    force: bool = False,
    club_ids: list[str] | None = None,
    concurrency: int = DEFAULT_CONCURRENCY,
    commit_every: int = COMMIT_EVERY,
) -> BatchResult:
    """Enrich up to ``limit`` clubs missing summaries, then index successful rows.

    Enrichment runs ``concurrency`` calls at a time and commits every ``commit_every``
    rows, so a crash partway through a few-hundred-club run keeps everything already
    paid for -- re-running picks up only the clubs still missing a summary.

    Embeddings are written once at the end, after the summaries are safely committed.
    If that write fails, ``--index-only`` replays it without re-running Claude.
    """
    if limit < 1:
        raise ValueError("limit must be at least 1")
    if concurrency < 1:
        raise ValueError("concurrency must be at least 1")
    if not settings.anthropic_api_key:
        raise EnrichmentError("ANTHROPIC_API_KEY is required to run enrichment batches")
    if not settings.voyage_api_key:
        raise EnrichmentError("VOYAGE_API_KEY is required to run enrichment batches")

    init_db()
    anthropic_client = Anthropic(api_key=settings.anthropic_api_key, max_retries=MAX_RETRIES)
    voyage_client = get_voyage_client()

    with Session(engine) as session:
        query = select(Club).order_by(Club.name)
        if club_ids is not None:
            # Explicit id list wins: re-enrich exactly these, enriched or not.
            query = query.where(Club.id.in_(club_ids))
        elif not force:
            query = query.where(Club.summary.is_(None))
        clubs = list(session.exec(query.limit(limit)))

        enriched: list[Club] = []
        failures = 0

        # Claude calls run in threads; the Session does not. Workers only ever touch
        # the plain strings snapshotted here, and every ORM write happens on this
        # thread as results come back.
        jobs = [(club.id, club.name, club.description_raw) for club in clubs]
        by_id = {club.id: club for club in clubs}

        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {
                pool.submit(enrich_club, name, description, client=anthropic_client): club_id
                for club_id, name, description in jobs
            }
            for done, future in enumerate(as_completed(futures), start=1):
                club = by_id[futures[future]]
                try:
                    result = future.result()
                except Exception as error:  # One bad row shouldn't end the batch.
                    failures += 1
                    print(f"[enrichment] ({done}/{len(jobs)}) failed {club.name}: {error}")
                    continue

                club.summary = result["summary"]
                club.outcomes = result["outcomes"]
                club.outcomes_derived = result["outcomes_derived"]
                club.tags = result["tags"]
                club.commitment = result["commitment"]
                session.add(club)
                enriched.append(club)
                print(f"[enrichment] ({done}/{len(jobs)}) enriched {club.name}")

                if len(enriched) % commit_every == 0:
                    session.commit()

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


def derive_missing_outcomes(limit: int = 1000) -> BatchResult:
    """Backfill outcomes for enriched clubs that have none, from their tags.

    No Claude calls -- this only re-reads tags already on the row. Re-indexes the rows
    it touches, since outcomes are part of the embedding document.
    """
    init_db()
    with Session(engine) as session:
        clubs = [
            club
            for club in session.exec(
                select(Club).where(Club.summary.is_not(None)).order_by(Club.name).limit(limit)
            )
            if not club.outcomes
        ]

        updated: list[Club] = []
        for club in clubs:
            derived = derive_outcomes_from_tags(club.tags or [])
            if not derived:
                print(f"[outcomes] no tags to derive from: {club.name}")
                continue
            club.outcomes = derived
            club.outcomes_derived = True
            session.add(club)
            updated.append(club)
            print(f"[outcomes] {club.name} -> {derived}")
        session.commit()

        if updated:
            upsert_club_records(updated, client=get_voyage_client())
            print(f"[embeddings] reindexed {len(updated)} club vector(s)")

    return BatchResult(
        selected=len(clubs), enriched=len(updated), failed=len(clubs) - len(updated),
        indexed=len(updated),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich and index Campus Compass clubs")
    parser.add_argument("--limit", type=int, default=100, help="Maximum clubs to process (default: 100)")
    parser.add_argument("--force", action="store_true", help="Re-enrich clubs that already have summaries")
    parser.add_argument("--index-only", action="store_true", help="Index enriched clubs without calling Claude")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY,
                        help=f"Parallel Claude calls (default: {DEFAULT_CONCURRENCY})")
    parser.add_argument("--stale-tags", action="store_true",
                        help="Re-enrich only clubs whose tags predate the current FIXED_TAGS")
    parser.add_argument("--derive-outcomes", action="store_true",
                        help="Backfill empty outcomes from tags (no Claude calls)")
    args = parser.parse_args()

    if args.force and args.index_only:
        parser.error("--force and --index-only cannot be used together")

    if args.derive_outcomes:
        result = derive_missing_outcomes()
    elif args.index_only:
        result = index_existing(args.limit)
    elif args.stale_tags:
        init_db()
        with Session(engine) as session:
            ids = stale_tag_ids(session)
        print(f"[enrichment] {len(ids)} club(s) on an outdated tag vocabulary")
        result = (
            run(max(len(ids), 1), club_ids=ids, concurrency=args.concurrency)
            if ids
            else BatchResult(0, 0, 0, 0)
        )
    else:
        result = run(args.limit, force=args.force, concurrency=args.concurrency)
    print(
        "[enrichment] complete "
        f"selected={result.selected} enriched={result.enriched} "
        f"failed={result.failed} indexed={result.indexed}"
    )


if __name__ == "__main__":
    main()
