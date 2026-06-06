"""Test 1: Health endpoint returns ok."""


def test_health_returns_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_returns_app_info(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Adaptive Daily Routine Recovery Planner API" in data["app"]
    assert data["version"] == "0.1.0"
