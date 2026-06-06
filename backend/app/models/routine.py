import datetime as dt
from typing import Optional

from sqlmodel import Field, SQLModel


class RoutineBlock(SQLModel, table=True):
    __tablename__ = "routine_blocks"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    title: str
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM"

    # critical | high | medium | low
    priority: str = Field(default="medium")

    is_fixed: bool = Field(default=True)
    can_shift: bool = Field(default=False)
    can_compress: bool = Field(default=False)
    min_duration_minutes: int = Field(default=0)
    can_skip: bool = Field(default=False)
    recover_if_missed: bool = Field(default=False)
    reminder_offset_minutes: int = Field(default=10)
    sort_order: int = Field(default=0)

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
