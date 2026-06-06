import datetime as dt
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Sleep Log ─────────────────────────────────────────────────────────────────

class SleepStartRequest(BaseModel):
    actual_sleep_time: str            # "HH:MM" — when the user went to sleep
    date: Optional[dt.date] = None   # defaults to today


class SleepWakeRequest(BaseModel):
    actual_wake_time: str             # "HH:MM"
    date: Optional[dt.date] = None   # defaults to today


class SleepLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: dt.date
    planned_sleep_time: Optional[str]
    actual_sleep_time: Optional[str]
    planned_wake_time: Optional[str]
    actual_wake_time: Optional[str]
    sleep_duration_minutes: Optional[int]
    wake_delay_minutes: Optional[int]
    created_at: dt.datetime
    updated_at: dt.datetime


# ── Power Nap ─────────────────────────────────────────────────────────────────

class NapStartRequest(BaseModel):
    start_time: str                       # "HH:MM"
    date: Optional[dt.date] = None        # defaults to today
    note: Optional[str] = None


class NapEndRequest(BaseModel):
    end_time: str   # "HH:MM"


class PowerNapRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: dt.date
    start_time: str
    end_time: Optional[str]
    duration_minutes: Optional[int]
    note: Optional[str]
    impact_level: str
    created_at: dt.datetime
    updated_at: dt.datetime
