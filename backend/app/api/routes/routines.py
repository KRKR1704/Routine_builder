import datetime as dt
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...database import get_session
from ...models.routine import RoutineBlock
from ...schemas.routine import RoutineBlockCreate, RoutineBlockRead, RoutineBlockUpdate
from ..deps import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/users/{user_id}/routine/blocks", response_model=List[RoutineBlockRead])
def list_routine_blocks(user_id: int, session: SessionDep):
    blocks = session.exec(
        select(RoutineBlock)
        .where(RoutineBlock.user_id == user_id)
        .order_by(RoutineBlock.sort_order, RoutineBlock.start_time)  # type: ignore[arg-type]
    ).all()
    return list(blocks)


@router.post(
    "/users/{user_id}/routine/blocks",
    response_model=RoutineBlockRead,
    status_code=201,
)
def create_routine_block(
    user_id: int, body: RoutineBlockCreate, session: SessionDep
):
    block = RoutineBlock(user_id=user_id, **body.model_dump())
    session.add(block)
    session.commit()
    session.refresh(block)
    return block


@router.put("/routine/blocks/{block_id}", response_model=RoutineBlockRead)
def update_routine_block(
    block_id: int, body: RoutineBlockUpdate, session: SessionDep
):
    block = session.get(RoutineBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Routine block not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(block, field, value)
    block.updated_at = dt.datetime.utcnow()

    session.add(block)
    session.commit()
    session.refresh(block)
    return block


@router.delete("/routine/blocks/{block_id}", status_code=204)
def delete_routine_block(block_id: int, session: SessionDep):
    block = session.get(RoutineBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Routine block not found")
    session.delete(block)
    session.commit()
