import datetime as dt
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...database import get_session
from ...models.user import User, UserPreferences
from ...schemas.user import UserPreferencesRead, UserPreferencesUpdate, UserRead, UserRegisterRequest
from ...seed.demo_data import seed_demo_user
from ..deps import verify_api_key

# ── Public router (no auth) ────────────────────────────────────────────────────
public_router = APIRouter()

# ── Protected router (requires X-API-Key header) ───────────────────────────────
router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


@public_router.post("/users/demo", response_model=UserRead, status_code=200)
def create_or_get_demo_user(session: SessionDep):
    """
    Idempotent: return the demo user if it already exists, otherwise create it
    together with default preferences and a full demo routine.
    Returns the api_key so the client can authenticate subsequent requests.
    """
    user = seed_demo_user(session)
    return user


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: int, session: SessionDep):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users/{user_id}/preferences", response_model=UserPreferencesRead)
def get_preferences(user_id: int, session: SessionDep):
    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return prefs


@router.put("/users/{user_id}/preferences", response_model=UserPreferencesRead)
def update_preferences(
    user_id: int, body: UserPreferencesUpdate, session: SessionDep
):
    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()
    if not prefs:
        prefs = UserPreferences(user_id=user_id)
        session.add(prefs)
        session.flush()

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prefs, field, value)
    prefs.updated_at = dt.datetime.utcnow()

    session.add(prefs)
    session.commit()
    session.refresh(prefs)
    return prefs
