from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ...database import get_session
from ...models.debt import RoutineDebt
from ...schemas.debt import ApplyRecoveryRequest, DebtSummary, RoutineDebtRead
from ...services.debt_service import apply_recovered_minutes, get_debt_summary
from ..deps import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/users/{user_id}/debt", response_model=DebtSummary)
def get_user_debt(user_id: int, session: SessionDep):
    """Return all pending/partial routine debt for a user."""
    summary = get_debt_summary(user_id, session)
    return DebtSummary(
        total_minutes_owed=summary["total_minutes_owed"],
        total_minutes_recovered=summary["total_minutes_recovered"],
        total_minutes_remaining=summary["total_minutes_remaining"],
        debts=[RoutineDebtRead.model_validate(d) for d in summary["debts"]],
    )


@router.post("/debt/{debt_id}/apply-recovery", response_model=RoutineDebtRead)
def apply_recovery_to_debt(
    debt_id: int, body: ApplyRecoveryRequest, session: SessionDep
):
    """
    Manually apply *minutes* of recovery time to a debt record.
    Used when saved time (early completion, free slot) is credited to debt.
    """
    try:
        debt = apply_recovered_minutes(debt_id, body.minutes, session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return debt
