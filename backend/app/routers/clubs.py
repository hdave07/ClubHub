from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Club, Event

router = APIRouter(prefix="/clubs", tags=["clubs"])


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
def get_club(club_id: str, session: Session = Depends(get_session)):
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    events = session.exec(select(Event).where(Event.club_id == club_id)).all()
    return {"club": club, "events": events, "similar": []}  # TODO: similar clubs
