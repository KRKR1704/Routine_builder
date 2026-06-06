import json
from datetime import date, datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ...database import get_session
from ...models.review import DailyReview
from ...schemas.review import ReviewSummary
from ...services.review_service import generate_daily_review
from ..deps import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/users/{user_id}/review", response_model=ReviewSummary)
def get_review(
    user_id: int,
    session: SessionDep,
    date: Optional[date] = Query(default=None),
):
    target = date or datetime.utcnow().date()
    review = session.exec(
        select(DailyReview).where(
            DailyReview.user_id == user_id,
            DailyReview.date == target,
        )
    ).first()
    if not review:
        raise HTTPException(
            status_code=404,
            detail="No review found for that date. POST to /review/daily to generate one.",
        )
    return _review_to_summary(review)


@router.post("/users/{user_id}/review/daily", response_model=ReviewSummary)
def create_daily_review(
    user_id: int,
    session: SessionDep,
    date: Optional[date] = Query(default=None),
):
    """Generate (or regenerate) the daily review for a user."""
    target = date or datetime.utcnow().date()
    data = generate_daily_review(user_id, target, session)

    # Re-fetch to return a validated ORM object
    review = session.exec(
        select(DailyReview).where(
            DailyReview.user_id == user_id,
            DailyReview.date == target,
        )
    ).first()
    return _review_to_summary(review)


def _review_to_summary(review: DailyReview) -> ReviewSummary:
    sleep_summary = None
    if review.sleep_summary:
        try:
            sleep_summary = json.loads(review.sleep_summary)
        except (json.JSONDecodeError, TypeError):
            sleep_summary = None

    missed_blocks = None
    if review.missed_blocks:
        try:
            missed_blocks = json.loads(review.missed_blocks)
        except (json.JSONDecodeError, TypeError):
            missed_blocks = None

    return ReviewSummary(
        id=review.id,
        user_id=review.user_id,
        date=review.date,
        completion_rate=review.completion_rate,
        completed_count=review.completed_count,
        missed_count=review.missed_count,
        delayed_count=review.delayed_count,
        skipped_count=review.skipped_count,
        debt_added_minutes=review.debt_added_minutes,
        debt_cleared_minutes=review.debt_cleared_minutes,
        sleep_summary=sleep_summary,
        missed_blocks=missed_blocks,
        reviewed_at=review.reviewed_at,
    )
