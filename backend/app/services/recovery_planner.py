"""
Recovery plan generator.

generate_recovery_plan(user_id, mode, session)
  1. Load all pending/partial RoutineDebt records.
  2. Look ahead 7 days.
  3. For each future day, load or draft a DailySchedule.
  4. Find free slots (respecting buffer time and sleep window).
  5. Insert RecoveryBlock rows until the daily cap or debt is exhausted.
  6. Return the list of recovery blocks plus any unresolved debt warning.
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlmodel import Session, select

from ..models.debt import RoutineDebt
from ..models.recovery import RecoveryBlock
from ..models.schedule import DailySchedule, ScheduleBlock
from ..models.user import UserPreferences
from .conflict_detector import find_free_slots
from .schedule_generator import generate_schedule
from .time_utils import hhmm_to_dt

_DAILY_CAP: Dict[str, float] = {
    "light": 45.0,
    "balanced": 90.0,
    "aggressive": 150.0,
}

# Minimum recovery block duration (minutes)
_MIN_BLOCK = 10.0


def _load_prefs(user_id: int, session: Session) -> UserPreferences:
    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()
    return prefs or UserPreferences(user_id=user_id)


def _get_or_create_schedule(
    user_id: int, target_date: date, session: Session
) -> DailySchedule:
    """Return existing schedule or generate a draft one for *target_date*."""
    existing = session.exec(
        select(DailySchedule).where(
            DailySchedule.user_id == user_id,
            DailySchedule.date == target_date,
        )
    ).first()
    if existing:
        return existing
    result = generate_schedule(user_id, target_date, session)
    return result["schedule"]


def _blocks_for_schedule(schedule_id: int, session: Session) -> List[ScheduleBlock]:
    return list(
        session.exec(
            select(ScheduleBlock).where(ScheduleBlock.schedule_id == schedule_id)
        ).all()
    )


def generate_recovery_plan(
    user_id: int,
    mode: str,
    session: Session,
) -> Dict[str, Any]:
    """
    Generate a multi-day recovery plan for *user_id* using *mode*
    (light | balanced | aggressive).

    Returns:
        {
            "recovery_blocks": List[RecoveryBlock],
            "unresolved_debt": List[dict],
            "warning": str | None,
            "message": str,
        }
    """
    daily_cap = _DAILY_CAP.get(mode, _DAILY_CAP["balanced"])

    # ── Load pending debt ─────────────────────────────────────────────────────
    debts: List[RoutineDebt] = list(
        session.exec(
            select(RoutineDebt).where(
                RoutineDebt.user_id == user_id,
                RoutineDebt.status.in_(["pending", "partial"]),  # type: ignore[attr-defined]
            )
        ).all()
    )

    if not debts:
        return {
            "recovery_blocks": [],
            "unresolved_debt": [],
            "warning": None,
            "message": "No outstanding debt — nothing to recover.",
        }

    prefs = _load_prefs(user_id, session)
    today = date.today()

    # Track remaining minutes per debt
    remaining: Dict[int, float] = {
        d.id: round(d.minutes_owed - d.minutes_recovered, 1) for d in debts
    }

    created_blocks: List[RecoveryBlock] = []

    # ── Iterate over the next 7 days ──────────────────────────────────────────
    for day_offset in range(1, 8):
        target_date = today + timedelta(days=day_offset)

        # How much recovery time we can still add today
        day_remaining_cap = daily_cap

        schedule = _get_or_create_schedule(user_id, target_date, session)
        day_blocks = _blocks_for_schedule(schedule.id, session)

        day_start = hhmm_to_dt(target_date, prefs.planned_wake_time)
        day_end = hhmm_to_dt(target_date, prefs.planned_sleep_time)
        if day_end <= day_start:
            day_end += timedelta(days=1)

        free_slots = find_free_slots(day_blocks, day_start, day_end, prefs.buffer_minutes)

        for slot_start, slot_end in free_slots:
            if day_remaining_cap < _MIN_BLOCK:
                break

            slot_available = (slot_end - slot_start).total_seconds() / 60

            for debt in debts:
                debt_remaining = remaining.get(debt.id, 0.0)
                if debt_remaining < _MIN_BLOCK:
                    continue

                # How much of this slot to use for this debt
                chunk = min(debt_remaining, day_remaining_cap, slot_available)
                if chunk < _MIN_BLOCK:
                    continue

                block_end = slot_start + timedelta(minutes=chunk)
                rec_block = RecoveryBlock(
                    user_id=user_id,
                    debt_id=debt.id,
                    schedule_id=schedule.id,
                    planned_start=slot_start,
                    planned_end=block_end,
                    status="scheduled",
                    minutes_recovered=round(chunk, 1),
                )
                session.add(rec_block)
                created_blocks.append(rec_block)

                remaining[debt.id] = round(debt_remaining - chunk, 1)
                day_remaining_cap = round(day_remaining_cap - chunk, 1)
                slot_available = round(slot_available - chunk, 1)
                slot_start = block_end + timedelta(minutes=prefs.buffer_minutes)

                if day_remaining_cap < _MIN_BLOCK or slot_available < _MIN_BLOCK:
                    break

            if day_remaining_cap < _MIN_BLOCK:
                break

        # Stop early if all debt is resolved
        if all(v < _MIN_BLOCK for v in remaining.values()):
            break

    session.commit()
    # Refresh to populate IDs
    for b in created_blocks:
        session.refresh(b)

    # ── Identify unresolved debt ───────────────────────────────────────────────
    unresolved = [
        {
            "debt_id": d.id,
            "category": d.category,
            "unresolved_minutes": round(remaining.get(d.id, 0.0), 1),
        }
        for d in debts
        if remaining.get(d.id, 0.0) >= _MIN_BLOCK
    ]

    warning: Optional[str] = None
    if unresolved:
        warning = (
            "Some debt could not be scheduled within the next 7 days. "
            "Consider switching to a more aggressive recovery mode."
        )

    return {
        "recovery_blocks": created_blocks,
        "unresolved_debt": unresolved,
        "warning": warning,
        "message": f"Created {len(created_blocks)} recovery block(s) across up to 7 days.",
    }
