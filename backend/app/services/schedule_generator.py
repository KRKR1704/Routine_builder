"""
Core schedule generation engine.

generate_schedule(user_id, target_date, session, force_regenerate=False)
  1. Load user preferences.
  2. Load routine blocks ordered by sort_order / start_time.
  3. Convert routine blocks → ScheduleBlock rows for *target_date*.
  4. Load one-time tasks for *target_date*.
  5. Insert fixed-time one-time tasks (conflicts flagged, not silently removed).
  6. Insert flexible one-time tasks into the first large-enough free slot.
  7. Save DailySchedule + ScheduleBlocks.
  8. Return {"schedule", "blocks", "conflicts"}.
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlmodel import Session, select

from ..models.routine import RoutineBlock
from ..models.schedule import DailySchedule, ScheduleBlock
from ..models.task import OneTimeTask
from ..models.user import UserPreferences
from .conflict_detector import find_free_slots, suggest_resolution
from .time_utils import hhmm_to_dt, overnight_end


def _default_prefs(user_id: int) -> UserPreferences:
    """Return a default preferences object when none exists in DB."""
    return UserPreferences(user_id=user_id)


def _load_prefs(user_id: int, session: Session) -> UserPreferences:
    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()
    return prefs or _default_prefs(user_id)


def _routine_blocks_for_date(
    routine_blocks: List[RoutineBlock],
    target_date: date,
    schedule_id: int,
) -> List[ScheduleBlock]:
    """Convert RoutineBlock DB rows into un-saved ScheduleBlock objects."""
    result = []
    for rb in routine_blocks:
        planned_start = hhmm_to_dt(target_date, rb.start_time)
        planned_end = hhmm_to_dt(target_date, rb.end_time)
        planned_end = overnight_end(planned_start, planned_end)
        result.append(
            ScheduleBlock(
                schedule_id=schedule_id,
                routine_block_id=rb.id,
                title=rb.title,
                planned_start=planned_start,
                planned_end=planned_end,
                status="pending",
                priority=rb.priority,
                recover_if_missed=rb.recover_if_missed,
                source_type="routine",
            )
        )
    return result


def generate_schedule(
    user_id: int,
    target_date: date,
    session: Session,
    force_regenerate: bool = False,
) -> Dict[str, Any]:
    """
    Generate (or return the existing) daily schedule for *user_id* on *target_date*.

    Returns:
        {
            "schedule": DailySchedule,
            "blocks": List[ScheduleBlock],
            "conflicts": List[dict],
        }
    """
    # ── 1. Check for existing schedule ────────────────────────────────────────
    existing: Optional[DailySchedule] = session.exec(
        select(DailySchedule).where(
            DailySchedule.user_id == user_id,
            DailySchedule.date == target_date,
        )
    ).first()

    if existing and not force_regenerate:
        blocks = session.exec(
            select(ScheduleBlock)
            .where(ScheduleBlock.schedule_id == existing.id)
            .order_by(ScheduleBlock.planned_start)  # type: ignore[arg-type]
        ).all()
        return {"schedule": existing, "blocks": list(blocks), "conflicts": []}

    # ── 2. Create / reset schedule row ────────────────────────────────────────
    if existing:
        # Wipe old blocks and regenerate
        old_blocks = session.exec(
            select(ScheduleBlock).where(ScheduleBlock.schedule_id == existing.id)
        ).all()
        for b in old_blocks:
            session.delete(b)
        session.flush()
        schedule = existing
        schedule.generated_at = datetime.utcnow()
        schedule.status = "active"
        session.add(schedule)
        session.flush()
    else:
        schedule = DailySchedule(
            user_id=user_id,
            date=target_date,
            status="active",
        )
        session.add(schedule)
        session.flush()  # populate schedule.id

    # ── 3. Load preferences ───────────────────────────────────────────────────
    prefs = _load_prefs(user_id, session)

    # ── 4. Load routine blocks ────────────────────────────────────────────────
    routine_blocks = session.exec(
        select(RoutineBlock)
        .where(RoutineBlock.user_id == user_id)
        .order_by(RoutineBlock.sort_order, RoutineBlock.start_time)  # type: ignore[arg-type]
    ).all()

    schedule_blocks: List[ScheduleBlock] = _routine_blocks_for_date(
        list(routine_blocks), target_date, schedule.id
    )

    # ── 5. Load one-time tasks ────────────────────────────────────────────────
    tasks = session.exec(
        select(OneTimeTask).where(
            OneTimeTask.user_id == user_id,
            OneTimeTask.date == target_date,
        )
    ).all()

    conflicts: List[Dict[str, Any]] = []

    # Day boundaries for free-slot calculation
    day_start = hhmm_to_dt(target_date, prefs.planned_wake_time)
    day_end = hhmm_to_dt(target_date, prefs.planned_sleep_time)
    if day_end <= day_start:
        day_end += timedelta(days=1)

    # ── 6. Insert fixed-time one-time tasks ───────────────────────────────────
    for task in tasks:
        if task.timing_type != "fixed" or not task.fixed_start_time:
            continue
        task_start = hhmm_to_dt(target_date, task.fixed_start_time)
        task_end = task_start + timedelta(minutes=task.duration_minutes)

        task_block = ScheduleBlock(
            schedule_id=schedule.id,
            one_time_task_id=task.id,
            title=task.title,
            planned_start=task_start,
            planned_end=task_end,
            status="pending",
            priority=task.priority,
            recover_if_missed=False,
            source_type="one_time",
        )

        # Check for overlaps against already-planned blocks
        overlapping = [
            b for b in schedule_blocks
            if b.planned_start < task_end and task_start < b.planned_end
        ]
        for overlap in overlapping:
            conflicts.append({
                "type": "fixed_task_conflicts_routine",
                "task": task.title,
                "conflicting_block": overlap.title,
                "suggestion": suggest_resolution(task_block, overlap),
            })

        schedule_blocks.append(task_block)

    # ── 7. Insert flexible one-time tasks into free slots ─────────────────────
    for task in tasks:
        if task.timing_type != "flexible":
            continue
        free_slots = find_free_slots(
            schedule_blocks, day_start, day_end, prefs.buffer_minutes
        )
        placed = False
        for slot_start, slot_end in free_slots:
            slot_mins = (slot_end - slot_start).total_seconds() / 60
            if slot_mins >= task.duration_minutes:
                task_end = slot_start + timedelta(minutes=task.duration_minutes)
                schedule_blocks.append(
                    ScheduleBlock(
                        schedule_id=schedule.id,
                        one_time_task_id=task.id,
                        title=task.title,
                        planned_start=slot_start,
                        planned_end=task_end,
                        status="pending",
                        priority=task.priority,
                        recover_if_missed=False,
                        source_type="one_time",
                    )
                )
                placed = True
                break

        if not placed:
            conflicts.append({
                "type": "flexible_task_no_slot",
                "task": task.title,
                "duration_needed_minutes": task.duration_minutes,
                "suggestion": {
                    "option": "user_decision_required",
                    "message": (
                        f"No free slot found for '{task.title}' "
                        f"({task.duration_minutes} min). "
                        "Consider moving to another day or compressing a lower-priority block."
                    ),
                    "alternatives": [
                        "add_to_recovery",
                        "move_flexible_block",
                        "compress_low_priority_block",
                    ],
                },
            })

    # ── 8. Sort and persist ───────────────────────────────────────────────────
    schedule_blocks.sort(key=lambda b: b.planned_start)

    for b in schedule_blocks:
        session.add(b)

    session.commit()
    session.refresh(schedule)
    # Re-fetch blocks with DB-assigned IDs
    final_blocks = session.exec(
        select(ScheduleBlock)
        .where(ScheduleBlock.schedule_id == schedule.id)
        .order_by(ScheduleBlock.planned_start)  # type: ignore[arg-type]
    ).all()

    return {
        "schedule": schedule,
        "blocks": list(final_blocks),
        "conflicts": conflicts,
    }


def handle_late_wake(
    user_id: int,
    target_date: date,
    actual_wake_time: str,
    session: Session,
) -> Dict[str, Any]:
    """
    Called when the user wakes up later than planned.

    Marks every *pending* block whose planned_end is before actual_wake_time
    as 'missed'.  If the block has recover_if_missed=True its full duration is
    returned as debt_candidates for the caller to persist.

    Returns:
        {
            "affected_blocks": List[ScheduleBlock],
            "debt_candidates": List[ScheduleBlock],   # recover_if_missed=True
            "wake_delay_minutes": int,
        }
    """
    from .debt_service import create_debt_from_block
    from .time_utils import compute_wake_delay

    prefs = _load_prefs(user_id, session)
    wake_delay = compute_wake_delay(prefs.planned_wake_time, actual_wake_time)

    if wake_delay <= 0:
        return {"affected_blocks": [], "debt_candidates": [], "wake_delay_minutes": wake_delay}

    actual_wake_dt = hhmm_to_dt(target_date, actual_wake_time)

    schedule: Optional[DailySchedule] = session.exec(
        select(DailySchedule).where(
            DailySchedule.user_id == user_id,
            DailySchedule.date == target_date,
        )
    ).first()

    if not schedule:
        # Generate the schedule first
        result = generate_schedule(user_id, target_date, session)
        schedule = result["schedule"]

    blocks = session.exec(
        select(ScheduleBlock).where(
            ScheduleBlock.schedule_id == schedule.id,
            ScheduleBlock.status == "pending",
        )
    ).all()

    affected = []
    debt_candidates = []

    for b in blocks:
        if b.planned_end <= actual_wake_dt:
            b.status = "missed"
            b.missed_reason = f"Woke up {wake_delay} min late"
            b.updated_at = datetime.utcnow()
            session.add(b)
            affected.append(b)
            if b.recover_if_missed:
                debt_candidates.append(b)

    for b in debt_candidates:
        create_debt_from_block(b, session, user_id)

    session.commit()

    return {
        "affected_blocks": affected,
        "debt_candidates": debt_candidates,
        "wake_delay_minutes": wake_delay,
    }
