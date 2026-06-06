import datetime as dt
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class DailyScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: dt.date
    generated_at: dt.datetime
    actual_wake_time: Optional[str]
    actual_sleep_time: Optional[str]
    completion_rate: float
    status: str


class ScheduleBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    schedule_id: int
    routine_block_id: Optional[int]
    one_time_task_id: Optional[int]
    recovery_block_id: Optional[int]
    title: str
    planned_start: dt.datetime
    planned_end: dt.datetime
    actual_start: Optional[dt.datetime]
    actual_end: Optional[dt.datetime]
    status: str
    priority: str
    recover_if_missed: bool
    source_type: str
    missed_reason: Optional[str]
    created_at: dt.datetime
    updated_at: dt.datetime


class GenerateScheduleRequest(BaseModel):
    date: Optional[dt.date] = None   # defaults to today when omitted
    force_regenerate: bool = False


class BlockStatusUpdate(BaseModel):
    """Body for POST /schedule/blocks/{block_id}/status"""
    status: str
    actual_start: Optional[dt.datetime] = None
    actual_end: Optional[dt.datetime] = None
    actual_duration_minutes: Optional[int] = None
    time_saved_minutes: Optional[int] = None
    completed_fraction: Optional[float] = None
    no_recovery_needed: bool = False
    missed_reason: Optional[str] = None


class ScheduleResponse(BaseModel):
    schedule: DailyScheduleRead
    blocks: List[ScheduleBlockRead]
    conflicts: List[Dict[str, Any]] = []


class BlockStatusResponse(BaseModel):
    block: ScheduleBlockRead
    time_saved_minutes: Optional[int] = None
    debt_created: Optional[Dict[str, Any]] = None
    message: str = ""
