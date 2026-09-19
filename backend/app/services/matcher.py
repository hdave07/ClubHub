"""Fuzzy-match a name pulled from a poster/PDF to an existing Club row."""

from rapidfuzz import fuzz, process
from sqlmodel import Session, select

from app.models import Club


def find_club(session: Session, name_guess: str, threshold: int = 80) -> Club | None:
    clubs = session.exec(select(Club)).all()
    if not clubs or not name_guess:
        return None
    names = {club.name: club for club in clubs}
    match = process.extractOne(name_guess, names.keys(), scorer=fuzz.WRatio)
    if match and match[1] >= threshold:
        return names[match[0]]
    return None
