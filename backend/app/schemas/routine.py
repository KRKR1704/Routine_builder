import datetime as dt
from typing import Optional

from pydantic import BaseModel, ConfigDict


class RoutineBlockCreate(BaseModel):
    title: str
    start_time: str                        # "HH:MM"
    end_time: str                          # "HH:MM"
    priority: str = "medium"
    is_fixed: bool = True
    can_shift: bool = False
    can_compress: bool = False
    min_duration_minutes: int = 0
    can_skip: bool = False
    recover_if_missed: bool = False
    reminder_offset_minutes: int = 10
    sort_order: int = 0


class RoutineBlockUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    priority: Optional[str] = None
    is_fixed: Optional[bool] = None
    can_shift: Optional[bool] = None
    can_compress: Optional[bool] = None
    min_duration_minutes: Optional[int] = None
    can_skip: Optional[bool] = None
    recover_if_missed: Optional[bool] = None
    reminder_offset_minutes: Optional[int] = None
    sort_order: Optional[int] = None


class RoutineBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    start_time: str
    end_time: str
    priority: str
    is_fixed: bool
    can_shift: bool
    can_compress: bool
    min_duration_minutes: int
    can_skip: bool
    recover_if_missed: bool
    reminder_offset_minutes: int
    sort_order: int
    created_at: dt.datetime
    updated_at: dt.datetime
