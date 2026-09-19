# Campus Compass

A StudentOS for clubs: match students to clubs by what they actually want, show it as a
personal Obsidian-style graph, and keep it fresh by turning club posters/PDFs dropped in
Dropbox into live events via Claude.

Full spec, architecture, data model, and the 24h timeline: see [`CLAUDE.md`](./CLAUDE.md).

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
.venv/Scripts/activate        # .venv/bin/activate on macOS/Linux
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

Boilerplate only. Routers, models, and service modules are scaffolded with `TODO`s
matching the spec in `CLAUDE.md` — see the 24h timeline there for build order
(SOP sync first, then enrichment/embeddings, then `/recommend`, then the Dropbox watcher).
