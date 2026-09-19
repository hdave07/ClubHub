from datetime import datetime
from types import SimpleNamespace
import unittest

from app.models import Club, Event
from app.services.embeddings import (
    CLUB_COLLECTION,
    EVENT_COLLECTION,
    club_to_document,
    embed_documents,
    embed_query,
    event_to_document,
    upsert_club,
    upsert_event,
)


class FakeVoyage:
    def __init__(self):
        self.calls = []

    def embed(self, texts, **kwargs):
        self.calls.append((texts, kwargs))
        return SimpleNamespace(embeddings=[[float(index)] for index, _ in enumerate(texts)])


class FakeCollection:
    def __init__(self):
        self.upsert_args = None

    def upsert(self, **kwargs):
        self.upsert_args = kwargs


class FakeQueryCollection:
    def __init__(self, count):
        self._count = count
        self.query_args = None

    def count(self):
        return self._count

    def query(self, **kwargs):
        self.query_args = kwargs
        return {"ids": [["club-1"]]}


class EmbeddingsTests(unittest.TestCase):
    def test_uses_document_and_query_embedding_modes(self):
        client = FakeVoyage()

        self.assertEqual(embed_documents(["club listing"], client=client), [[0.0]])
        self.assertEqual(embed_query("find friends", client=client), [0.0])

        self.assertEqual(client.calls[0][1]["input_type"], "document")
        self.assertEqual(client.calls[1][1]["input_type"], "query")

    def test_upserts_clubs_and_events_into_separate_collections(self):
        client = FakeVoyage()
        club_collection = FakeCollection()
        event_collection = FakeCollection()

        upsert_club("club-1", "Club: Builders", {"source": "sop"}, client=client, collection=club_collection)
        upsert_event("event-1", "Event: Demo Night", {"source": "dropbox"}, client=client, collection=event_collection)

        self.assertEqual(CLUB_COLLECTION, "club_embeddings_voyage")
        self.assertEqual(EVENT_COLLECTION, "event_embeddings_voyage")
        self.assertEqual(club_collection.upsert_args["ids"], ["club-1"])
        self.assertEqual(event_collection.upsert_args["ids"], ["event-1"])

    def test_document_builders_keep_useful_fields_without_contact_data(self):
        club = Club(name="Builders", summary="Make projects together.", outcomes=["Make friends"], tags=["hackathons"])
        event = Event(club_id=club.id, title="Demo Night", description="Share projects.", start=datetime(2026, 9, 23, 18))

        self.assertIn("Student outcomes: Make friends", club_to_document(club))
        self.assertIn("Club: Builders", event_to_document(event, club_name=club.name))
        self.assertNotIn("email", event_to_document(event, club_name=club.name).lower())

    def test_queries_cap_results_to_the_small_collection_size(self):
        # Call the private query helper through a fake collection to avoid Chroma I/O.
        from app.services.embeddings import _query

        collection = FakeQueryCollection(count=1)
        result = _query(collection, "find builders", 20, client=FakeVoyage())

        self.assertEqual(result, ["club-1"])
        self.assertEqual(collection.query_args["n_results"], 1)


if __name__ == "__main__":
    unittest.main()
