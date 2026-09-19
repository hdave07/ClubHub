"""Match a club name pulled off a poster/PDF to an existing Club row.

The naive approach -- fuzzy-matching raw names -- fails badly here, because
almost every U of T club name shares the same boilerplate. "UofT Outdoors Club"
scores 85.5 against "University of Toronto Poker Club" on rapidfuzz's WRatio,
above any threshold you'd pick: the shared "U of T ... Club" scaffolding drowns
out the one word that actually distinguishes them.

A wrong match is worse than no match. A miss is visible and recoverable; a
confident wrong attachment files a hiking trip under the Poker Club and nobody
ever notices. So:

  1. Strip the boilerplate and compare only the distinctive remainder.
  2. Check acronyms explicitly -- posters often say just "UTMIST".
  3. Set the bar high, and create a new Club rather than guess
     (see get_or_create_club).
"""

import re
from dataclasses import dataclass

from rapidfuzz import fuzz, process
from sqlmodel import Session, select

from app.models import Club

# Words appearing in most U of T club names, which therefore carry no signal.
# Removing them is what makes the comparison "outdoors" vs "poker" instead of
# "uoft outdoors club" vs "university of toronto poker club".
BOILERPLATE = {
    "university", "of", "toronto", "uoft", "u", "t", "utoronto", "the", "a",
    "club", "clubs", "society", "association", "assoc", "student", "students",
    "group", "team", "organization", "at", "and", "for",
}

# 88 rather than 80: once the boilerplate is gone the distinctive words are all
# that's left, so a genuine match scores very high and a coincidental one
# collapses. Run _smoke_test() to see the gap.
DEFAULT_THRESHOLD = 88

_PUNCT_RE = re.compile(r"[^\w\s]")
_PAREN_RE = re.compile(r"\(([^)]+)\)")


def normalize(name: str) -> str:
    """Lowercase, drop punctuation, remove boilerplate words.

    "UofT Outdoors Club"               -> "outdoors"
    "University of Toronto Poker Club" -> "poker"
    """
    cleaned = _PUNCT_RE.sub(" ", name.lower())
    return " ".join(t for t in cleaned.split() if t and t not in BOILERPLATE)


def acronyms(name: str) -> set[str]:
    """Short forms a club might be referred to by on a poster.

    Pulls parenthesised forms ("... (UTMIST)" -> "utmist") and builds the
    initialism of the distinctive words. Posters often use only the short form,
    and fuzzy-matching a 6-letter acronym against a 60-character official name
    scores near zero, so this needs its own path.
    """
    found = {m.group(1).lower().strip() for m in _PAREN_RE.finditer(name)}
    words = normalize(name).split()
    if len(words) > 1:
        found.add("".join(w[0] for w in words))
    return {a for a in found if len(a) >= 2}


@dataclass(frozen=True)
class MatchResult:
    """The decision plus why it was made -- callers log this."""

    club: Club | None
    score: float
    matched_on: str  # "acronym" | "name" | "none"

    @property
    def is_match(self) -> bool:
        return self.club is not None


def match_club(
    session: Session, name_guess: str | None, threshold: int = DEFAULT_THRESHOLD
) -> MatchResult:
    """Best existing Club for a name read off a poster, or a no-match result.

    Returns the score and reason alongside the club so callers can log
    near-misses -- a near-miss is exactly the case that used to silently become
    a wrong attachment, and it's worth being able to see them go by.
    """
    if not name_guess or not name_guess.strip():
        return MatchResult(None, 0.0, "none")

    clubs = session.exec(select(Club)).all()
    if not clubs:
        return MatchResult(None, 0.0, "none")

    guess_norm = normalize(name_guess)
    guess_acros = acronyms(name_guess) | {guess_norm.replace(" ", "")}

    # An acronym hit is decisive: "UTMIST" on a poster is not a coincidence.
    for club in clubs:
        if guess_acros & acronyms(club.name):
            return MatchResult(club, 100.0, "acronym")

    if not guess_norm:
        # Nothing distinctive left (e.g. "The UofT Club").
        return MatchResult(None, 0.0, "none")

    by_norm: dict[str, Club] = {}
    for club in clubs:
        key = normalize(club.name)
        if key:
            by_norm.setdefault(key, club)

    if not by_norm:
        return MatchResult(None, 0.0, "none")

    # token_set_ratio so word order and extra words don't penalise a real match
    # ("Data Science AI" vs "AI Data Science Society").
    best = process.extractOne(guess_norm, by_norm.keys(), scorer=fuzz.token_set_ratio)
    if best and best[1] >= threshold:
        return MatchResult(by_norm[best[0]], float(best[1]), "name")

    return MatchResult(None, float(best[1]) if best else 0.0, "none")


