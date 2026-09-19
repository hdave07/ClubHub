# Campus Compass

A StudentOS for clubs: match students to clubs by what they actually want, show it as a
personal Obsidian-style graph, and keep it fresh by turning club posters/PDFs dropped in
Dropbox into live events via Claude.

Original brainstorming doc: [`central-hub-for-clubs.md`](./central-hub-for-clubs.md).
Condensed, code-facing spec (architecture, data model, 24h timeline): see
[`CLAUDE.md`](./CLAUDE.md).

## Layout

```
frontend/   React + Vite + JavaScript (JSX) + Tailwind
backend/    FastAPI + SQLModel (SQLite) + ChromaDB + Claude API + Dropbox SDK
```

## Quickstart

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate     # .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env          # fill in ANTHROPIC_API_KEY, DROPBOX_* keys
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api -> :8000
```

## Status

Mostly boilerplate. Routers, models, and most service modules are scaffolded with `TODO`s
matching the spec in `CLAUDE.md` — see the 24h timeline there for build order
(SOP sync first, then enrichment/embeddings, then `/recommend`, then the Dropbox watcher).

**Done:** `app/services/dropbox_store.py` — all Dropbox I/O (list, download, upload, shared
links). Nothing else in the project imports the `dropbox` SDK directly. Verify your
credentials and all four OAuth scopes in one command:

```bash
cd backend && python -m app.services.dropbox_store
```

Requires `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, and `DROPBOX_REFRESH_TOKEN` in `.env` —
a refresh token from the offline-access flow, not the 4-hour token the App Console's
"Generate" button gives you. `DROPBOX_INBOX_PATH` is relative to the app folder (`/Inbox`).
