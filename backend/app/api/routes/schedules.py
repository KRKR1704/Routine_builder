import datetime as dt
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ...database import get_session
from ...models.schedule import DailySchedule, ScheduleBlock
from ...schemas.schedule import (
    BlockStatusResponse,
    BlockStatusUpdate,
    GenerateScheduleRequest,
    ScheduleBlockRead,
    ScheduleResponse,
)
from ...services.debt_service import create_debt_from_block
from ...services.schedule_generator import generate_schedule
from ...services.time_utils import block_duration_minutes
from ..deps import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/users/{user_id}/schedule/today", response_model=ScheduleResponse)
def get_today_schedule(user_id: int, session: SessionDep):
    result = generate_schedule(user_id, dt.date.today(), session)
    return ScheduleResponse(
        schedule=result["schedule"],
        blocks=result["blocks"],
        conflicts=result["conflicts"],
    )


@router.get("/users/{user_id}/schedule", response_model=ScheduleResponse)
def get_schedule(
    user_id: int,
    session: SessionDep,
    date: Optional[dt.date] = Query(default=None),
):
    target = date or dt.date.today()
    result = generate_schedule(user_id, target, session)
    return ScheduleResponse(
        schedule=result["schedule"],
        blocks=result["blocks"],
        conflicts=result["conflicts"],
    )


@router.post("/users/{user_id}/schedule/generate", response_model=ScheduleResponse)
def generate_schedule_endpoint(
    user_id: int, body: GenerateScheduleRequest, session: SessionDep
):
    target = body.date or dt.date.today()
    result = generate_schedule(user_id, target, session, force_regenerate=body.force_regenerate)
    return ScheduleResponse(
        schedule=result["schedule"],
        blocks=result["blocks"],
        conflicts=result["conflicts"],
    )


@router.post(
    "/schedule/blocks/{block_id}/status",
    response_model=BlockStatusResponse,
)
def update_block_status(
    block_id: int, body: BlockStatusUpdate, session: SessionDep
):
    """
    Update a schedule block's status and handle side-effects:
    - completed_early  → return time_saved_minutes
    - missed           → create debt if recover_if_missed
    - partially_completed → create partial debt if recover_if_missed
    - skipped          → create debt unless no_recovery_needed=True
    """
    block = session.get(ScheduleBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Schedule block not found")

    block.status = body.status
    block.updated_at = dt.datetime.utcnow()

    if body.actual_start:
        block.actual_start = body.actual_start
    if body.actual_end:
        block.actual_end = body.actual_end
    if body.missed_reason:
        block.missed_reason = body.missed_reason

    schedule = session.get(DailySchedule, block.schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    user_id = schedule.user_id

    time_saved: Optional[int] = None
    debt_info = None
    message = f"Block status updated to '{body.status}'."

    if body.status == "completed_early":
        duration = block_duration_minutes(block.planned_start, block.planned_end)
        if body.actual_duration_minutes is not None:
            time_saved = round(duration - body.actual_duration_minutes)
        elif body.time_saved_minutes is not None:
            time_saved = body.time_saved_minutes
        elif body.actual_end:
            actual_duration = block_duration_minutes(block.planned_start, body.actual_end)
            time_saved = round(duration - actual_duration)
        message = f"Completed early. {time_saved or 0} min saved."

    elif body.status == "missed" and block.recover_if_missed:
        debt = create_debt_from_block(block, session, user_id)
        debt_info = {
            "debt_id": debt.id,
            "category": debt.category,
            "minutes_owed": debt.minutes_owed,
        }
        message = f"Marked missed. {debt.minutes_owed} min added to debt."

    elif body.status == "partially_completed" and block.recover_if_missed:
        total_mins = block_duration_minutes(block.planned_start, block.planned_end)
        fraction = body.completed_fraction or 0.5
        missed_mins = total_mins * (1.0 - fraction)
        debt = create_debt_from_block(block, session, user_id, minutes_owed=missed_mins)
        debt_info = {
            "debt_id": debt.id,
            "category": debt.category,
            "minutes_owed": debt.minutes_owed,
        }
        message = f"Partially completed. {debt.minutes_owed} min added to debt."

    elif body.status == "skipped" and block.recover_if_missed and not body.no_recovery_needed:
        debt = create_debt_from_block(block, session, user_id)
        debt_info = {
            "debt_id": debt.id,
            "category": debt.category,
            "minutes_owed": debt.minutes_owed,
        }
        message = f"Skipped. {debt.minutes_owed} min added to debt."

    session.add(block)
    session.commit()
    session.refresh(block)

    return BlockStatusResponse(
        block=ScheduleBlockRead.model_validate(block),
        time_saved_minutes=time_saved,
        debt_created=debt_info,
        message=message,
    )
