import datetime as dt
from typing import Optional

from pydantic import BaseModel, ConfigDict


class OneTimeTaskCreate(BaseModel):
    title: str
    date: dt.date
    duration_minutes: int
    deadline_time: Optional[str] = None
    timing_type: str = "flexible"
    fixed_start_time: Optional[str] = None
    priority: str = "medium"
    can_split: bool = False
    notes: Optional[str] = None


class OneTimeTaskUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[dt.date] = None
    duration_minutes: Optional[int] = None
    deadline_time: Optional[str] = None
    timing_type: Optional[str] = None
    fixed_start_time: Optional[str] = None
    priority: Optional[str] = None
    can_split: Optional[bool] = None
    notes: Optional[str] = None


class OneTimeTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    date: dt.date
    duration_minutes: int
    deadline_time: Optional[str]
    timing_type: str
    fixed_start_time: Optional[str]
    priority: str
    can_split: bool
    notes: Optional[str]
    created_at: dt.datetime
    updated_at: dt.datetime
