from fastapi import APIRouter
from datetime import datetime, timezone
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Health check endpoint to verify backend service operational status."""
    return {
        "status": "ok",
        "app_name": "InterviewIQ API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "api": "healthy",
            "database": "unconfigured" if not settings.MONGODB_URI else "configured",
            "gemini": "unconfigured" if not settings.GEMINI_API_KEY else "configured",
        }
    }
