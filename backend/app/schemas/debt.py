import datetime as dt
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class RoutineDebtRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    schedule_block_id: Optional[int]
    category: str
    minutes_owed: float
    minutes_recovered: float
    status: str
    created_at: dt.datetime
    target_cleared_by: Optional[dt.date]


class DebtSummary(BaseModel):
    total_minutes_owed: float
    total_minutes_recovered: float
    total_minutes_remaining: float
    debts: List[RoutineDebtRead]


class ApplyRecoveryRequest(BaseModel):
    minutes: float
