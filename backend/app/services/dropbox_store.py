"""Raw Dropbox I/O for the Campus Compass inbox.

Every Dropbox call in the project goes through this module -- nothing else imports
`dropbox` directly. The SDK's shapes are awkward (downloads return a tuple with a
live HTTP response, shared-link creation raises when a link already exists) and
that awkwardness should stop here rather than spread into extraction and the routers.

Two consumers:
  - dropbox_watcher.py  -- polls the inbox for files clubs drop in
  - the upload endpoint -- writes user-uploaded fliers here, then extracts

Both are synchronous callers of a synchronous SDK; see the note on asyncio below.
"""

import os
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime

import dropbox
from dropbox.exceptions import ApiError
from dropbox.files import FileMetadata, WriteMode

from app.config import settings

# Claude can read images (vision) and PDFs (native document input). Anything else in
# the inbox -- .DS_Store, stray text files -- is skipped before it costs an API call.
MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
}


@dataclass(frozen=True)
class InboxFile:
    """A file in the Dropbox inbox, reduced to what the pipeline actually needs.

    `id` and `content_hash` map onto IngestLog's dedupe key, which is what stops the
    same poster being re-sent to Claude on every poll cycle. Dropbox computes
    content_hash for us, so nothing downstream needs to hash the bytes itself.
    """

    id: str
    name: str
    path: str  # path_lower -- the stable handle for download/share calls
    content_hash: str | None  # nullable per the SDK; fall back to (id, rev)
    rev: str
    size: int
    server_modified: datetime


_client: dropbox.Dropbox | None = None


def get_client() -> dropbox.Dropbox:
    """The single Dropbox client, built from the refresh-token (offline) flow.

    Cached because each Dropbox() spins up its own requests.Session; constructing one
    per call in a poll loop churns connection pools for nothing. The refresh token is
    what keeps auth alive past the 4-hour access-token expiry, so there is exactly one
    place that can get it wrong.
    """
    global _client
    if _client is None:
        _client = dropbox.Dropbox(
            app_key=settings.dropbox_app_key,
            app_secret=settings.dropbox_app_secret,
            oauth2_refresh_token=settings.dropbox_refresh_token,
        )
    return _client


def mime_type_for(name: str) -> str | None:
    """Media type for a filename, or None if we can't process it.

    Extraction branches on this: images become an `image` content block, PDFs a
    `document` block. The mapping lives next to the allowlist that defines it.
    """
    return MIME_TYPES.get(os.path.splitext(name)[1].lower())


def is_supported(name: str) -> bool:
    return mime_type_for(name) is not None


def _to_inbox_file(entry: FileMetadata) -> InboxFile:
    return InboxFile(
        id=entry.id,
        name=entry.name,
        path=entry.path_lower,
        content_hash=entry.content_hash,
        rev=entry.rev,
        size=entry.size,
        server_modified=entry.server_modified,
    )


def list_inbox(path: str | None = None) -> list[InboxFile]:
    """Every supported file in the inbox folder.

    Entries come back as a mix of FileMetadata / FolderMetadata / DeletedMetadata, so
    isinstance is the discriminator -- folders carry no size or content_hash and would
    raise if treated as files. has_more must be followed or we'd silently see only the
    first page once the folder grows.
    """
    client = get_client()
    target = path if path is not None else settings.dropbox_inbox_path

    result = client.files_list_folder(target)
    entries = list(result.entries)
    while result.has_more:
        result = client.files_list_folder_continue(result.cursor)
        entries.extend(result.entries)

    return [
        _to_inbox_file(e)
        for e in entries
        if isinstance(e, FileMetadata) and is_supported(e.name)
    ]


def download_file(path: str) -> bytes:
    """File contents as bytes, ready to be base64'd into a Claude content block.

    files_download returns (metadata, requests.Response), not bytes, and leaks the
    connection if the response isn't closed -- hence closing(). No disk cache:
    extraction reads each file once.
    """
    _metadata, response = get_client().files_download(path)
    with closing(response):
        return response.content


