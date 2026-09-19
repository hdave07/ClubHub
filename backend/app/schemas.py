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
