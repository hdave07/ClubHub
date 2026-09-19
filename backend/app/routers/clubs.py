from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Club, Event

router = APIRouter(prefix="/clubs", tags=["clubs"])


@router.get("/{club_id}")
def get_club(club_id: str, session: Session = Depends(get_session)):
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    events = session.exec(select(Event).where(Event.club_id == club_id)).all()
    return {"club": club, "events": events, "similar": []}  # TODO: similar clubs
