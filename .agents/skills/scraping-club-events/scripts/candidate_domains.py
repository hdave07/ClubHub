"""Rank the domains in Club.links by how many clubs share them.

Phase 1 of the scraping-club-events skill. The point is to stop writing one
scraper per club: if 30 clubs are hosted on the same platform, one adapter covers
all 30, while the club with a bespoke hand-built site is worth almost nothing per
hour spent. Recon effort should follow the count in this table.

Run from the backend directory with the venv active:

    python ../.cursor/skills/scraping-club-events/scripts/candidate_domains.py
    python ../.cursor/skills/scraping-club-events/scripts/candidate_domains.py --min-clubs 3
    python ../.cursor/skills/scraping-club-events/scripts/candidate_domains.py --show-urls
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

# Importable whether invoked from backend/ or from the repo root.
_BACKEND = Path(__file__).resolve().parents[4] / "backend"
if _BACKEND.is_dir() and str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlmodel import Session, select  # noqa: E402

from app.database import engine  # noqa: E402
from app.models import Club  # noqa: E402

# Social platforms are out of scope: CLAUDE.md lists Instagram scraping as
# roadmap only, and both of these are hostile to unauthenticated fetching anyway.
# Excluded here so they never reach the ranking and get picked up by mistake.
EXCLUDED_HOSTS = {
    "instagram.com",
    "facebook.com",
    "fb.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "linkedin.com",
    "discord.gg",
    "discord.com",
}

# Link keys worth investigating. Email and the constitution PDF never carry events.
LINK_KEYS = ("website",)


def registrable(host: str) -> str:
    """Collapse a hostname to the part worth counting.

    `clubs.sa.utoronto.ca` and `www.clubs.sa.utoronto.ca` are the same platform;
    counting them separately hides the fact that one adapter covers both. Naive
    last-two-labels would merge every `*.utoronto.ca` subdomain into one bucket,
    which over-collapses, so `utoronto.ca` keeps one more label.
    """
    host = host.lower().removeprefix("www.")
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    if ".".join(parts[-2:]) in {"utoronto.ca", "co.uk", "org.uk", "ac.uk"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def collect(session: Session) -> dict[str, list[tuple[str, str]]]:
    """domain -> [(club name, url)]."""
    by_domain: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for club in session.exec(select(Club)).all():
        links = club.links or {}
        for key in LINK_KEYS:
            url = (links.get(key) or "").strip()
            if not url:
                continue
            host = urlparse(url if "//" in url else f"https://{url}").netloc
            if not host:
                continue
            domain = registrable(host)
            if domain in EXCLUDED_HOSTS or any(
                domain.endswith(f".{excluded}") for excluded in EXCLUDED_HOSTS
            ):
                continue
            by_domain[domain].append((club.name, url))
    return by_domain


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--min-clubs",
        type=int,
        default=1,
        help="Only show domains shared by at least this many clubs (default: 1)",
    )
    parser.add_argument(
        "--show-urls", action="store_true", help="List each club and URL per domain"
    )
    args = parser.parse_args()

    with Session(engine) as session:
        by_domain = collect(session)
        total_clubs = len(session.exec(select(Club)).all())

    if not by_domain:
        print("No website links in Club.links. Run sop_sync first.")
        return

    ranked = sorted(by_domain.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    shown = [(d, c) for d, c in ranked if len(c) >= args.min_clubs]

    with_website = sum(len(c) for c in by_domain.values())
    print(
        f"{total_clubs} clubs, {with_website} with a website link, "
        f"{len(ranked)} distinct domains\n"
    )

    shared = [(d, c) for d, c in ranked if len(c) > 1]
    if shared:
        print("Shared platforms -- one adapter covers every club listed:")
        for domain, clubs in shared:
            print(f"  {len(clubs):>3}  {domain}")
        print()
    else:
        print("No domain is shared by more than one club: every site is bespoke.")
        print("Prefer a campus-wide calendar over per-club adapters.\n")

    print(f"All domains (>= {args.min_clubs} club{'s' if args.min_clubs != 1 else ''}):")
    for domain, clubs in shown:
        print(f"  {len(clubs):>3}  {domain}")
        if args.show_urls:
            for name, url in sorted(clubs):
                print(f"         {name}  {url}")

    print("\nNext: phase 2 of the skill -- open the top domain and read its network tab.")


if __name__ == "__main__":
    main()
