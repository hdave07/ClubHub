"""One-time sync of a curated club list from SOP's WordPress REST API.

Verified 2026-09-19 against https://sop.utoronto.ca:
  - REST endpoint: {SOP_BASE_URL}/wp/v2/group/{id}, and {SOP_BASE_URL}/wp/v2/group
    with ?search=<term> for discovery. The frontend's own "search this site" box
    (wp-admin/admin-ajax.php?action=alm_get_posts...) hits the same underlying WP
    search, so it has the same problem: fuzzy full-text ranking that often buries
    the exact title you're looking for. Prefer a known post ID once you have one.
  - SOP's WAF returns 403 for the `httpx` client specifically (TLS/HTTP
    fingerprinting, not IP- or header-based -- confirmed by hitting the same URL
    with httpx vs stdlib urllib.request back to back). This module uses
    urllib.request for that reason; don't swap it back to httpx.
  - `acf._expiration-date` and `meta._oasis_original` (the dedupe key from
    CLAUDE.md) are exposed via REST. Website/email/social links and the
    constitution PDF are NOT in the REST payload -- those are scraped off the
    rendered /group/<slug>/ page with BeautifulSoup.

Run as a script (`python -m app.services.sop_sync`), not on every request.
"""

import html as html_lib
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime

from bs4 import BeautifulSoup
from sqlmodel import Session, select

from app.config import settings
from app.database import engine, init_db
from app.models import Club

HEADERS = {"User-Agent": settings.sop_user_agent}

# Hardcoded for the hackathon demo scope -- a full campus-wide sync (~1,250 groups)
# needs pagination and heavier throttling per CLAUDE.md's "SOP etiquette" and is out
# of scope here. Post IDs below were found via one-off find_group_by_search() lookups
# on 2026-09-19 and confirmed by eye; add more clubs here as (id, label) pairs.
TARGET_GROUP_IDS: dict[int, str] = {
    25046: "University of Toronto Machine Intelligence Student Team (UTMIST)",
    20806: "Hart House Symphonic Band",
    25481: "University of Toronto Poker Club",
    26242: "UofT Kpop Dance Club (UTKDC)",
    149718: "University of Toronto Japan Student Association",
}

_CAMPUS_CLASS_RE = re.compile(r"campus-(.+)")
_AREA_CLASS_RE = re.compile(r"areas_of_interest-(.+)")


def _get(url: str, params: dict | None = None) -> str:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_group(post_id: int) -> dict:
    return json.loads(_get(f"{settings.sop_base_url}/wp/v2/group/{post_id}"))


def fetch_events(per_page: int = 50) -> list[dict]:
    """NOTE: uses httpx (unlike the rest of this module) -- not re-verified against
    SOP's WAF for this task. If it 403s, port it to urllib.request like fetch_group.
    """
    import httpx

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


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", html_lib.unescape(s).lower())


def find_group_by_search(name: str, per_page: int = 20) -> dict | None:
    """Fuzzy fallback for clubs not yet in TARGET_GROUP_IDS. Verify the match by eye
    (print the result) before trusting it and adding its id to TARGET_GROUP_IDS --
    SOP's search ranks badly for full multi-word titles.
    """
    body = _get(f"{settings.sop_base_url}/wp/v2/group", {"search": name, "per_page": per_page})
    results = json.loads(body)
    target = _norm(name)
    for r in results:
        if _norm(r["title"]["rendered"]) == target:
            return r
    for r in results:
        t = _norm(r["title"]["rendered"])
        if target in t or t in target:
            return r
    return None


