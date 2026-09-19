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
expire mid-demo -- set DROPBOX_REFRESH_TOKEN in .env, not a raw token.
"""

import dropbox

from app.config import settings


def get_client() -> dropbox.Dropbox:
    return dropbox.Dropbox(
        app_key=settings.dropbox_app_key,
        app_secret=settings.dropbox_app_secret,
        oauth2_refresh_token=settings.dropbox_refresh_token,
    )


async def watch() -> None:
    """TODO: polling loop over settings.dropbox_inbox_path."""
    raise NotImplementedError
