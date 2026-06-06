import datetime as dt
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class DailyReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: dt.date
    completion_rate: float
    completed_count: int
    missed_count: int
    delayed_count: int
    skipped_count: int
    debt_added_minutes: float
    debt_cleared_minutes: float
    sleep_summary: Optional[str]
    missed_blocks: Optional[str]
    reviewed_at: dt.datetime


class ReviewSummary(BaseModel):
    """Richer response with parsed JSON fields for API consumers."""
    id: int
    user_id: int
    date: dt.date
    completion_rate: float
    completed_count: int
    missed_count: int
    delayed_count: int
    skipped_count: int
    debt_added_minutes: float
    debt_cleared_minutes: float
    sleep_summary: Optional[Dict[str, Any]] = None
    missed_blocks: Optional[List[Any]] = None
    reviewed_at: dt.datetime
