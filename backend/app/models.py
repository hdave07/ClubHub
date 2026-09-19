import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class Club(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    sop_id: Optional[str] = Field(default=None, index=True)
    sop_original_id: Optional[str] = Field(default=None, index=True)  # dedupe key

    name: str
    campus: Optional[str] = None
    sop_interest_areas: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    description_raw: Optional[str] = None
    summary: Optional[str] = None  # AI-written; "limited info" if thin

    outcomes: list[str] = Field(default_factory=list, sa_column=Column(JSON))  # 1-3 from fixed list
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))  # 5-8 lowercase
    commitment: Optional[str] = None  # casual | moderate | intense | unknown

    meeting_info: Optional[str] = None
    links: dict = Field(default_factory=dict, sa_column=Column(JSON))
    sop_url: Optional[str] = None

    listing_expires: Optional[datetime] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    source: str = "sop"  # sop | dropbox


class Event(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    club_id: str = Field(foreign_key="club.id", index=True)

    title: str
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    location: Optional[str] = None
    description: Optional[str] = None
    rsvp_url: Optional[str] = None

    source: str = "sop"  # sop | dropbox
    source_file: Optional[str] = None  # provenance
    dropbox_link: Optional[str] = None

    status: str = "published"  # published | pending_review
    confidence: Optional[float] = None  # 0-1


class IngestLog(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    dropbox_file_id: str = Field(index=True)
    content_hash: Optional[str] = None  # prevents reprocessing the same file
    status: str = "pending"
    result_json: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Fixed outcome list used across enrichment + the personal graph.
    # Keep this list in sync with the frontend's outcome legend.


FIXED_OUTCOMES = [
    "Make friends",
    "Build skills/portfolio",
    "Career and networking",
    "Leadership",
    "Give back",
    "Culture and identity",
    "Wellness and recreation",
    "Academic/research",
]

# Controlled tag vocabulary. Free-form tags drifted badly: a 25-club pilot produced 148
# unique tags across 177 assignments (only 14% reused), with near-duplicates like
# academic / academic inquiry / academic support and culture / afghan culture /
# african culture. That's unusable for filtering or keyword matching.
#
# Tags are a CLASSIFICATION, not a factual claim, so picking from this list doesn't
# violate the "never invent detail" rule -- summary and commitment stay conservative.
# Club-specific terms ("k-pop", "poker") live in the embedding document via the raw
# description (see embeddings.club_to_document), not here.
#
# Derived from the 16 SOP interest areas plus the tags that actually recurred in the
# pilot. Keep it flat and lowercase; enrichment enforces it as a JSON-schema enum.
FIXED_TAGS = [
    # Fields of study and practice
    "artificial intelligence",
    "technology",
    "engineering",
    "science",
    "health and medicine",
    "mental health",
    "business",
    "finance",
    "entrepreneurship",
    "consulting",
    "law",
    "politics",
    "humanities",
    "social sciences",
    "languages",
    "education",
    # Arts and creative
    "music",
    "dance",
    "theatre",
    "visual arts",
    "creative writing",
    "film and media",
    "design",
    # What the club actually does
    "workshops",
    "competitions",
    "conferences",
    "research",
    "mentorship",
    "volunteering",
    "networking",
    "social events",
    "performance",
    "training and lessons",
    "hackathons",
    "publishing",
    "fundraising",
    # Community and identity
    "cultural heritage",
    "faith and spirituality",
    "international students",
    "graduate students",
    "advocacy",
    "human rights",
    "equity and inclusion",
    "community outreach",
    "sustainability",
    "student government",
    # Recreation
    "sports",
    "fitness",
    "games",
    "outdoors",
    "food",
]
