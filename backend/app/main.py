from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import clubs, events, recommend


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # TODO: kick off the Dropbox watcher as a background asyncio task here,
    # e.g. asyncio.create_task(dropbox_watcher.watch())
    yield


app = FastAPI(title="Campus Compass API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommend.router)
app.include_router(clubs.router)
app.include_router(events.router)


@app.get("/health")
def health():
    return {"status": "ok"}
