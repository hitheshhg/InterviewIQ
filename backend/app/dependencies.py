import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import get_db

logger = logging.getLogger("interviewiq.auth")

# Security scheme for Swagger UI & route protection
security = HTTPBearer(auto_error=False)

# Initialize Firebase Admin SDK
_firebase_initialized = False


def init_firebase_admin():
    """Initialize Firebase Admin SDK with service account credentials."""
    global _firebase_initialized
    if _firebase_initialized:
        return

    key_path = settings.FIREBASE_CREDENTIALS_PATH
    # Check relative to backend directory if not absolute
    if not os.path.isabs(key_path) and not os.path.exists(key_path):
        candidate = os.path.join(os.path.dirname(os.path.dirname(__file__)), key_path)
        if os.path.exists(candidate):
            key_path = candidate

    if os.path.exists(key_path):
        try:
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("[Auth] Firebase Admin SDK successfully initialized.")
        except Exception as e:
            logger.error(f"[Auth] Failed to initialize Firebase Admin SDK: {e}")
            raise e
    else:
        logger.warning(
            f"[Auth] Firebase credentials file '{key_path}' not found. Auth verification will fail."
        )


async def get_current_user(
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    FastAPI dependency to verify Firebase ID token and synchronize the user with MongoDB Atlas.
    Raises HTTP 401 if token is missing, expired, or invalid.
    """
    if not auth_credentials or not auth_credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_credentials.credentials

    try:
        # Cryptographically verify token with Firebase
        decoded_token = auth.verify_id_token(token)
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"[Auth] Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid = decoded_token.get("uid")
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing UID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = decoded_token.get("email", "")
    display_name = decoded_token.get("name") or (email.split("@")[0] if email else "User")
    photo_url = decoded_token.get("picture", "")

    # Sync with MongoDB Atlas users collection
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        user_record = await db.users.find_one_and_update(
            {"firebase_uid": firebase_uid},
            {
                "$set": {
                    "email": email,
                    "display_name": display_name,
                    "photo_url": photo_url,
                    "last_login": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=True,
        )
        # Convert ObjectId to string for clean serialization
        user_record["_id"] = str(user_record["_id"])
        return user_record
    except Exception as e:
        logger.error(f"[Auth] Database sync error for user {firebase_uid}: {e}")
        # Even if DB sync experiences transient issue, return the verified decoded identity
        return {
            "firebase_uid": firebase_uid,
            "email": email,
            "display_name": display_name,
            "photo_url": photo_url,
        }
