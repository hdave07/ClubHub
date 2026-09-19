"""Poll the shared Dropbox inbox folder and hand new/changed files to extraction.

Flow:
  1. files_list_folder(DROPBOX_INBOX_PATH) + cursor, or
     files_list_folder_longpoll / a ~5s poll loop.
  2. For each new entry, check IngestLog by (dropbox_file_id, content_hash)
     to avoid reprocessing.
  3. files_download the file, call extraction.extract_file().
  4. Fuzzy-match club_name_guess to an existing Club (see matcher.py).
  5. Write Event rows (status per the safety rule in extraction.py),
     embed, and log the result in IngestLog.

Uses the refresh-token (offline access) flow so the access token doesn't
All Dropbox I/O lives in dropbox_store.py; this module owns only the loop.
"""


async def watch() -> None:
    """TODO: polling loop over settings.dropbox_inbox_path.

    Use dropbox_store.list_inbox() / download_file() -- this module never talks to the
    Dropbox SDK itself.

    dropbox_store is synchronous (the SDK is requests-based, with no asyncio support),
    so every call from this loop must go through `await asyncio.to_thread(...)`.
    Calling it directly from an async def blocks the event loop and stalls every API
    request for the duration of each poll.
    """
    raise NotImplementedError
