"""
Demo seed data — creates a single demo user with:
  - default preferences
  - a full daily routine (12 blocks)
  - one sample one-time task for today
  - two sample debt records

Calling seed_demo_user() is idempotent: it returns the existing user if one
with the demo email already exists.
"""
from datetime import date, datetime
from typing import Optional

from sqlmodel import Session, select

from ..models.debt import RoutineDebt
from ..models.routine import RoutineBlock
from ..models.task import OneTimeTask
from ..models.user import User, UserPreferences

DEMO_EMAIL = "demo@routineplanner.app"
DEMO_NAME = "Demo User"


def seed_demo_user(session: Session) -> User:
    """Create (or retrieve) the demo user and all associated seed data."""
    existing: Optional[User] = session.exec(
        select(User).where(User.email == DEMO_EMAIL)
    ).first()
    if existing:
        return existing

    # ── User ──────────────────────────────────────────────────────────────────
    user = User(email=DEMO_EMAIL, name=DEMO_NAME)
    session.add(user)
    session.flush()  # populate user.id

    # ── Preferences ───────────────────────────────────────────────────────────
    prefs = UserPreferences(
        user_id=user.id,
        planned_wake_time="07:00",
        planned_sleep_time="22:30",
        min_sleep_minutes=450,        # 7.5 hours
        notification_preference="standard",
        recovery_mode_default="balanced",
        buffer_minutes=5,
        max_recovery_minutes_per_day=90,
    )
    session.add(prefs)

    # ── Routine blocks ────────────────────────────────────────────────────────
    routine: list[RoutineBlock] = [
        RoutineBlock(
            user_id=user.id,
            title="Wake Up",
            start_time="07:00",
            end_time="07:10",
            priority="critical",
            is_fixed=True,
            can_shift=False,
            can_compress=False,
            can_skip=False,
            recover_if_missed=False,
            sort_order=0,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Morning Routine",
            start_time="07:10",
            end_time="07:40",
            priority="high",
            is_fixed=False,
            can_shift=True,
            can_compress=True,
            min_duration_minutes=15,
            can_skip=False,
            recover_if_missed=False,
            sort_order=1,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Breakfast",
            start_time="07:40",
            end_time="08:00",
            priority="high",
            is_fixed=False,
            can_shift=True,
            can_compress=False,
            can_skip=False,
            recover_if_missed=False,
            sort_order=2,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Deep Study",
            start_time="08:00",
            end_time="10:00",
            priority="critical",
            is_fixed=False,
            can_shift=True,
            can_compress=True,
            min_duration_minutes=60,
            can_skip=False,
            recover_if_missed=True,
            sort_order=3,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Break",
            start_time="10:00",
            end_time="10:15",
            priority="low",
            is_fixed=False,
            can_shift=True,
            can_compress=False,
            can_skip=True,
            recover_if_missed=False,
            sort_order=4,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Study / Work",
            start_time="10:15",
            end_time="12:30",
            priority="high",
            is_fixed=False,
            can_shift=True,
            can_compress=True,
            min_duration_minutes=60,
            can_skip=False,
            recover_if_missed=True,
            sort_order=5,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Lunch",
            start_time="12:30",
            end_time="13:15",
            priority="high",
            is_fixed=False,
            can_shift=True,
            can_compress=False,
            can_skip=False,
            recover_if_missed=False,
            sort_order=6,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Personal Project",
            start_time="13:15",
            end_time="15:15",
            priority="high",
            is_fixed=False,
            can_shift=True,
            can_compress=True,
            min_duration_minutes=30,
            can_skip=False,
            recover_if_missed=True,
            sort_order=7,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Gym",
            start_time="17:30",
            end_time="18:30",
            priority="medium",
            is_fixed=False,
            can_shift=True,
            can_compress=False,
            can_skip=True,
            recover_if_missed=True,
            sort_order=8,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Dinner",
            start_time="19:30",
            end_time="20:00",
            priority="high",
            is_fixed=False,
            can_shift=True,
            can_compress=False,
            can_skip=False,
            recover_if_missed=False,
            sort_order=9,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Night Routine",
            start_time="22:00",
            end_time="22:30",
            priority="high",
            is_fixed=False,
            can_shift=True,
            can_compress=True,
            min_duration_minutes=15,
            can_skip=False,
            recover_if_missed=False,
            sort_order=10,
        ),
        RoutineBlock(
            user_id=user.id,
            title="Sleep",
            start_time="22:30",
            end_time="07:00",  # overnight — generator adds +1 day
            priority="critical",
            is_fixed=True,
            can_shift=False,
            can_compress=False,
            can_skip=False,
            recover_if_missed=False,
            sort_order=11,
        ),
    ]
    for rb in routine:
        session.add(rb)

    # ── Sample one-time task for today ────────────────────────────────────────
    session.add(
        OneTimeTask(
            user_id=user.id,
            title="Complete Assignment",
            date=date.today(),
            duration_minutes=120,
            timing_type="flexible",
            priority="high",
            notes="Due end of day",
        )
    )

    # ── Sample routine debt ───────────────────────────────────────────────────
    session.add(
        RoutineDebt(
            user_id=user.id,
            category="Study",
            minutes_owed=45.0,
            minutes_recovered=0.0,
            status="pending",
        )
    )
    session.add(
        RoutineDebt(
            user_id=user.id,
            category="Gym",
            minutes_owed=60.0,
            minutes_recovered=0.0,
            status="pending",
        )
    )

    session.commit()
    session.refresh(user)
    return user
