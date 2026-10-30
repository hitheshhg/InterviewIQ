import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from bson import ObjectId
from app.database import get_db, db_manager
from app.models.canonical_resume import (
    CanonicalResume,
    SaveActiveResumeRequest,
    ActiveResumeResponse,
)

logger = logging.getLogger("interviewiq.canonical_manager")


class CanonicalResumeManager:
    """
    Manages persistence and versioning for active resumes.
    Ensures dual-layer reliability (MongoDB Atlas + in-memory cache for offline resilience).
    """

    def __init__(self):
        # In-memory store: user_id -> list of resume dicts
        self._in_memory_resumes: Dict[str, List[Dict[str, Any]]] = {}

    async def save_active_resume(
        self, user_id: str, payload: SaveActiveResumeRequest
    ) -> ActiveResumeResponse:
        """
        Saves a candidate's canonical resume as their currently active version.
        Marks all previous versions for this user as inactive (`is_active: False`).
        """
        db = None
        try:
            db = get_db()
        except Exception:
            db = None

        now = datetime.now(timezone.utc)
        iso_now = now.isoformat()

        # Determine next version number
        next_version = 1
        if db is not None:
            try:
                latest = await db.resumes.find_one(
                    {"user_id": user_id}, sort=[("version", -1)]
                )
                if latest and "version" in latest:
                    next_version = int(latest["version"]) + 1
            except Exception as e:
                logger.warning(f"[CanonicalManager] Error reading version from DB: {e}")
        else:
            user_list = self._in_memory_resumes.get(user_id, [])
            if user_list:
                next_version = max((r.get("version", 1) for r in user_list), default=0) + 1

        resume_doc = {
            "user_id": user_id,
            "version": next_version,
            "is_active": True,
            "file_name": payload.file_name or "Resume.pdf",
            "file_type": "pdf",
            "target_role": payload.target_role or "Full Stack Developer",
            "job_description": payload.job_description or "",
            "canonical_data": payload.canonical_resume.model_dump(),
            "created_at": now,
            "updated_at": now,
        }

        resume_id = f"mem_res_{user_id}_{next_version}"

        if db is not None:
            try:
                # 1. Mark existing user resumes as inactive
                await db.resumes.update_many(
                    {"user_id": user_id, "is_active": True},
                    {"$set": {"is_active": False, "updated_at": now}},
                )
                # 2. Insert new active resume
                insert_res = await db.resumes.insert_one(resume_doc)
                resume_id = str(insert_res.inserted_id)
            except Exception as e:
                logger.error(f"[CanonicalManager] DB insert failed, using memory: {e}")

        # Update in-memory fallback
        resume_doc["_id"] = resume_id
        user_list = self._in_memory_resumes.setdefault(user_id, [])
        for r in user_list:
            r["is_active"] = False
        user_list.append(resume_doc)

        return ActiveResumeResponse(
            status="success",
            resume_id=resume_id,
            version=next_version,
            is_active=True,
            target_role=payload.target_role or "Full Stack Developer",
            job_description=payload.job_description or "",
            canonical_resume=payload.canonical_resume,
            updated_at=iso_now,
        )

    async def get_active_resume(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the active resume document for a user.
        Falls back to the most recent resume if no resume has is_active=True.
        """
        db = None
        try:
            db = get_db()
        except Exception:
            db = None

        if db is not None:
            try:
                # First attempt: find explicitly active resume
                doc = await db.resumes.find_one(
                    {"user_id": user_id, "is_active": True}, sort=[("version", -1)]
                )
                if not doc:
                    # Fallback to most recent document
                    doc = await db.resumes.find_one(
                        {"user_id": user_id}, sort=[("created_at", -1)]
                    )

                if doc:
                    doc["_id"] = str(doc["_id"])
                    return doc
            except Exception as e:
                logger.warning(f"[CanonicalManager] DB query error: {e}")

        # In-memory lookup
        user_list = self._in_memory_resumes.get(user_id, [])
        if not user_list:
            return None

        # Prefer is_active: True
        active_items = [r for r in user_list if r.get("is_active")]
        if active_items:
            return active_items[-1]
        return user_list[-1]

    async def list_resume_versions(self, user_id: str) -> List[Dict[str, Any]]:
        """List all resume versions belonging to a candidate."""
        db = None
        try:
            db = get_db()
        except Exception:
            db = None

        if db is not None:
            try:
                cursor = db.resumes.find({"user_id": user_id}).sort("version", -1)
                results = []
                async for item in cursor:
                    item["_id"] = str(item["_id"])
                    results.append(item)
                return results
            except Exception as e:
                logger.warning(f"[CanonicalManager] Error listing resume versions: {e}")

        return list(reversed(self._in_memory_resumes.get(user_id, [])))


canonical_resume_manager = CanonicalResumeManager()

