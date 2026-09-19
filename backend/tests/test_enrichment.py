from types import SimpleNamespace
import unittest

from app.services.enrichment import (
    DEFAULT_HAIKU_MODEL,
    LIMITED_INFO_SUMMARY,
    EnrichmentError,
    enrich_club,
)


class FakeMessages:
    def __init__(self, response):
        self.response = response
        self.request = None

    def create(self, **kwargs):
        self.request = kwargs
        return self.response


class EnrichClubTests(unittest.TestCase):
    def test_forces_tool_use_and_normalises_response(self):
        tool_block = SimpleNamespace(
            type="tool_use",
            name="enrich_club",
            input={
                "summary": "  Build projects with other students. ",
                "outcomes": ["Build skills/portfolio", "Build skills/portfolio", "Not an outcome"],
                "tags": [" Hackathons ", "TECHNOLOGY", "hackathons"],
                "commitment": "casual",
            },
        )
        messages = FakeMessages(SimpleNamespace(content=[tool_block]))
        client = SimpleNamespace(messages=messages)

        result = enrich_club("  Hack Club  ", "Students build projects.", client=client)

        self.assertEqual(result["summary"], "Build projects with other students.")
        self.assertEqual(result["outcomes"], ["Build skills/portfolio"])
        self.assertEqual(result["tags"], ["hackathons", "technology"])
        self.assertEqual(messages.request["model"], DEFAULT_HAIKU_MODEL)
        self.assertEqual(messages.request["tool_choice"], {"type": "tool", "name": "enrich_club"})

    def test_empty_description_gets_limited_info_fallback(self):
        tool_block = SimpleNamespace(
            type="tool_use",
            name="enrich_club",
            input={"summary": None, "outcomes": [], "tags": [], "commitment": "unknown"},
        )
        client = SimpleNamespace(messages=FakeMessages(SimpleNamespace(content=[tool_block])))

        result = enrich_club("Unknown club", None, client=client)

        self.assertEqual(result["summary"], LIMITED_INFO_SUMMARY)

    def test_missing_tool_result_raises_clear_error(self):
        client = SimpleNamespace(messages=FakeMessages(SimpleNamespace(content=[])))

        with self.assertRaises(EnrichmentError):
            enrich_club("Club", "Description", client=client)


if __name__ == "__main__":
    unittest.main()