def upload_file(data: bytes, filename: str, path: str | None = None) -> InboxFile:
    """Write a user-uploaded flier into the inbox and return its metadata.

    This is what keeps Dropbox the durable store and provenance layer for in-app
    uploads, not just for files clubs drop in -- so Event.dropbox_link resolves to a
    real poster either way. The returned id/content_hash let the caller write its
    IngestLog row immediately, so the watcher later finds the file already logged and
    skips it instead of re-extracting.

    autorename avoids two users' IMG_4821.jpg colliding (WriteMode.add would otherwise
    reject the second silently).
    """
    folder = path if path is not None else settings.dropbox_inbox_path
    metadata = get_client().files_upload(
        data,
        f"{folder}/{filename}",
        mode=WriteMode.add,
        autorename=True,
    )
    return _to_inbox_file(metadata)


def get_shared_link(path: str) -> str:
    """A shareable URL for a file -- the provenance link behind the "from Dropbox" badge.

    Dropbox raises rather than returning the existing link when one is already present,
    which happens on any re-process. The nested fallback is required because the error's
    metadata can be null (the SDK withholds it when custom settings might be
    incompatible). Note CreateSharedLinkWithSettingsError has no is_other().

    Anything that isn't the already-exists case re-raises: a genuine auth or path
    failure should be loud, not a mysteriously missing badge.
    """
    client = get_client()
    try:
        return client.sharing_create_shared_link_with_settings(path).url
    except ApiError as e:
        if not e.error.is_shared_link_already_exists():
            raise
        existing = e.error.get_shared_link_already_exists()
        if existing is not None and existing.is_metadata():
            return existing.get_metadata().url
        links = client.sharing_list_shared_links(path=path, direct_only=True).links
        if not links:
            raise
        return links[0].url


# A 1x1 PNG -- smallest valid image that exercises the real upload/download path.
_SMOKE_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d4944415478da63fcffff3f0300050001f8a2b1a400"
    "00000049454e44ae426082"
)


def _smoke_test() -> None:
    """Prove all four OAuth scopes in one command.

    Scope problems are silent -- a scope you forgot to grant isn't visible after the
    fact, only as a 401 the first time you need it. Better to find that now than at
    hour 9.

    Writes and deletes one temp file in your inbox.
    """
    client = get_client()
    inbox = settings.dropbox_inbox_path

    account = client.users_get_current_account()
    print(f"auth              ok   -- {account.name.display_name}")

    before = list_inbox()
    print(f"files.metadata    ok   -- {len(before)} supported file(s) in {inbox}")

    uploaded = upload_file(_SMOKE_PNG, "_smoke_test.png")
    print(f"files.content.write ok -- {uploaded.path} ({uploaded.size} bytes)")

    try:
        listed = [f for f in list_inbox() if f.id == uploaded.id]
        assert listed, "uploaded file did not appear in list_inbox()"
        assert is_supported(uploaded.name), "uploaded file classified as unsupported"
        print(f"list + filter     ok   -- mime {mime_type_for(uploaded.name)}")

        data = download_file(uploaded.path)
        assert data == _SMOKE_PNG, f"round-trip mismatch: {len(data)} bytes back"
        print(f"files.content.read ok  -- {len(data)} bytes, byte-identical")

        first = get_shared_link(uploaded.path)
        print(f"sharing.write     ok   -- {first}")

        # The branch that never runs on a first invocation, and the most likely thing
        # in this module to be wrong.
        second = get_shared_link(uploaded.path)
        assert second == first, f"fallback returned a different link:\n  {first}\n  {second}"
        print("already-exists    ok   -- fallback returned the same link")
    finally:
        client.files_delete_v2(uploaded.path)
        print("cleanup           ok   -- test file deleted")

    print("\nall four scopes confirmed")


if __name__ == "__main__":
    _smoke_test()
