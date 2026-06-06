from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    """Liveness probe — returns OK when the server is running."""
    return {"status": "ok"}
