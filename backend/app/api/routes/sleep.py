import datetime as dt
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ...database import get_session
from ...models.sleep import PowerNap, SleepLog
from ...models.user import UserPreferences
from ...schemas.sleep import (
    NapEndRequest,
    NapStartRequest,
    PowerNapRead,
    SleepLogRead,
    SleepStartRequest,
    SleepWakeRequest,
)
from ...services.schedule_generator import handle_late_wake
from ...services.time_utils import compute_sleep_duration, compute_wake_delay
from ..deps import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


# ── Sleep log ─────────────────────────────────────────────────────────────────

@router.post("/users/{user_id}/sleep/start", response_model=SleepLogRead)
def sleep_start(user_id: int, body: SleepStartRequest, session: SessionDep):
    """Record the time the user went to sleep."""
    target_date = body.date or dt.date.today()

    log = session.exec(
        select(SleepLog).where(
            SleepLog.user_id == user_id, SleepLog.date == target_date
        )
    ).first()

    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()

    if log is None:
        log = SleepLog(
            user_id=user_id,
            date=target_date,
            planned_sleep_time=prefs.planned_sleep_time if prefs else "22:30",
            planned_wake_time=prefs.planned_wake_time if prefs else "07:00",
        )

    log.actual_sleep_time = body.actual_sleep_time
    log.updated_at = dt.datetime.utcnow()

    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@router.post("/users/{user_id}/sleep/wake", response_model=dict)
def sleep_wake(user_id: int, body: SleepWakeRequest, session: SessionDep):
    """
    Record the actual wake-up time.
    - Calculates sleep duration and wake delay.
    - If late, marks missed blocks and creates debt automatically.
    """
    target_date = body.date or dt.date.today()

    log = session.exec(
        select(SleepLog).where(
            SleepLog.user_id == user_id, SleepLog.date == target_date
        )
    ).first()

    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()
    planned_wake = prefs.planned_wake_time if prefs else "07:00"
    planned_sleep = prefs.planned_sleep_time if prefs else "22:30"

    if log is None:
        log = SleepLog(
            user_id=user_id,
            date=target_date,
            planned_sleep_time=planned_sleep,
            planned_wake_time=planned_wake,
        )

    log.actual_wake_time = body.actual_wake_time
    log.planned_wake_time = planned_wake

    if log.actual_sleep_time:
        log.sleep_duration_minutes = compute_sleep_duration(
            log.actual_sleep_time, body.actual_wake_time
        )

    log.wake_delay_minutes = compute_wake_delay(planned_wake, body.actual_wake_time)
    log.updated_at = dt.datetime.utcnow()

    session.add(log)
    session.commit()
    session.refresh(log)

    adjustment: dict = {}
    if log.wake_delay_minutes and log.wake_delay_minutes > 0:
        adjustment = handle_late_wake(
            user_id, target_date, body.actual_wake_time, session
        )

    return {
        "sleep_log": SleepLogRead.model_validate(log),
        "wake_delay_minutes": log.wake_delay_minutes,
        "adjustment_summary": {
            "blocks_missed": len(adjustment.get("affected_blocks", [])),
            "debt_created_for": [
                b.title for b in adjustment.get("debt_candidates", [])
            ],
        },
    }


@router.get("/users/{user_id}/sleep", response_model=SleepLogRead)
def get_sleep_log(
    user_id: int,
    session: SessionDep,
    date: Optional[dt.date] = Query(default=None),
):
    target = date or dt.date.today()
    log = session.exec(
        select(SleepLog).where(
            SleepLog.user_id == user_id, SleepLog.date == target
        )
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Sleep log not found for that date")
    return log


# ── Power naps ────────────────────────────────────────────────────────────────

def _compute_nap_impact(duration_minutes: int) -> str:
    if duration_minutes <= 30:
        return "none"
    if duration_minutes <= 45:
        return "minor"
    return "schedule_adjustment_suggested"


@router.post("/users/{user_id}/naps/start", response_model=PowerNapRead, status_code=201)
def nap_start(user_id: int, body: NapStartRequest, session: SessionDep):
    """Create a power nap record with a start time."""
    target_date = body.date or dt.date.today()
    nap = PowerNap(
        user_id=user_id,
        date=target_date,
        start_time=body.start_time,
        note=body.note,
        impact_level="none",
    )
    session.add(nap)
    session.commit()
    session.refresh(nap)
    return nap


@router.post("/naps/{nap_id}/end", response_model=PowerNapRead)
def nap_end(nap_id: int, body: NapEndRequest, session: SessionDep):
    """Close a nap: set end time, compute duration and impact level."""
    nap = session.get(PowerNap, nap_id)
    if not nap:
        raise HTTPException(status_code=404, detail="Nap not found")

    nap.end_time = body.end_time
    nap.duration_minutes = compute_sleep_duration(nap.start_time, body.end_time)
    nap.impact_level = _compute_nap_impact(nap.duration_minutes)
    nap.updated_at = dt.datetime.utcnow()

    session.add(nap)
    session.commit()
    session.refresh(nap)
    return nap


@router.get("/users/{user_id}/naps", response_model=List[PowerNapRead])
def list_naps(
    user_id: int,
    session: SessionDep,
    date: Optional[dt.date] = Query(default=None),
):
    stmt = select(PowerNap).where(PowerNap.user_id == user_id)
    if date:
        stmt = stmt.where(PowerNap.date == date)
    stmt = stmt.order_by(PowerNap.date, PowerNap.start_time)  # type: ignore[arg-type]
    return list(session.exec(stmt).all())
