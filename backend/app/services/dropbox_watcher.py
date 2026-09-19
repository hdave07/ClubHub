"""Poll the shared Dropbox inbox and hand new files to the ingest pipeline.

This module owns only the loop. Everything it used to describe -- the IngestLog
check, download, extraction, club matching, Event rows -- lives in
ingest.process_file(), which the in-app upload endpoint also calls. One pipeline,
two entrances.

All Dropbox I/O goes through dropbox_store; this module never touches the SDK.

Change detection is "list the folder, let IngestLog decide what's new" rather
than Dropbox's cursor API. The cursor is more efficient but carries state that
can be invalidated server-side, and a cursor that silently resets during a demo
means files stop being noticed with no error. Re-listing a folder of a few dozen
files every few seconds costs one API call and cannot get out of sync.
"""

import asyncio
import logging

from sqlmodel import Session

from app.database import engine
from app.services.ingest import IngestResult, process_inbox

logger = logging.getLogger(__name__)

# The demo promises an event appears "within about 10 seconds" of a drop. Five
# leaves room for the Dropbox sync itself plus a Claude call.
POLL_INTERVAL_SECONDS = 5

# After a failed poll, back off instead of hammering a service that's already
# unhappy. Resets to POLL_INTERVAL_SECONDS on the next success.
MAX_BACKOFF_SECONDS = 60


def poll_once() -> list[IngestResult]:
    """One pass over the inbox. Synchronous; opens and closes its own session.

    A background task can't use FastAPI's Depends(get_session), and holding one
    session open across the lifetime of the loop would keep a transaction alive
    for hours. One session per poll.
    """
    with Session(engine) as session:
        return process_inbox(session)


async def watch(interval: float = POLL_INTERVAL_SECONDS) -> None:
    """Poll forever, handing new files to the ingest pipeline.

    Runs as a background asyncio task (see main.py). Three things this has to get
    right beyond "call process_inbox in a loop":

    - **Never die.** A watcher that exits on the first network blip looks
      identical to one that's working until someone drops a file and nothing
      happens. Every exception except cancellation is logged and swallowed.
    - **Never block the event loop.** process_inbox is synchronous and takes
      seconds (Dropbox + Claude), so it runs in a worker thread. Calling it
      directly here would stall every HTTP request for the duration of each poll.
    - **Shut down cleanly.** CancelledError is re-raised rather than swallowed,
      so stopping the app doesn't hang.
    """
    logger.info("Dropbox watcher started (polling every %ss)", interval)
    backoff = interval

    while True:
        try:
            results = await asyncio.to_thread(poll_once)
            backoff = interval

            # Only log when something actually happened -- a line every 5 seconds
            # saying "nothing" buries the one line that matters.
            for r in results:
                if r.status == "duplicate":
                    continue
                if r.status == "processed":
                    logger.info(
                        "Ingested %s -> %s (%d event(s), %d published)",
                        r.file.name,
                        r.club_name or "?",
                        len(r.events),
                        r.published_count,
                    )
                else:
                    logger.warning("Skipped %s: %s %s", r.file.name, r.status, r.error or "")

        except asyncio.CancelledError:
            logger.info("Dropbox watcher stopped")
            raise
        except Exception:
            logger.exception("Dropbox poll failed; retrying in %ss", backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
            continue

        await asyncio.sleep(interval)


async def _smoke_test() -> None:
    """Run the watcher for a short window so you can drop a file and watch it land.

    Writes to the database, and makes a Claude call for each new file.
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")

    seconds = 60
    print(f"Watching {'/Inbox'} for {seconds}s -- drop a poster in now.\n")
    task = asyncio.create_task(watch())
    try:
        await asyncio.sleep(seconds)
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(_smoke_test())
