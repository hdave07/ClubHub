from datetime import datetime

from pydantic import BaseModel


class RecommendRequest(BaseModel):
    blurb: str


class ClubMatch(BaseModel):
    id: str
    name: str
    summary: str | None
    outcomes: list[str]
    tags: list[str]
    why_it_fits: str


class RecommendResponse(BaseModel):
    outcomes: list[str]
    clubs: list[ClubMatch]


# --- POST /upload -----------------------------------------------------------
# Field names match frontend/src/types.js EventLite so the UI can render an
# uploaded flier's events with the same component as the live /events feed.


class UploadedEvent(BaseModel):
    id: str
    title: str
    start: datetime | None  # UTC; serialized as an ISO string
    location: str | None
    status: str  # published | pending_review
    source: str = "dropbox"
    source_file: str
    dropbox_link: str | None


class UploadedClub(BaseModel):
    id: str
    name: str
    created: bool  # True = we had no record of this club and made one


class UploadResponse(BaseModel):
    """What the app tells a user after they upload a flier.

    `status` is the honest outcome, not an error code -- "we read this but
    couldn't confirm the date" is a normal result the UI should show, not a
    failure to hide.
    """

    status: str  # processed | no_events | duplicate | failed
    message: str  # human-readable, safe to show directly
    club: UploadedClub | None = None
    events: list[UploadedEvent] = []
    confidence: float | None = None
    uncertainties: list[str] = []
