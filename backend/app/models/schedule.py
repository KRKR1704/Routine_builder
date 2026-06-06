import datetime as dt
from typing import Optional

from sqlmodel import Field, SQLModel


class DailySchedule(SQLModel, table=True):
    __tablename__ = "daily_schedules"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    date: dt.date = Field(index=True)

    generated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    actual_wake_time: Optional[str] = Field(default=None)   # "HH:MM"
    actual_sleep_time: Optional[str] = Field(default=None)  # "HH:MM"
    completion_rate: float = Field(default=0.0)

    # draft | active | reviewed
    status: str = Field(default="active")


class ScheduleBlock(SQLModel, table=True):
    __tablename__ = "schedule_blocks"

    id: Optional[int] = Field(default=None, primary_key=True)
    schedule_id: int = Field(foreign_key="daily_schedules.id", index=True)

    routine_block_id: Optional[int] = Field(default=None, foreign_key="routine_blocks.id")
    one_time_task_id: Optional[int] = Field(default=None, foreign_key="one_time_tasks.id")
    # Stored as plain int (no FK constraint) to break the circular ref with recovery_blocks.
    recovery_block_id: Optional[int] = Field(default=None)

    title: str
    planned_start: dt.datetime
    planned_end: dt.datetime
    actual_start: Optional[dt.datetime] = Field(default=None)
    actual_end: Optional[dt.datetime] = Field(default=None)

    # pending | in_progress | completed | completed_early | partially_completed | missed | delayed | skipped
    status: str = Field(default="pending")
    # critical | high | medium | low
    priority: str = Field(default="medium")
    recover_if_missed: bool = Field(default=False)
    # routine | one_time | recovery
    source_type: str = Field(default="routine")
    missed_reason: Optional[str] = Field(default=None)

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
