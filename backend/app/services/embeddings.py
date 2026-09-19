"""Local embeddings (sentence-transformers) + ChromaDB vector store for clubs."""

import chromadb
from sentence_transformers import SentenceTransformer

from app.config import settings

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def get_collection():
    client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return client.get_or_create_collection("clubs")


def embed_text(text: str) -> list[float]:
    return get_model().encode(text).tolist()


def upsert_club(club_id: str, text: str, metadata: dict) -> None:
    collection = get_collection()
    collection.upsert(ids=[club_id], embeddings=[embed_text(text)], metadatas=[metadata])


def query_clubs(blurb: str, top_k: int = 20) -> list[str]:
    collection = get_collection()
    result = collection.query(query_embeddings=[embed_text(blurb)], n_results=top_k)
    return result["ids"][0] if result["ids"] else []
