from fastapi import APIRouter, Depends, HTTPException, Path
from sqlmodel import Session, select

from app.database import get_session
from app.models import Club, Event
from app.schemas import PublicEvent

router = APIRouter(prefix="/clubs", tags=["clubs"])

# Every id in this database is a uuid4 (models._uuid). Constraining the path
# rejects probe strings at the edge, before they reach a query, and turns a
# malformed id into a 422 rather than a database round trip and a 404.
CLUB_ID = Path(min_length=36, max_length=36, pattern=r"^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")


@router.get("")
def list_clubs(session: Session = Depends(get_session)):
    """All clubs currently in the database (SOP-synced and Dropbox-created).

    This used to return two hardcoded placeholder clubs from an in-memory repo
    left over from before the SQLite baseline existed (app/domain.py) -- real
    data has been in the database since sop_sync landed, but this endpoint never
    got switched over, so it silently served fake data underneath a real one.
    """
    return session.exec(select(Club)).all()


@router.get("/{club_id}")
def get_club(club_id: str = CLUB_ID, session: Session = Depends(get_session)):
    """One club plus the events a student may actually see.

    `published` only, matching GET /events. This endpoint used to return every
    row for the club, which meant a pending_review event -- an AI extraction we
    deliberately did not trust enough to publish -- was reachable through the
    club panel while the events feed correctly hid it. Same data, two answers.
    """
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    events = session.exec(
        select(Event)
        .where(Event.club_id == club_id, Event.status == "published")
        .order_by(Event.start)
    ).all()
    return {
        "club": club,
        "events": [PublicEvent.model_validate(e, from_attributes=True) for e in events],
        "similar": [],  # TODO: similar clubs
    }
