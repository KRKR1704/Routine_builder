"""
Adaptive Daily Routine Recovery Planner — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import create_db_and_tables

# ── Import all models so SQLModel.metadata is fully populated before
#    create_db_and_tables() is called in the lifespan hook. ──────────────────
from .models import (  # noqa: F401
    DailyReview,
    DailySchedule,
    OneTimeTask,
    PowerNap,
    RecoveryBlock,
    RoutineBlock,
    RoutineDebt,
    ScheduleBlock,
    SleepLog,
    User,
    UserPreferences,
)

from .api.routes import (
    auth,
    debt,
    health,
    recovery,
    reviews,
    routines,
    schedules,
    sleep,
    tasks,
    users,
)
from .api.routes.users import public_router as users_public_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup (SQLite dev mode)."""
    create_db_and_tables()
    yield


app = FastAPI(
    title="Adaptive Daily Routine Recovery Planner API",
    description=(
        "V1 backend for tracking daily routines, routine debt, "
        "and multi-day recovery plans."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# TODO: Replace wildcard with explicit origins before production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:19006",
        "http://localhost:3000",
        "exp://localhost",
        "*",  # development convenience — remove in prod
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
prefix = settings.API_V1_PREFIX

app.include_router(health.router, prefix=prefix, tags=["health"])
app.include_router(auth.router, prefix=prefix, tags=["auth"])
app.include_router(users_public_router, prefix=prefix, tags=["users"])
app.include_router(users.router, prefix=prefix, tags=["users"])
app.include_router(routines.router, prefix=prefix, tags=["routines"])
app.include_router(tasks.router, prefix=prefix, tags=["tasks"])
app.include_router(schedules.router, prefix=prefix, tags=["schedules"])
app.include_router(sleep.router, prefix=prefix, tags=["sleep"])
app.include_router(debt.router, prefix=prefix, tags=["debt"])
app.include_router(recovery.router, prefix=prefix, tags=["recovery"])
app.include_router(reviews.router, prefix=prefix, tags=["reviews"])


@app.get("/", tags=["root"])
def root():
    return {
        "app": "Adaptive Daily Routine Recovery Planner API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": f"{prefix}/health",
    }