def parse_group_page_links(page_html: str) -> dict:
    """Website, contact email, socials, constitution PDF -- not exposed via REST."""
    soup = BeautifulSoup(page_html, "lxml")

    def find_h3(text: str):
        return soup.find("h3", string=lambda s: s and s.strip() == text)

    def anchors_until_next_h3(start_h3):
        # Direct-sibling <a> tags belong to this section; a sibling <h3> ends it.
        # (find_next_siblings("a") alone isn't bounded by the next heading and will
        # walk into later sections -- e.g. it grabbed the Constitution PDF link and
        # overwrote the real website URL until this boundary check was added.)
        for sib in start_h3.find_next_siblings():
            if sib.name == "h3":
                break
            if sib.name == "a" and sib.get("href"):
                yield sib

    links: dict = {}

    contact_h3 = find_h3("Contact")
    if contact_h3:
        for a in anchors_until_next_h3(contact_h3):
            href = a["href"]
            if href.startswith("mailto:"):
                links["email"] = href.removeprefix("mailto:")
            else:
                links["website"] = href

    socials_h3 = find_h3("Socials")
    if socials_h3:
        container = socials_h3.find_next_sibling("div")
        if container:
            for a in container.find_all("a", href=True):
                href = a["href"]
                if "facebook.com" in href:
                    links["facebook"] = href
                elif "instagram.com" in href:
                    links["instagram"] = href

    constitution_h3 = find_h3("Group Constitution")
    if constitution_h3:
        pdf = constitution_h3.find_next("a", href=True)
        if pdf:
            links["constitution_pdf"] = pdf["href"]

    return links


def _parse_taxonomy_tags(class_list: list[str]) -> tuple[str | None, list[str]]:
    """class_list carries taxonomy slugs directly -- cheaper than resolving term IDs
    via the group_type/campus/areas_of_interest taxonomy endpoints."""
    campus = None
    areas: list[str] = []
    for c in class_list:
        m = _CAMPUS_CLASS_RE.fullmatch(c)
        if m:
            campus = m.group(1).replace("-", " ").title()
        m = _AREA_CLASS_RE.fullmatch(c)
        if m:
            areas.append(m.group(1).replace("-", " ").title())
    return campus, areas


def _strip_html(raw: str) -> str:
    return BeautifulSoup(raw, "lxml").get_text(separator=" ", strip=True)


def build_club(record: dict, links: dict) -> Club:
    meta = record.get("meta", {})
    acf = record.get("acf", {})
    oasis_original = meta.get("_oasis_original") or 0
    sop_id = str(record["id"])
    # Dedupe key per CLAUDE.md: `copy-of-*` yearly re-listings carry a nonzero
    # _oasis_original pointing at the original post id; collapse onto that.
    sop_original_id = str(oasis_original) if oasis_original else sop_id

    campus, areas = _parse_taxonomy_tags(record.get("class_list", []))

    listing_expires = None
    exp_raw = acf.get("_expiration-date")
    if exp_raw:
        listing_expires = datetime.strptime(exp_raw, "%Y-%m-%d %H:%M:%S")

    return Club(
        sop_id=sop_id,
        sop_original_id=sop_original_id,
        name=html_lib.unescape(record["title"]["rendered"]),
        campus=campus,
        sop_interest_areas=areas,
        description_raw=_strip_html(record.get("content", {}).get("rendered", "")),
        links=links,
        sop_url=record.get("link"),
        listing_expires=listing_expires,
        last_updated=datetime.utcnow(),
        source="sop",
    )


def upsert_club(session: Session, club: Club) -> Club:
    """Dedupe on sop_original_id, not sop_id -- collapses copy-of-* re-listings onto
    one row instead of creating a new "club" every year SOP re-lists it."""
    existing = session.exec(
        select(Club).where(Club.sop_original_id == club.sop_original_id)
    ).first()
    if existing:
        for field in (
            "sop_id", "name", "campus", "sop_interest_areas", "description_raw",
            "links", "sop_url", "listing_expires", "last_updated",
        ):
            setattr(existing, field, getattr(club, field))
        session.add(existing)
        return existing
    session.add(club)
    return club


def sync() -> None:
    init_db()
    now = datetime.utcnow()
    with Session(engine) as session:
        for post_id, label in TARGET_GROUP_IDS.items():
            record = fetch_group(post_id)

            exp_raw = record.get("acf", {}).get("_expiration-date")
            if exp_raw and datetime.strptime(exp_raw, "%Y-%m-%d %H:%M:%S") < now:
                print(f"[sop_sync] SKIP (listing expired {exp_raw}): {label}")
                continue

            page_html = _get(record["link"])
            links = parse_group_page_links(page_html)
            club = build_club(record, links)
            saved = upsert_club(session, club)
            print(f"[sop_sync] synced {saved.name!r} (sop_original_id={saved.sop_original_id})")

            time.sleep(1)  # SOP etiquette: throttle between requests

        session.commit()


if __name__ == "__main__":
    sync()
