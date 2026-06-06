import datetime as dt
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ...database import get_session
from ...models.task import OneTimeTask
from ...schemas.task import OneTimeTaskCreate, OneTimeTaskRead, OneTimeTaskUpdate
from ..deps import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/users/{user_id}/tasks", response_model=List[OneTimeTaskRead])
def list_tasks(
    user_id: int,
    session: SessionDep,
    date: Optional[dt.date] = Query(default=None, description="Filter by date (YYYY-MM-DD)"),
):
    stmt = select(OneTimeTask).where(OneTimeTask.user_id == user_id)
    if date:
        stmt = stmt.where(OneTimeTask.date == date)
    stmt = stmt.order_by(OneTimeTask.date, OneTimeTask.fixed_start_time)  # type: ignore[arg-type]
    return list(session.exec(stmt).all())


@router.post("/users/{user_id}/tasks", response_model=OneTimeTaskRead, status_code=201)
def create_task(user_id: int, body: OneTimeTaskCreate, session: SessionDep):
    task = OneTimeTask(user_id=user_id, **body.model_dump())
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=OneTimeTaskRead)
def update_task(task_id: int, body: OneTimeTaskUpdate, session: SessionDep):
    task = session.get(OneTimeTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    task.updated_at = dt.datetime.utcnow()
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, session: SessionDep):
    task = session.get(OneTimeTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    session.delete(task)
    session.commit()
