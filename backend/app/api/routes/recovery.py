from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ...database import get_session
from ...models.recovery import RecoveryBlock
from ...models.user import UserPreferences
from ...schemas.recovery import (
    GenerateRecoveryRequest,
    RecoveryBlockRead,
    RecoveryBlockStatusUpdate,
    RecoveryPlanResponse,
)
from ...services.debt_service import apply_recovered_minutes
from ...services.recovery_planner import generate_recovery_plan
from ..deps import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/users/{user_id}/recovery", response_model=List[RecoveryBlockRead])
def list_recovery_blocks(
    user_id: int,
    session: SessionDep,
    status: Optional[str] = Query(default=None, description="Filter: scheduled | completed | skipped"),
):
    stmt = select(RecoveryBlock).where(RecoveryBlock.user_id == user_id)
    if status:
        stmt = stmt.where(RecoveryBlock.status == status)
    stmt = stmt.order_by(RecoveryBlock.planned_start)  # type: ignore[arg-type]
    return list(session.exec(stmt).all())


@router.post("/users/{user_id}/recovery/generate", response_model=RecoveryPlanResponse)
def generate_user_recovery_plan(
    user_id: int, body: GenerateRecoveryRequest, session: SessionDep
):
    """
    Generate a recovery plan for the next 7 days.
    Mode defaults to the user's saved preference.
    """
    # Resolve mode: use provided value or fall back to user preference
    mode = body.mode
    if not mode:
        prefs = session.exec(
            select(UserPreferences).where(UserPreferences.user_id == user_id)
        ).first()
        mode = prefs.recovery_mode_default if prefs else "balanced"

    result = generate_recovery_plan(user_id, mode, session)

    return RecoveryPlanResponse(
        recovery_blocks=[RecoveryBlockRead.model_validate(b) for b in result["recovery_blocks"]],
        unresolved_debt=result["unresolved_debt"],
        warning=result["warning"],
        message=result["message"],
    )


@router.post("/recovery/blocks/{recovery_block_id}/status", response_model=RecoveryBlockRead)
def update_recovery_block_status(
    recovery_block_id: int,
    body: RecoveryBlockStatusUpdate,
    session: SessionDep,
):
    """
    Mark a recovery block as completed or skipped.
    When completed, credits its minutes_recovered back to the related debt.
    """
    block = session.get(RecoveryBlock, recovery_block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Recovery block not found")

    block.status = body.status
    block.updated_at = datetime.utcnow()

    if body.status == "completed":
        # Credit the minutes to the originating debt
        try:
            apply_recovered_minutes(block.debt_id, block.minutes_recovered, session)
        except ValueError:
            pass  # Debt may have already been cleared — soft fail

    session.add(block)
    session.commit()
    session.refresh(block)
    return block
