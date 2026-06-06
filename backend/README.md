# Adaptive Daily Routine Recovery Planner — Backend

FastAPI backend for the V1 app. Runs locally with SQLite. Designed to be
database-agnostic so it can be pointed at PostgreSQL / Supabase later by
changing one environment variable.

---

## Tech Stack

| Layer       | Library                          |
|-------------|----------------------------------|
| Framework   | FastAPI                          |
| Server      | Uvicorn                          |
| ORM         | SQLModel (SQLAlchemy + Pydantic) |
| DB (local)  | SQLite                           |
| DB (prod)   | PostgreSQL-compatible via `DATABASE_URL` |
| Validation  | Pydantic v2                      |
| Settings    | pydantic-settings + `.env`       |
| Tests       | pytest + httpx                   |

---

## Setup

### 1 — Create a virtual environment

**Windows (PowerShell)**
```powershell
python -m venv .venv
.venv\Scripts\activate
```

**macOS / Linux**
```bash
python -m venv .venv
source .venv/bin/activate
```

### 2 — Install dependencies
```bash
pip install -r requirements.txt
```

### 3 — Configure environment
Copy the example env file and edit as needed:
```bash
cp .env.example .env
```

Default `.env` for local development:
```
DATABASE_URL=sqlite:///./routine_recovery.db
APP_ENV=development
API_V1_PREFIX=/api/v1
```

---

## Run the Server

```bash
uvicorn app.main:app --reload
```

Server starts at **http://localhost:8000**

> If port 8000 is taken, specify a different one:
> `uvicorn app.main:app --reload --port 8001`

---

## API Documentation

| URL                              | Description                       |
|----------------------------------|-----------------------------------|
| http://localhost:8000/docs       | Swagger UI (interactive)          |
| http://localhost:8000/redoc      | ReDoc (read-only)                 |
| http://localhost:8000/openapi.json | OpenAPI 3.1 schema              |

---

## Run Tests

```bash
pytest
```

Run with verbose output:
```bash
pytest -v
```

Run a specific test file:
```bash
pytest tests/test_schedule_generator.py -v
```

Tests use an **in-memory SQLite database** — they never touch `routine_recovery.db`.

---

## Quick-Start: Demo User Workflow

### 1. Create demo user (idempotent)
```bash
curl -X POST http://localhost:8000/api/v1/users/demo
```
Returns a `User` with `id`. Use this `id` in subsequent requests.

### 2. View routine blocks
```bash
curl http://localhost:8000/api/v1/users/1/routine
```

### 3. Generate today's schedule
```bash
curl -X POST http://localhost:8000/api/v1/users/1/schedule/generate \
  -H "Content-Type: application/json" \
  -d '{"force_regenerate": false}'
```

### 4. Check today's schedule
```bash
curl http://localhost:8000/api/v1/users/1/schedule/today
```

### 5. Mark a block missed
```bash
curl -X POST http://localhost:8000/api/v1/schedule/blocks/3/status \
  -H "Content-Type: application/json" \
  -d '{"status": "missed", "missed_reason": "Slept in"}'
```

### 6. View debt
```bash
curl http://localhost:8000/api/v1/users/1/debt
```

### 7. Generate a recovery plan
```bash
curl -X POST http://localhost:8000/api/v1/users/1/recovery/generate \
  -H "Content-Type: application/json" \
  -d '{"mode": "balanced"}'
```

### 8. Log wake-up time (late wake triggers debt auto-creation)
```bash
curl -X POST http://localhost:8000/api/v1/users/1/sleep/wake \
  -H "Content-Type: application/json" \
  -d '{"actual_wake_time": "08:20"}'
```

### 9. Generate daily review
```bash
curl -X POST http://localhost:8000/api/v1/users/1/review/daily
```

---

## API Endpoints Reference

```
GET    /api/v1/health
GET    /

POST   /api/v1/users/demo
GET    /api/v1/users/{user_id}
GET    /api/v1/users/{user_id}/preferences
PUT    /api/v1/users/{user_id}/preferences

GET    /api/v1/users/{user_id}/routine
POST   /api/v1/users/{user_id}/routine/blocks
PUT    /api/v1/routine/blocks/{block_id}
DELETE /api/v1/routine/blocks/{block_id}

GET    /api/v1/users/{user_id}/tasks?date=YYYY-MM-DD
POST   /api/v1/users/{user_id}/tasks
PUT    /api/v1/tasks/{task_id}
DELETE /api/v1/tasks/{task_id}

GET    /api/v1/users/{user_id}/schedule/today
GET    /api/v1/users/{user_id}/schedule?date=YYYY-MM-DD
POST   /api/v1/users/{user_id}/schedule/generate
POST   /api/v1/schedule/blocks/{block_id}/status

POST   /api/v1/users/{user_id}/sleep/start
POST   /api/v1/users/{user_id}/sleep/wake
GET    /api/v1/users/{user_id}/sleep?date=YYYY-MM-DD

POST   /api/v1/users/{user_id}/naps/start
POST   /api/v1/naps/{nap_id}/end
GET    /api/v1/users/{user_id}/naps?date=YYYY-MM-DD

GET    /api/v1/users/{user_id}/debt
POST   /api/v1/debt/{debt_id}/apply-recovery

GET    /api/v1/users/{user_id}/recovery?status=scheduled
POST   /api/v1/users/{user_id}/recovery/generate
POST   /api/v1/recovery/blocks/{recovery_block_id}/status

GET    /api/v1/users/{user_id}/review?date=YYYY-MM-DD
POST   /api/v1/users/{user_id}/review/daily
```

---

## Demo User Notes

- Email: `demo@routineplanner.app`
- Created with 12 routine blocks matching the frontend mock data
- Seeds 2 sample debt records (Study: 45 min, Gym: 60 min)
- Seeds a one-time task for today: "Complete Assignment" (120 min, flexible)
- Calling `POST /users/demo` a second time returns the same user — no duplicates

---

## Switching to PostgreSQL

1. Install a PostgreSQL adapter:
   ```bash
   pip install psycopg2-binary
   ```

2. Update `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/routine_recovery
   ```

3. Restart the server — SQLModel creates tables automatically on startup.

---

## Notes

- **No authentication in V1.** All endpoints accept `user_id` as a path/query parameter. Auth will be added in a future iteration.
- **No real-time push notifications.** Notification preferences are stored and returned but no push infrastructure is wired up.
- **Recovery plan is deterministic.** Given the same debt and schedule, it always produces the same plan. Randomness is not introduced.
- **Frontend integration.** The frontend currently uses local mock state. Connecting it to this backend is a future task.
- **SQLite in development.** The `routine_recovery.db` file is created in the `backend/` directory on first run.
