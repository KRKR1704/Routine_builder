import uuid
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...database import get_session
from ...models.user import User, UserPreferences
from ...schemas.user import UserLogin, UserRead, UserRegister

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


@router.post("/auth/register", response_model=UserRead, status_code=201)
def register(body: UserRegister, session: SessionDep):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        password_hash=_hash(body.password),
        api_key=str(uuid.uuid4()),
    )
    session.add(user)
    session.flush()

    prefs = UserPreferences(user_id=user.id)
    session.add(prefs)
    session.commit()
    session.refresh(user)
    return user


@router.post("/auth/login", response_model=UserRead)
def login(body: UserLogin, session: SessionDep):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not user.password_hash or not _verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user
