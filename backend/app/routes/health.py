from fastapi import APIRouter
from datetime import datetime, timezone
from app.config import settings
from app.database import check_db_health

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Health check endpoint to verify backend service operational status."""
    db_health = await check_db_health()
    
    return {
        "status": "ok",
        "app_name": "InterviewIQ API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "api": "healthy",
            "database": db_health,
            "gemini": "unconfigured" if not settings.GEMINI_API_KEY else "configured",
        }
    }
