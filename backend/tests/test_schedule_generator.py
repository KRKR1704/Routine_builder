"""Test 4: Schedule generator creates blocks from routine."""
import datetime as dt

from app.seed.demo_data import seed_demo_user
from app.services.schedule_generator import generate_schedule


def test_generate_schedule_creates_blocks(session):
    """Generating a schedule for today produces one block per routine block."""
    user = seed_demo_user(session)
    today = dt.date.today()

    result = generate_schedule(user.id, today, session)

    assert result["schedule"] is not None
    assert result["schedule"].user_id == user.id
    assert result["schedule"].date == today

    # 12 routine blocks + 1 flexible one-time task (Complete Assignment).
    # The flexible task will be placed in a free slot if one is large enough.
    blocks = result["blocks"]
    assert len(blocks) >= 12  # at minimum all routine blocks

    titles = [b.title for b in blocks]
    assert "Deep Study" in titles
    assert "Sleep" in titles


def test_generate_schedule_idempotent(session):
    """Generating twice without force_regenerate returns the same schedule id."""
    user = seed_demo_user(session)
    today = dt.date.today()

    r1 = generate_schedule(user.id, today, session)
    r2 = generate_schedule(user.id, today, session)

    assert r1["schedule"].id == r2["schedule"].id
    # Same blocks returned (by count)
    assert len(r1["blocks"]) == len(r2["blocks"])


def test_generate_schedule_force_regenerate(session):
    """force_regenerate=True keeps the same schedule row but recreates all blocks."""
    user = seed_demo_user(session)
    today = dt.date.today()

    r1 = generate_schedule(user.id, today, session)
    block_count_1 = len(r1["blocks"])

    r2 = generate_schedule(user.id, today, session, force_regenerate=True)
    block_count_2 = len(r2["blocks"])

    # Same schedule entity reused
    assert r1["schedule"].id == r2["schedule"].id
    # All blocks recreated — same count expected
    assert block_count_1 == block_count_2
    assert block_count_1 >= 12


def test_schedule_via_api(client, session):
    """GET /users/{id}/schedule/today returns a schedule with blocks."""
    user = seed_demo_user(session)
    response = client.get(f"/api/v1/users/{user.id}/schedule/today")
    assert response.status_code == 200
    data = response.json()
    assert "schedule" in data
    assert "blocks" in data
    assert len(data["blocks"]) >= 12


def test_flexible_task_placed_in_free_slot(session):
    """A flexible one-time task is placed in the first available free slot."""
    from app.models.task import OneTimeTask

    user = seed_demo_user(session)
    today = dt.date.today()

    # Add a short flexible task
    task = OneTimeTask(
        user_id=user.id,
        title="Quick Admin Task",
        date=today,
        duration_minutes=20,
        timing_type="flexible",
        priority="medium",
    )
    session.add(task)
    session.commit()

    result = generate_schedule(user.id, today, session, force_regenerate=True)
    titles = [b.title for b in result["blocks"]]
    assert "Quick Admin Task" in titles
