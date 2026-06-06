"""Test 2 & 3: Demo user creation and routine block CRUD."""
from app.seed.demo_data import seed_demo_user


def test_demo_user_created(client):
    """POST /users/demo creates a demo user and returns it."""
    response = client.post("/api/v1/users/demo")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "demo@routineplanner.app"
    assert "id" in data


def test_demo_user_idempotent(client):
    """Calling /users/demo twice returns the same user."""
    r1 = client.post("/api/v1/users/demo")
    r2 = client.post("/api/v1/users/demo")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


def test_create_and_list_routine_blocks(client, session):
    """POST + GET routine blocks round-trip."""
    # Seed a user first
    user = seed_demo_user(session)

    # The seed already created 12 blocks; list them
    response = client.get(f"/api/v1/users/{user.id}/routine")
    assert response.status_code == 200
    blocks = response.json()
    assert len(blocks) == 12
    titles = [b["title"] for b in blocks]
    assert "Deep Study" in titles
    assert "Sleep" in titles


def test_create_custom_routine_block(client, session):
    """POST /users/{id}/routine/blocks creates a new block."""
    user = seed_demo_user(session)

    payload = {
        "title": "Evening Walk",
        "start_time": "20:00",
        "end_time": "20:30",
        "priority": "medium",
        "is_fixed": False,
        "can_shift": True,
        "can_compress": False,
        "min_duration_minutes": 15,
        "can_skip": True,
        "recover_if_missed": False,
        "reminder_offset_minutes": 5,
        "sort_order": 12,
    }
    response = client.post(f"/api/v1/users/{user.id}/routine/blocks", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Evening Walk"
    assert data["user_id"] == user.id


def test_update_routine_block(client, session):
    """PUT /routine/blocks/{id} updates a block field."""
    user = seed_demo_user(session)

    # Fetch the first block
    blocks_resp = client.get(f"/api/v1/users/{user.id}/routine")
    block_id = blocks_resp.json()[0]["id"]

    response = client.put(
        f"/api/v1/routine/blocks/{block_id}",
        json={"title": "Updated Title", "sort_order": 99},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"


def test_delete_routine_block(client, session):
    """DELETE /routine/blocks/{id} removes the block."""
    user = seed_demo_user(session)
    blocks_resp = client.get(f"/api/v1/users/{user.id}/routine")
    block_id = blocks_resp.json()[0]["id"]

    del_resp = client.delete(f"/api/v1/routine/blocks/{block_id}")
    assert del_resp.status_code == 204

    # Confirm it's gone
    list_resp = client.get(f"/api/v1/users/{user.id}/routine")
    ids = [b["id"] for b in list_resp.json()]
    assert block_id not in ids
