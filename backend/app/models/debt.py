import datetime as dt
from typing import Optional

from sqlmodel import Field, SQLModel


class RoutineDebt(SQLModel, table=True):
    __tablename__ = "routine_debt"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    # Stored as plain int (no FK constraint) to avoid circular reference with schedule_blocks.
    schedule_block_id: Optional[int] = Field(default=None)

    category: str = Field(default="General")  # Study | Gym | Project Work | General
    minutes_owed: float
    minutes_recovered: float = Field(default=0.0)

    # pending | partial | cleared
    status: str = Field(default="pending")

    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    target_cleared_by: Optional[dt.date] = Field(default=None)
