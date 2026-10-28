from fastapi import APIRouter, Depends
from typing import Dict, Any
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.get("/me")
async def get_my_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve profile and metadata of the currently authenticated candidate."""
    return {
        "status": "success",
        "user": current_user
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
