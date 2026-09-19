"""One-time bulk sync from SOP's public WordPress REST API.

Run as a script (`python -m app.services.sop_sync`), not on every request.

Endpoints (verified 2026-09-19):
  Groups: {SOP_BASE_URL}/wp/v2/group?per_page=100&page=N
  Events: {SOP_BASE_URL}/tribe/events/v1/events?per_page=50 (follow next_rest_url)

Dedupe rules:
  1. `copy-of-*` slugs carry an `_oasis_original` meta ID -> collapse into the original.
  2. Leftover duplicates: normalize (name, campus) and fuzzy-match with rapidfuzz.

Filter out listings where `acf._expiration-date` is in the past.
"""

import httpx

from app.config import settings

HEADERS = {"User-Agent": settings.sop_user_agent}


def fetch_groups(page: int = 1, per_page: int = 100) -> list[dict]:
    url = f"{settings.sop_base_url}/wp/v2/group"
    resp = httpx.get(url, params={"per_page": per_page, "page": page}, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_events(per_page: int = 50) -> list[dict]:
    events: list[dict] = []
    url = f"{settings.sop_base_url}/tribe/events/v1/events"
    params: dict | None = {"per_page": per_page}
    while url:
        resp = httpx.get(url, params=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        events.extend(data.get("events", []))
        url = data.get("next_rest_url")
        params = None  # next_rest_url already carries query params
    return events


def sync() -> None:
    """TODO: fetch, dedupe, filter expired, write to SQLite, then enrich + embed."""
    raise NotImplementedError


if __name__ == "__main__":
    sync()
