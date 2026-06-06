import datetime as dt
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class RecoveryBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    debt_id: int
    schedule_id: Optional[int]
    planned_start: dt.datetime
    planned_end: dt.datetime
    status: str
    minutes_recovered: float
    created_at: dt.datetime
    updated_at: dt.datetime


class GenerateRecoveryRequest(BaseModel):
    mode: Optional[str] = None  # light | balanced | aggressive — defaults to user preference


class RecoveryPlanResponse(BaseModel):
    recovery_blocks: List[RecoveryBlockRead]
    unresolved_debt: List[Dict[str, Any]] = []
    warning: Optional[str] = None
    message: str = ""


class RecoveryBlockStatusUpdate(BaseModel):
    status: str  # completed | skipped
