from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}
engine = create_engine(settings.database_url, connect_args=connect_args)

# create_all() builds missing TABLES but never alters an existing one, and
# backend/data/campus_compass.db is checked into git -- so a teammate pulling a model
# change gets the old table and a "no such column" error on the next query. Each entry
# is an idempotent ALTER applied at startup; append here when adding a column.
_COLUMN_MIGRATIONS: dict[str, list[tuple[str, str]]] = {
    "club": [("outcomes_derived", "BOOLEAN NOT NULL DEFAULT 0")],
}


def _apply_column_migrations() -> None:
    inspector = inspect(engine)
    for table, columns in _COLUMN_MIGRATIONS.items():
        if table not in inspector.get_table_names():
            continue  # create_all() just made it with every column already present
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name, ddl in columns:
            if name in existing:
                continue
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
            print(f"[database] added {table}.{name}")


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _apply_column_migrations()


def get_session():
    with Session(engine) as session:
        yield session
