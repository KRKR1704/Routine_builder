"""
Debt lifecycle: creation, summary, and recovery application.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlmodel import Session, select

from ..models.debt import RoutineDebt
from ..models.schedule import ScheduleBlock
from ..services.time_utils import block_duration_minutes


# ── Category inference ────────────────────────────────────────────────────────

_STUDY_KEYWORDS = {"study", "deep", "learn", "reading", "review", "research", "lecture"}
_GYM_KEYWORDS = {"gym", "workout", "exercise", "fitness", "run", "yoga", "training"}
_PROJECT_KEYWORDS = {"project", "coding", "code", "build", "dev", "development", "work"}


def infer_category(title: str) -> str:
    """Infer a human-readable debt category from a block title."""
    lower = title.lower()
    if any(k in lower for k in _STUDY_KEYWORDS):
        return "Study"
    if any(k in lower for k in _GYM_KEYWORDS):
        return "Gym"
    if any(k in lower for k in _PROJECT_KEYWORDS):
        return "Project Work"
    return "General"


# ── Core operations ───────────────────────────────────────────────────────────

def create_debt_from_block(
    block: ScheduleBlock,
    session: Session,
    user_id: int,
    minutes_owed: Optional[float] = None,
) -> RoutineDebt:
    """
    Create a RoutineDebt entry from a missed/partial schedule block.

    *minutes_owed* overrides the automatic duration calculation (useful for
    partially-completed blocks where only a fraction is owed).
    """
    if minutes_owed is None:
        minutes_owed = block_duration_minutes(block.planned_start, block.planned_end)

    category = infer_category(block.title)

    debt = RoutineDebt(
        user_id=user_id,
        schedule_block_id=block.id,
        category=category,
        minutes_owed=round(minutes_owed, 1),
        minutes_recovered=0.0,
        status="pending",
    )
    session.add(debt)
    session.commit()
    session.refresh(debt)
    return debt


def get_debt_summary(user_id: int, session: Session) -> Dict[str, Any]:
    """Return pending/partial debt grouped in a summary dict."""
    debts = session.exec(
        select(RoutineDebt).where(
            RoutineDebt.user_id == user_id,
            RoutineDebt.status.in_(["pending", "partial"]),  # type: ignore[attr-defined]
        )
    ).all()

    total_owed = sum(d.minutes_owed for d in debts)
    total_recovered = sum(d.minutes_recovered for d in debts)

    return {
        "total_minutes_owed": round(total_owed, 1),
        "total_minutes_recovered": round(total_recovered, 1),
        "total_minutes_remaining": round(total_owed - total_recovered, 1),
        "debts": debts,
    }


def apply_recovered_minutes(
    debt_id: int, minutes: float, session: Session
) -> RoutineDebt:
    """
    Apply *minutes* of recovery time to a debt record.
    Clamps recovered minutes to the owed amount and updates status.
    """
    debt = session.get(RoutineDebt, debt_id)
    if not debt:
        raise ValueError(f"Debt {debt_id} not found")

    debt.minutes_recovered = min(
        round(debt.minutes_recovered + minutes, 1), debt.minutes_owed
    )

    if debt.minutes_recovered >= debt.minutes_owed:
        debt.status = "cleared"
    else:
        debt.status = "partial"

    session.add(debt)
    session.commit()
    session.refresh(debt)
    return debt
