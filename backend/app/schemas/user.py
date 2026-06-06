import datetime as dt
from typing import Optional

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    email: str
    name: str


class UserRegister(BaseModel):
    name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserRegisterRequest(BaseModel):
    """Minimal registration — just a display name. Email is auto-generated."""
    name: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    api_key: str
    created_at: dt.datetime


class UserPreferencesUpdate(BaseModel):
    planned_wake_time: Optional[str] = None
    planned_sleep_time: Optional[str] = None
    min_sleep_minutes: Optional[int] = None
    notification_preference: Optional[str] = None
    recovery_mode_default: Optional[str] = None
    buffer_minutes: Optional[int] = None
    max_recovery_minutes_per_day: Optional[int] = None


class UserPreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    planned_wake_time: str
    planned_sleep_time: str
    min_sleep_minutes: int
    notification_preference: str
    recovery_mode_default: str
    buffer_minutes: int
    max_recovery_minutes_per_day: int
    created_at: dt.datetime
    updated_at: dt.datetime
