import datetime as dt
from typing import Optional

from sqlmodel import Field, SQLModel


class OneTimeTask(SQLModel, table=True):
    __tablename__ = "one_time_tasks"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    title: str
    date: dt.date
    duration_minutes: int

    deadline_time: Optional[str] = Field(default=None)  # "HH:MM"
    # fixed | flexible
    timing_type: str = Field(default="flexible")
    fixed_start_time: Optional[str] = Field(default=None)  # "HH:MM"

    # critical | high | medium | low
    priority: str = Field(default="medium")
    can_split: bool = Field(default=False)
    notes: Optional[str] = Field(default=None)

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
