from fastapi import APIRouter, Depends
from typing import Dict, Any
from app.dependencies import get_current_user
from app.database import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.get("/me")
async def get_my_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve profile and metadata of the currently authenticated candidate."""
    return {
        "status": "success",
        "user": current_user
    }


@router.get("/profile")
async def get_user_profile_details(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve profile details with session metrics and registration timestamp."""
    user_id = current_user.get("firebase_uid") or current_user.get("uid")
    total_sessions = 0
    try:
        db = get_db()
        if db is not None and user_id:
            total_sessions = await db.sessions.count_documents({"user_id": user_id})
    except Exception:
        total_sessions = 0

    return {
        "status": "success",
        "firebase_uid": user_id,
        "email": current_user.get("email", ""),
        "display_name": current_user.get("display_name", "Candidate"),
        "photo_url": current_user.get("photo_url", ""),
        "created_at": current_user.get("created_at"),
        "total_sessions": total_sessions,
    }


@router.post("/sync")
async def sync_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Ensure user profile is synchronized into MongoDB Atlas after sign-in."""
    return {
        "status": "synced",
        "user": current_user
    }


@router.get("/protected-test")
async def protected_test_route(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Diagnostic route verifying token authentication barrier."""
    return {
        "message": f"Hello, {current_user.get('display_name', 'User')}! Your token is valid.",
        "firebase_uid": current_user.get("firebase_uid"),
    }

