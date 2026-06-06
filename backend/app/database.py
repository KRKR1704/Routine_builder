from sqlmodel import SQLModel, Session, create_engine

from .config import settings

# SQLite requires check_same_thread=False for use with FastAPI's async workers.
# For PostgreSQL this dict should be empty (handled via psycopg2 defaults).
_connect_args: dict = {}
if "sqlite" in settings.DATABASE_URL:
    _connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    echo=(settings.APP_ENV == "development"),
    connect_args=_connect_args,
)


def create_db_and_tables() -> None:
    """Create all SQL tables whose models have been imported into the process."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency — yields a database session per request."""
    with Session(engine) as session:
        yield session
