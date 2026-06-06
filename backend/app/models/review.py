import datetime as dt
from typing import Optional

from sqlmodel import Field, SQLModel


class DailyReview(SQLModel, table=True):
    __tablename__ = "daily_reviews"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    date: dt.date = Field(index=True)

    completion_rate: float = Field(default=0.0)
    completed_count: int = Field(default=0)
    missed_count: int = Field(default=0)
    delayed_count: int = Field(default=0)
    skipped_count: int = Field(default=0)

    debt_added_minutes: float = Field(default=0.0)
    debt_cleared_minutes: float = Field(default=0.0)

    # Stored as JSON strings
    sleep_summary: Optional[str] = Field(default=None)   # JSON text
    missed_blocks: Optional[str] = Field(default=None)   # JSON text

    reviewed_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
