"""
Shared pytest fixtures.

Every test function gets a fresh in-memory SQLite database so tests are
fully isolated and do not touch the development routine_recovery.db file.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

# Importing app.main registers all models with SQLModel.metadata
from app.main import app
from app.database import get_session  # noqa: F401 — imported for override key
from app.api.deps import verify_api_key  # noqa: F401 — imported for override key


@pytest.fixture(name="engine", scope="function")
def engine_fixture():
    """In-memory SQLite engine — isolated per test."""
    _engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(_engine)
    yield _engine
    SQLModel.metadata.drop_all(_engine)


@pytest.fixture(name="session", scope="function")
def session_fixture(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client", scope="function")
def client_fixture(session: Session):
    def _override_session():
        yield session

    def _skip_auth():
        """No-op: bypass API key validation in tests."""
        return None

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[verify_api_key] = _skip_auth
    # Do NOT use 'with TestClient(app)' — that triggers the lifespan and
    # calls create_db_and_tables() on the *file-based* dev engine instead
    # of our in-memory engine.
    client = TestClient(app, raise_server_exceptions=True)
    yield client
    app.dependency_overrides.clear()
