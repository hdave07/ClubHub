from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Event

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def list_events(since: datetime | None = None, session: Session = Depends(get_session)):
    """Live feed of published events, including Dropbox-sourced updates."""
    query = select(Event).where(Event.status == "published")
    if since:
        query = query.where(Event.start >= since)
    return session.exec(query.order_by(Event.start)).all()
