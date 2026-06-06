"""Test 5: Missed recoverable block creates debt."""
from datetime import date

from app.seed.demo_data import seed_demo_user
from app.services.debt_service import (
    apply_recovered_minutes,
    create_debt_from_block,
    get_debt_summary,
    infer_category,
)
from app.services.schedule_generator import generate_schedule


# ── Category inference ────────────────────────────────────────────────────────

def test_category_study():
    assert infer_category("Deep Study") == "Study"
    assert infer_category("Study / Work") == "Study"
    assert infer_category("learning session") == "Study"


def test_category_gym():
    assert infer_category("Gym") == "Gym"
    assert infer_category("Workout session") == "Gym"
    assert infer_category("Morning run") == "Gym"


def test_category_project():
    assert infer_category("Personal Project") == "Project Work"
    assert infer_category("Coding block") == "Project Work"


def test_category_general():
    assert infer_category("Lunch") == "General"
    assert infer_category("Dinner") == "General"


# ── Debt creation ─────────────────────────────────────────────────────────────

def test_missed_block_creates_debt(session):
    """Marking a recoverable block as missed via the API creates a debt row."""
    user = seed_demo_user(session)
    today = date.today()
    result = generate_schedule(user.id, today, session)

    # Find a recoverable block (Deep Study)
    recoverable = next(
        b for b in result["blocks"]
        if b.recover_if_missed and b.title == "Deep Study"
    )

    debt = create_debt_from_block(recoverable, session, user.id)
    assert debt.id is not None
    assert debt.user_id == user.id
    assert debt.category == "Study"
    assert debt.minutes_owed == 120.0  # Deep Study is 08:00–10:00 = 120 min
    assert debt.status == "pending"


def test_debt_summary(session):
    """get_debt_summary aggregates pending debt."""
    user = seed_demo_user(session)
    # Demo data seeds 2 debts: Study 45 min + Gym 60 min
    summary = get_debt_summary(user.id, session)
    assert summary["total_minutes_remaining"] == 105.0
    assert len(summary["debts"]) == 2


def test_apply_recovered_minutes_partial(session):
    """Applying partial recovery updates debt to 'partial' status."""
    user = seed_demo_user(session)
    summary = get_debt_summary(user.id, session)
    study_debt = next(d for d in summary["debts"] if d.category == "Study")

    updated = apply_recovered_minutes(study_debt.id, 20.0, session)
    assert updated.status == "partial"
    assert updated.minutes_recovered == 20.0


def test_apply_recovered_minutes_clears_debt(session):
    """Applying full recovery marks debt as 'cleared'."""
    user = seed_demo_user(session)
    summary = get_debt_summary(user.id, session)
    gym_debt = next(d for d in summary["debts"] if d.category == "Gym")

    updated = apply_recovered_minutes(gym_debt.id, 60.0, session)
    assert updated.status == "cleared"
    assert updated.minutes_recovered == 60.0


def test_block_status_missed_via_api(client, session):
    """POST /schedule/blocks/{id}/status with status=missed creates debt."""
    user = seed_demo_user(session)
    today = date.today()

    # Generate schedule
    sched_resp = client.get(f"/api/v1/users/{user.id}/schedule/today")
    blocks = sched_resp.json()["blocks"]
    deep_study = next(b for b in blocks if b["title"] == "Deep Study")

    response = client.post(
        f"/api/v1/schedule/blocks/{deep_study['id']}/status",
        json={"status": "missed", "missed_reason": "Slept in"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["block"]["status"] == "missed"
    assert data["debt_created"] is not None
    assert data["debt_created"]["category"] == "Study"
