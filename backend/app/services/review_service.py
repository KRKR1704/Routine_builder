"""
Daily review generator.

Computes completion stats from a day's ScheduleBlock rows, the day's
SleepLog, and net debt movement, then saves a DailyReview record.
"""
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlmodel import Session, select

from ..models.debt import RoutineDebt
from ..models.review import DailyReview
from ..models.schedule import DailySchedule, ScheduleBlock
from ..models.sleep import SleepLog


def _count_status(blocks: List[ScheduleBlock], *statuses: str) -> int:
    return sum(1 for b in blocks if b.status in statuses)


def _completion_rate(blocks: List[ScheduleBlock]) -> float:
    """Fraction of non-low-priority blocks that are completed/completed_early."""
    relevant = [b for b in blocks if b.priority != "low"]
    if not relevant:
        return 0.0
    done = _count_status(relevant, "completed", "completed_early", "partially_completed")
    return round(done / len(relevant), 4)


def generate_daily_review(
    user_id: int,
    target_date: date,
    session: Session,
) -> Dict[str, Any]:
    """
    Build (or update) the DailyReview for *user_id* on *target_date*.

    Returns the serialisable review dict.
    """
    # ── Fetch schedule ────────────────────────────────────────────────────────
    schedule: Optional[DailySchedule] = session.exec(
        select(DailySchedule).where(
            DailySchedule.user_id == user_id,
            DailySchedule.date == target_date,
        )
    ).first()

    blocks: List[ScheduleBlock] = []
    if schedule:
        blocks = list(
            session.exec(
                select(ScheduleBlock).where(ScheduleBlock.schedule_id == schedule.id)
            ).all()
        )

    # ── Stats ─────────────────────────────────────────────────────────────────
    completed_count = _count_status(blocks, "completed", "completed_early")
    missed_count = _count_status(blocks, "missed")
    delayed_count = _count_status(blocks, "delayed")
    skipped_count = _count_status(blocks, "skipped")
    completion_rate = _completion_rate(blocks)

    # ── Debt movement today ───────────────────────────────────────────────────
    day_debt_records = session.exec(
        select(RoutineDebt).where(
            RoutineDebt.user_id == user_id,
            RoutineDebt.status.in_(["pending", "partial", "cleared"]),  # type: ignore[attr-defined]
        )
    ).all()

    # "Added today": debt rows whose created_at is today's date
    debt_added = sum(
        d.minutes_owed
        for d in day_debt_records
        if d.created_at.date() == target_date
    )
    # "Cleared today": minutes_recovered accrued today (approximated via status change)
    debt_cleared = sum(
        d.minutes_recovered
        for d in day_debt_records
        if d.status == "cleared" and d.created_at.date() == target_date
    )

    # ── Sleep summary ─────────────────────────────────────────────────────────
    sleep_log: Optional[SleepLog] = session.exec(
        select(SleepLog).where(
            SleepLog.user_id == user_id,
            SleepLog.date == target_date,
        )
    ).first()

    sleep_summary: Optional[Dict[str, Any]] = None
    if sleep_log:
        sleep_summary = {
            "planned_sleep": sleep_log.planned_sleep_time,
            "actual_sleep": sleep_log.actual_sleep_time,
            "planned_wake": sleep_log.planned_wake_time,
            "actual_wake": sleep_log.actual_wake_time,
            "duration_minutes": sleep_log.sleep_duration_minutes,
            "wake_delay_minutes": sleep_log.wake_delay_minutes,
        }

    # ── Missed blocks detail ──────────────────────────────────────────────────
    missed_detail: List[Dict[str, Any]] = [
        {
            "id": b.id,
            "title": b.title,
            "planned_start": b.planned_start.isoformat(),
            "planned_end": b.planned_end.isoformat(),
            "reason": b.missed_reason,
            "recover_if_missed": b.recover_if_missed,
        }
        for b in blocks
        if b.status == "missed"
    ]

    # ── Upsert review record ──────────────────────────────────────────────────
    existing_review: Optional[DailyReview] = session.exec(
        select(DailyReview).where(
            DailyReview.user_id == user_id,
            DailyReview.date == target_date,
        )
    ).first()

    if existing_review:
        review = existing_review
    else:
        review = DailyReview(user_id=user_id, date=target_date)

    review.completion_rate = completion_rate
    review.completed_count = completed_count
    review.missed_count = missed_count
    review.delayed_count = delayed_count
    review.skipped_count = skipped_count
    review.debt_added_minutes = round(debt_added, 1)
    review.debt_cleared_minutes = round(debt_cleared, 1)
    review.sleep_summary = json.dumps(sleep_summary) if sleep_summary else None
    review.missed_blocks = json.dumps(missed_detail) if missed_detail else None
    review.reviewed_at = datetime.utcnow()

    if schedule:
        schedule.status = "reviewed"
        schedule.completion_rate = completion_rate
        session.add(schedule)

    session.add(review)
    session.commit()
    session.refresh(review)

    return {
        "id": review.id,
        "user_id": review.user_id,
        "date": review.date,
        "completion_rate": review.completion_rate,
        "completed_count": review.completed_count,
        "missed_count": review.missed_count,
        "delayed_count": review.delayed_count,
        "skipped_count": review.skipped_count,
        "debt_added_minutes": review.debt_added_minutes,
        "debt_cleared_minutes": review.debt_cleared_minutes,
        "sleep_summary": sleep_summary,
        "missed_blocks": missed_detail,
        "reviewed_at": review.reviewed_at,
    }
