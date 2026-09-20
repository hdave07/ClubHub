"""Check an event-source adapter before it is allowed to write rows.

Phase 5 of the scraping-club-events skill. Hits the real source read-only, runs
the output through the runner's staging step, and reports what would reach the
database. Nothing is written and no session is opened.

An adapter that fails here is not "mostly working" -- every check below maps to a
rule in CLAUDE.md that produces a silent, plausible-looking wrong answer when
broken. A timezone-aware start shifts every event by four hours. An organizer
email in a description publishes a student's address.

    python ../.cursor/skills/scraping-club-events/scripts/validate_adapter.py sop_events
    python ../.cursor/skills/scraping-club-events/scripts/validate_adapter.py sop_events --limit 50

Exit code is 0 when every check passes, 1 otherwise.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[4] / "backend"
if _BACKEND.is_dir() and str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.services.event_sources.base import (  # noqa: E402
    CAMPUS_TZ,
    find_contacts,
    safe_console,
)
from app.services.event_sources.runner import (  # noqa: E402
    MAX_HORIZON_DAYS,
    RunResult,
    load_adapter,
    stage,
)
from app.services.extraction import decide_status  # noqa: E402

_PASS, _FAIL, _WARN = "PASS", "FAIL", "WARN"


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str]] = []

    def add(self, outcome: str, check: str, detail: str = "") -> None:
        self.rows.append((outcome, check, detail))

    @property
    def failed(self) -> bool:
        return any(outcome == _FAIL for outcome, _, _ in self.rows)

    def render(self) -> str:
        lines = []
        for outcome, check, detail in self.rows:
            lines.append(f"  [{outcome}] {check}")
            if detail:
                for line in detail.splitlines():
                    lines.append(f"         {line}")
        return "\n".join(lines)


def _sample(items: list[str], cap: int = 5) -> str:
    shown = items[:cap]
    if len(items) > cap:
        shown.append(f"... and {len(items) - cap} more")
    return "\n".join(shown)


def validate(source: str, limit: int | None) -> Report:
    report = Report()
    module = load_adapter(source)

    if not isinstance(getattr(module, "SOURCE_NAME", None), str) or not module.SOURCE_NAME:
        report.add(_FAIL, "SOURCE_NAME is a non-empty string")
        return report
    report.add(_PASS, f"contract: SOURCE_NAME = {module.SOURCE_NAME!r}")

    fetched = module.fetch(limit=limit)
    if not fetched:
        report.add(
            _FAIL,
            "fetch() returned events",
            "Nothing came back. Either the endpoint changed, it needs headers the\n"
            "adapter is not sending, or the date filter excluded everything.",
        )
        return report
    report.add(_PASS, f"fetch() returned {len(fetched)} events")

    # Required fields. A missing club name is fatal rather than cosmetic: every
    # club must carry an outcome to have an edge in the graph, and an event with
    # no club would only create a junk placeholder row.
    missing = [
        f"{event.title or '<no title>'}: missing "
        + ", ".join(
            name
            for name, value in (("title", event.title), ("club_name_guess", event.club_name_guess))
            if not (value or "").strip()
        )
        for event in fetched
        if not (event.title or "").strip() or not (event.club_name_guess or "").strip()
    ]
    if missing:
        report.add(_FAIL, "every event has a title and a club", _sample(missing))
    else:
        report.add(_PASS, "every event has a title and a club")

    # Naive UTC. A tz-aware datetime compares fine and stores fine, then displays
    # four or five hours off -- it cannot be caught by looking at the feed.
    aware = [
        f"{event.title}: start={event.start!r} carries tzinfo"
        for event in fetched
        if event.start is not None and event.start.tzinfo is not None
    ]
    if aware:
        report.add(
            _FAIL,
            "starts are naive UTC",
            _sample(aware) + "\nUse base.to_utc() rather than parsing dates directly.",
        )
    else:
        report.add(_PASS, "starts are naive UTC")

    confidence_errors = [
        f"{event.title}: confidence={event.confidence!r}"
        for event in fetched
        if not isinstance(event.confidence, (int, float)) or not 0.0 <= event.confidence <= 1.0
    ]
    if confidence_errors:
        report.add(_FAIL, "confidence is within 0-1", _sample(confidence_errors))
    else:
        report.add(_PASS, "confidence is within 0-1")

    # Contact details. Checked on the raw fetch output, before the runner's
    # backstop scrub, because the fix is for the adapter to stop reading the
    # organizer block -- not to rely on the scrub catching it.
    leaks = []
    for event in fetched:
        for attr in ("title", "description", "location"):
            found = find_contacts(getattr(event, attr))
            if found:
                leaks.append(f"{event.title}: {attr} contains {', '.join(found)}")
    if leaks:
        report.add(
            _FAIL,
            "no organizer emails or phone numbers",
            _sample(leaks)
            + "\nCLAUDE.md: event-organizer contacts must never reach a column.\n"
            "Stop mapping the organizer's email/phone fields.",
        )
    else:
        report.add(_PASS, "no organizer emails or phone numbers")

    # Dedupe key. A warning, not a failure: the runner still catches most repeats
    # on club + start + title, but every run will re-examine every record.
    keyless = [event.title for event in fetched if not (event.external_id or event.source_url)]
    if keyless:
        report.add(
            _WARN,
            f"{len(keyless)} events have no external_id or source_url",
            _sample(keyless) + "\nWithout a key these re-ingest on every run.",
        )
    else:
        report.add(_PASS, "every event carries a dedupe key")

    # Staging: what the runner would actually keep.
    now_utc = datetime.now(CAMPUS_TZ).astimezone(timezone.utc).replace(tzinfo=None)
    result = RunResult(source=module.SOURCE_NAME, fetched=len(fetched))
    staged = stage(list(fetched), result, now_utc)

    still_past = [
        f"{event.title} ({event.start})"
        for event in staged
        if event.start is not None and event.start < now_utc - timedelta(hours=3)
    ]
    if still_past:
        report.add(_FAIL, "no past events survive staging", _sample(still_past))
    else:
        report.add(_PASS, "no past events survive staging")

    if result.skipped_past:
        report.add(
            _WARN,
            f"{len(result.skipped_past)} past events were fetched then discarded",
            _sample(result.skipped_past)
            + "\nIf the endpoint takes a start-date parameter, pass it so the\n"
            "archive stays on the server.",
        )

    if result.skipped_horizon:
        report.add(
            _WARN,
            f"{len(result.skipped_horizon)} events are beyond the {MAX_HORIZON_DAYS}-day horizon",
            _sample(result.skipped_horizon) + "\nUsually a misparsed year.",
        )

    if not staged:
        report.add(
            _FAIL,
            "at least one event survives staging",
            "Everything was filtered out, so this adapter would write nothing.",
        )
        return report

    publishable = [
        event
        for event in staged
        if decide_status(event.title, event.start, event.confidence, event.has_time)
        == "published"
    ]
    review_count = len(staged) - len(publishable)
    report.add(
        _PASS,
        f"staging keeps {len(staged)} events: "
        f"{len(publishable)} publishable, {review_count} to review",
    )
    if staged and not publishable:
        report.add(
            _WARN,
            "nothing would reach the live feed",
            "Every event is missing a start, a time of day, or confidence.\n"
            "Check whether the source states start times and the adapter reads them.",
        )

    return report


def main() -> None:
    safe_console()
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("source", help="Adapter module name, e.g. sop_events")
    parser.add_argument(
        "--limit", type=int, default=25, help="Events to fetch for the check (default: 25)"
    )
    args = parser.parse_args()

    print(f"Validating adapter {args.source!r} (limit {args.limit})\n")
    report = validate(args.source, args.limit)
    print(report.render())

    if report.failed:
        print("\nFAILED -- fix the above before running the adapter for real.")
        raise SystemExit(1)
    print(
        "\nPassed. Write rows with:\n"
        f"  python -m app.services.event_sources.runner {args.source} --dry-run"
    )


if __name__ == "__main__":
    main()
