import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import clubs, events, recommend, upload
from app.services import dropbox_watcher


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    # The watcher runs for the life of the app. Opt out via
    # DROPBOX_WATCHER_ENABLED=0 so tests and frontend-only work don't burn Claude
    # calls on every restart -- uvicorn --reload restarts on every file save.
    watcher = None
    if settings.dropbox_watcher_enabled:
        watcher = asyncio.create_task(dropbox_watcher.watch())

    yield

    if watcher is not None:
        watcher.cancel()
        await asyncio.gather(watcher, return_exceptions=True)


app = FastAPI(title="Campus Compass API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # the real frontend, via Vite
        "http://localhost:5500",  # frontend/public/test.html served standalone
        "http://127.0.0.1:5500",  # (Node on this machine is too old for Vite 8 --
                                   #  see README; the test page bypasses it entirely)
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Everything the frontend calls lives under /api.
#
# frontend/src/lib/api.js uses baseURL "/api", and vite.config.js proxies /api to
# this server *without* rewriting the path -- so a request to /recommend arrives
# here as /api/recommend. Serving the prefix here rather than stripping it in the
# proxy means the same URLs work in production, where the frontend is on Vercel,
# the backend is elsewhere, and there is no Vite in between to do the rewriting.
API_PREFIX = "/api"

app.include_router(recommend.router, prefix=API_PREFIX)
app.include_router(clubs.router, prefix=API_PREFIX)
app.include_router(events.router, prefix=API_PREFIX)
app.include_router(upload.router, prefix=API_PREFIX)


@app.get("/health")
def health():
    """Unprefixed: this is for uptime checks and deploy probes, not the frontend."""
    return {"status": "ok"}
