import datetime as dt
from typing import Optional

from sqlmodel import Field, SQLModel


class RecoveryBlock(SQLModel, table=True):
    __tablename__ = "recovery_blocks"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    debt_id: int = Field(foreign_key="routine_debt.id")
    # schedule_id is nullable — a recovery block may not yet be on a day's schedule
    schedule_id: Optional[int] = Field(default=None, foreign_key="daily_schedules.id")

    planned_start: dt.datetime
    planned_end: dt.datetime

    # scheduled | completed | skipped
    status: str = Field(default="scheduled")
    minutes_recovered: float = Field(default=0.0)

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
