import datetime as dt
import uuid
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    password_hash: Optional[str] = Field(default=None)
    api_key: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        unique=True,
        index=True,
    )
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class UserPreferences(SQLModel, table=True):
    __tablename__ = "user_preferences"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True)

    # Time-of-day strings in "HH:MM" 24-hour format
    planned_wake_time: str = Field(default="07:00")
    planned_sleep_time: str = Field(default="22:30")

    min_sleep_minutes: int = Field(default=450)  # 7.5 h
    # essential_only | standard | detailed | silent
    notification_preference: str = Field(default="standard")
    # light | balanced | aggressive
    recovery_mode_default: str = Field(default="balanced")
    buffer_minutes: int = Field(default=5)
    max_recovery_minutes_per_day: int = Field(default=90)

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
