import datetime as dt
from typing import Optional

from sqlmodel import Field, SQLModel


class SleepLog(SQLModel, table=True):
    __tablename__ = "sleep_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    date: dt.date  # calendar date of the night's sleep

    planned_sleep_time: Optional[str] = Field(default=None)   # "HH:MM"
    actual_sleep_time: Optional[str] = Field(default=None)    # "HH:MM"
    planned_wake_time: Optional[str] = Field(default=None)    # "HH:MM"
    actual_wake_time: Optional[str] = Field(default=None)     # "HH:MM"

    sleep_duration_minutes: Optional[int] = Field(default=None)
    wake_delay_minutes: Optional[int] = Field(default=None)   # positive = woke up late

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class PowerNap(SQLModel, table=True):
    __tablename__ = "power_naps"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    date: dt.date

    start_time: str              # "HH:MM"
    end_time: Optional[str] = Field(default=None)   # "HH:MM"
    duration_minutes: Optional[int] = Field(default=None)
    note: Optional[str] = Field(default=None)

    # none | minor | schedule_adjustment_suggested
    impact_level: str = Field(default="none")

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
