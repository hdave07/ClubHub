from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.domain import Club as ClubDTO, ClubRepository
from app.models import Club, Event

router = APIRouter(prefix="/clubs", tags=["clubs"])

# Mock/in-memory repo for now -- swap for a SQLModel-backed one once the
# SQLite baseline is wired up (see app/domain.py docstring).
_repo = ClubRepository()


@router.get("", response_model=list[ClubDTO])
def list_clubs():
    return _repo.list_clubs()


@router.get("/{club_id}")
def get_club(club_id: str, session: Session = Depends(get_session)):
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    events = session.exec(select(Event).where(Event.club_id == club_id)).all()
    return {"club": club, "events": events, "similar": []}  # TODO: similar clubs
