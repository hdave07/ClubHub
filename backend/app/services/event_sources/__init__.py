"""Pluggable event-source adapters.

`base` holds the contract, `runner` enforces the safety rules and writes rows,
and each other module is one source. See `.cursor/skills/scraping-club-events/`
for the workflow that produces a new adapter.
"""

from app.services.event_sources.base import ScrapedEvent

__all__ = ["ScrapedEvent"]
