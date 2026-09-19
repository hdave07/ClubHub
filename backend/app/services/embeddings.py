"""Voyage embeddings and ChromaDB storage for campus clubs and events."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

import chromadb

from app.config import settings
from app.models import Club, Event

CLUB_COLLECTION = "club_embeddings_voyage"
EVENT_COLLECTION = "event_embeddings_voyage"
MAX_BATCH_SIZE = 128


class EmbeddingError(RuntimeError):
    """Raised when Voyage cannot produce a valid embedding response."""


def get_client() -> Any:
    """Create a Voyage client only when an embedding is actually needed."""
    if not settings.voyage_api_key:
        raise EmbeddingError("VOYAGE_API_KEY is required to create embeddings")
    import voyageai

    return voyageai.Client(api_key=settings.voyage_api_key)


def get_collection(name: str):
    """Return one persistent cosine-distance collection per record type."""
    client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


def embed_documents(texts: list[str], *, client: Any | None = None) -> list[list[float]]:
    """Embed source records using Voyage's document retrieval mode."""
    return _embed(texts, input_type="document", client=client)


def embed_query(text: str, *, client: Any | None = None) -> list[float]:
    """Embed a student blurb using Voyage's query retrieval mode."""
    return _embed([text], input_type="query", client=client)[0]


def upsert_club(
    club_id: str,
    text: str,
    metadata: Mapping[str, str | int | float | bool] | None = None,
    *,
    client: Any | None = None,
    collection: Any | None = None,
) -> None:
    """Embed and persist one club document, keyed by its SQLite ID."""
    _upsert(collection or get_collection(CLUB_COLLECTION), [club_id], [text], [dict(metadata or {})], client)


def upsert_event(
    event_id: str,
    text: str,
    metadata: Mapping[str, str | int | float | bool] | None = None,
    *,
    client: Any | None = None,
    collection: Any | None = None,
) -> None:
    """Embed and persist one event document, keyed by its SQLite ID."""
    _upsert(collection or get_collection(EVENT_COLLECTION), [event_id], [text], [dict(metadata or {})], client)


def upsert_club_record(club: Club, *, client: Any | None = None) -> None:
    """Build a retrieval document from the enriched fields of a club row."""
    upsert_club(
        club.id,
        club_to_document(club),
        {"name": club.name, "campus": club.campus or "", "source": club.source},
        client=client,
    )


def upsert_club_records(clubs: Iterable[Club], *, client: Any | None = None) -> None:
    """Embed a club batch with Voyage's efficient multi-document request format."""
    records = list(clubs)
    if not records:
        return
    _upsert(
        get_collection(CLUB_COLLECTION),
        [club.id for club in records],
        [club_to_document(club) for club in records],
        [
            {"name": club.name, "campus": club.campus or "", "source": club.source}
            for club in records
        ],
        client,
    )


def upsert_event_record(event: Event, *, club_name: str | None = None, client: Any | None = None) -> None:
    """Build a retrieval document from an event row and optional club context."""
    upsert_event(
        event.id,
        event_to_document(event, club_name=club_name),
        {"club_id": event.club_id, "source": event.source, "status": event.status},
        client=client,
    )


def upsert_event_records(
    events: Iterable[Event],
    *,
    club_names: Mapping[str, str] | None = None,
    client: Any | None = None,
) -> None:
    """Embed an event batch, preserving club context without storing contact data."""
    records = list(events)
    if not records:
        return
    names = club_names or {}
    _upsert(
        get_collection(EVENT_COLLECTION),
        [event.id for event in records],
        [event_to_document(event, club_name=names.get(event.club_id)) for event in records],
        [{"club_id": event.club_id, "source": event.source, "status": event.status} for event in records],
        client,
    )


def query_clubs(blurb: str, top_k: int = 20, *, client: Any | None = None) -> list[str]:
    """Return nearest club IDs for a student blurb, ready for reranking."""
    return _query(get_collection(CLUB_COLLECTION), blurb, top_k, client=client)


def query_events(blurb: str, top_k: int = 20, *, client: Any | None = None) -> list[str]:
    """Return nearest event IDs without mixing them into club recommendations."""
    return _query(get_collection(EVENT_COLLECTION), blurb, top_k, client=client)


def club_to_document(club: Club) -> str:
    """Use enriched fields rather than unbounded raw HTML when possible."""
    sections = [f"Club: {club.name}"]
    if club.summary:
        sections.append(f"Summary: {club.summary}")
    elif club.description_raw:
        sections.append(f"Description: {club.description_raw}")
    if club.outcomes:
        sections.append(f"Student outcomes: {', '.join(club.outcomes)}")
    if club.tags:
        sections.append(f"Tags: {', '.join(club.tags)}")
    if club.commitment:
        sections.append(f"Commitment: {club.commitment}")
    if club.campus:
        sections.append(f"Campus: {club.campus}")
    return "\n".join(sections)


def event_to_document(event: Event, *, club_name: str | None = None) -> str:
    """Represent event details without organizer contact information."""
    sections = [f"Event: {event.title}"]
    if club_name:
        sections.append(f"Club: {club_name}")
    if event.description:
        sections.append(f"Description: {event.description}")
    if event.location:
        sections.append(f"Location: {event.location}")
    if event.start:
        sections.append(f"Starts: {event.start.isoformat()}")
    return "\n".join(sections)


def _embed(texts: Iterable[str], *, input_type: str, client: Any | None) -> list[list[float]]:
    clean_texts = [text.strip() for text in texts]
    if not clean_texts or any(not text for text in clean_texts):
        raise ValueError("Cannot embed an empty text value")

    voyage = client or get_client()
    embeddings: list[list[float]] = []
    for start in range(0, len(clean_texts), MAX_BATCH_SIZE):
        batch = clean_texts[start : start + MAX_BATCH_SIZE]
        response = voyage.embed(
            batch,
            model=settings.voyage_embedding_model,
            input_type=input_type,
            output_dimension=settings.voyage_embedding_dimensions,
        )
        batch_embeddings = getattr(response, "embeddings", None)
        if not isinstance(batch_embeddings, list) or len(batch_embeddings) != len(batch):
            raise EmbeddingError("Voyage returned an unexpected number of embeddings")
        embeddings.extend([list(vector) for vector in batch_embeddings])
    return embeddings


def _upsert(collection: Any, ids: list[str], texts: list[str], metadatas: list[dict], client: Any | None) -> None:
    collection.upsert(ids=ids, embeddings=embed_documents(texts, client=client), documents=texts, metadatas=metadatas)


def _query(collection: Any, blurb: str, top_k: int, *, client: Any | None) -> list[str]:
    if top_k < 1:
        raise ValueError("top_k must be at least 1")
    available = collection.count()
    if available == 0:
        return []
    result = collection.query(
        query_embeddings=[embed_query(blurb, client=client)],
        n_results=min(top_k, available),
    )
    ids = result.get("ids", [[]])
    return ids[0] if ids else []
