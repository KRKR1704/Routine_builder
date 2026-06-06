"""Test 6 & 7: Recovery planner and power nap impact level."""
from datetime import date

from app.seed.demo_data import seed_demo_user
from app.services.recovery_planner import generate_recovery_plan


# ── Recovery planner ──────────────────────────────────────────────────────────

def test_recovery_plan_generates_blocks(session):
    """generate_recovery_plan creates RecoveryBlock rows from existing debt."""
    user = seed_demo_user(session)
    # Demo data already has 45 min Study + 60 min Gym = 105 min pending debt

    result = generate_recovery_plan(user.id, "balanced", session)

    assert result["recovery_blocks"] is not None
    assert len(result["recovery_blocks"]) > 0
    # Total recovered minutes should equal or exceed the debt
    total_recovered = sum(b.minutes_recovered for b in result["recovery_blocks"])
    assert total_recovered >= 105.0 or result["warning"] is not None


def test_recovery_plan_respects_daily_cap_light(session):
    """Light mode caps recovery at 45 min/day."""
    user = seed_demo_user(session)
    result = generate_recovery_plan(user.id, "light", session)

    # Group by date and verify no day exceeds 45 minutes
    from collections import defaultdict
    daily_totals: dict = defaultdict(float)
    for b in result["recovery_blocks"]:
        day = b.planned_start.date()
        daily_totals[day] += b.minutes_recovered

    for day, total in daily_totals.items():
        assert total <= 45.0 + 0.1, f"Day {day} exceeds 45 min cap: {total}"


def test_recovery_plan_no_debt_returns_empty(session):
    """When there is no debt, recovery plan is empty."""
    from sqlmodel import select
    from app.models.debt import RoutineDebt

    user = seed_demo_user(session)
    # Clear all debt
    debts = session.exec(select(RoutineDebt).where(RoutineDebt.user_id == user.id)).all()
    for d in debts:
        d.status = "cleared"
        session.add(d)
    session.commit()

    result = generate_recovery_plan(user.id, "balanced", session)
    assert result["recovery_blocks"] == []
    assert result["warning"] is None


def test_recovery_plan_via_api(client, session):
    """POST /users/{id}/recovery/generate returns a plan."""
    user = seed_demo_user(session)
    response = client.post(
        f"/api/v1/users/{user.id}/recovery/generate",
        json={"mode": "balanced"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "recovery_blocks" in data
    assert "message" in data


# ── Power nap impact ──────────────────────────────────────────────────────────

def test_nap_impact_none(client, session):
    """A 20-minute nap has impact_level 'none'."""
    user = seed_demo_user(session)
    today = date.today().isoformat()

    start_resp = client.post(
        f"/api/v1/users/{user.id}/naps/start",
        json={"start_time": "14:30", "date": today},
    )
    assert start_resp.status_code == 201
    nap_id = start_resp.json()["id"]

    end_resp = client.post(f"/api/v1/naps/{nap_id}/end", json={"end_time": "14:50"})
    assert end_resp.status_code == 200
    data = end_resp.json()
    assert data["duration_minutes"] == 20
    assert data["impact_level"] == "none"


def test_nap_impact_minor(client, session):
    """A 35-minute nap has impact_level 'minor'."""
    user = seed_demo_user(session)
    today = date.today().isoformat()

    start_resp = client.post(
        f"/api/v1/users/{user.id}/naps/start",
        json={"start_time": "14:00", "date": today},
    )
    nap_id = start_resp.json()["id"]

    end_resp = client.post(f"/api/v1/naps/{nap_id}/end", json={"end_time": "14:35"})
    data = end_resp.json()
    assert data["duration_minutes"] == 35
    assert data["impact_level"] == "minor"


def test_nap_impact_schedule_adjustment(client, session):
    """A 60-minute nap has impact_level 'schedule_adjustment_suggested'."""
    user = seed_demo_user(session)
    today = date.today().isoformat()

    start_resp = client.post(
        f"/api/v1/users/{user.id}/naps/start",
        json={"start_time": "13:00", "date": today},
    )
    nap_id = start_resp.json()["id"]

    end_resp = client.post(f"/api/v1/naps/{nap_id}/end", json={"end_time": "14:00"})
    data = end_resp.json()
    assert data["duration_minutes"] == 60
    assert data["impact_level"] == "schedule_adjustment_suggested"


def test_list_naps(client, session):
    """GET /users/{id}/naps returns naps for the given date."""
    user = seed_demo_user(session)
    today = date.today().isoformat()

    client.post(
        f"/api/v1/users/{user.id}/naps/start",
        json={"start_time": "15:00", "date": today},
    )

    resp = client.get(f"/api/v1/users/{user.id}/naps?date={today}")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