def find_club(
    session: Session, name_guess: str | None, threshold: int = DEFAULT_THRESHOLD
) -> Club | None:
    """Convenience wrapper when the caller only wants the club or None."""
    return match_club(session, name_guess, threshold).club


def get_or_create_club(
    session: Session, name_guess: str, threshold: int = DEFAULT_THRESHOLD
) -> tuple[Club, bool]:
    """Find the club this poster belongs to, or create a placeholder for it.

    Returns (club, created). Creating is the deliberate alternative to guessing:
    a club that isn't in SOP, or isn't synced yet, gets a row of its own with
    source="dropbox", so its events are attributed to *it* rather than to
    whichever existing club happened to score highest.

    Nothing is fabricated -- the name came off the poster, and the row carries
    no summary, outcomes or tags. It's an honest empty record the UI can show as
    "added from Dropbox". It won't surface in /recommend, which needs enriched
    text, and that's correct: we don't know enough about it to recommend it.

    Deduping is automatic: a placeholder created from one poster is an ordinary
    Club row afterwards, so the next poster naming the same club matches it
    normally ("Outdoors Club" and "UofT Outdoors Club" both normalise to
    "outdoors"). Repeated drops don't pile up duplicate rows.

    Caller commits.
    """
    result = match_club(session, name_guess, threshold)
    if result.club is not None:
        return result.club, False

    club = Club(name=name_guess.strip(), source="dropbox")
    session.add(club)
    session.flush()  # assign the id without committing
    return club, True


def _smoke_test() -> None:
    """Score poster names against every club in the database.

    Prints the full row of scores, not just the winner: the point is the *gap*
    between a real match and the best coincidence. If those two numbers sit close
    together, the threshold is in the wrong place and the next poster will land
    on the wrong club.
    """
    from app.database import engine

    guesses = [
        "UofT Outdoors Club",  # the one that used to hit Poker Club at 85.5
        "UofT Data Science & AI Society",
        "UofT FinTech & Blockchain Club",
        "UTMIST",  # acronym only
        "University of Toronto Machine Intelligence Student Team",  # full name
        "Poker Club",  # should match
        "Hart House Symphonic Band",  # exact
        "The UofT Club",  # nothing distinctive
    ]

    with Session(engine) as session:
        clubs = session.exec(select(Club)).all()
        if not clubs:
            print("No clubs in the database.")
            return

        print(f"{len(clubs)} clubs in DB.  threshold = {DEFAULT_THRESHOLD}\n")
        for club in clubs:
            print(f"  {club.name}")
            print(f"      norm={normalize(club.name)!r}  acronyms={acronyms(club.name) or '-'}")
        print()

        for guess in guesses:
            result = match_club(session, guess)
            verdict = (
                f"{result.club.name}  [{result.matched_on} {result.score:.0f}]"
                if result.is_match
                else f"NO MATCH  [best {result.score:.0f}]"
            )
            scores = sorted(
                ((fuzz.token_set_ratio(normalize(guess), normalize(c.name)), c.name) for c in clubs),
                reverse=True,
            )
            print(f"{guess!r}  -> norm={normalize(guess)!r}")
            print(f"   {verdict}")
            print("   scores: " + "  ".join(f"{normalize(n) or '-'}={s:.0f}" for s, n in scores))
            print()


if __name__ == "__main__":
    _smoke_test()
