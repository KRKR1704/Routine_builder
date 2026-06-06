"""
Shared FastAPI dependencies.
"""
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models.user import User


async def verify_api_key(
    session: Annotated[Session, Depends(get_session)],
    x_api_key: Annotated[Optional[str], Header()] = None,
) -> None:
    """
    Validates the X-API-Key header against the database.
    Raises 401 if the key is missing or not found.
    Used as a router-level dependency on all protected routes.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="X-API-Key header is required",
        )
    user = session.exec(
        select(User).where(User.api_key == x_api_key)
    ).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )
