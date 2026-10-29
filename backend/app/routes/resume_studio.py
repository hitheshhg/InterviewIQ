import logging
from typing import Dict, Any, List, Optional
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends,
    HTTPException,
    status,
    Request,
)

from app.models.resume_studio import (
    CanonicalResume,
    CreateVersionRequest,
    ResumeVersionDoc,
    VersionSummaryItem,
    ParseResumeResponse,
)
from app.services.resume_parser import resume_studio_parser
from app.dependencies import get_current_user
from app.middleware.rate_limit import limiter

logger = logging.getLogger("interviewiq.routes.resume_studio")

router = APIRouter(prefix="/api/v1/resume-studio", tags=["Resume Studio"])


def get_user_id(current_user: Dict[str, Any]) -> str:
    return current_user.get("firebase_uid") or current_user.get("uid") or "anonymous_user"


@router.post("/parse", response_model=ParseResumeResponse)
@limiter.limit("10/minute")
async def parse_resume_document(
    request: Request,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Upload a PDF, DOCX, or TXT resume document.
    Extracts text, guards against scanned image PDFs, and uses Gemini structured mode
    to compile the resume into the canonical Resume JSON schema.
    """
    try:
        raw_text, file_type = await resume_studio_parser.extract_text_from_file(file)
        canonical_resume = await resume_studio_parser.parse_text_to_canonical_resume(raw_text)

        return ParseResumeResponse(
            status="success",
            file_name=file.filename or "resume.pdf",
            file_type=file_type,
            resume=canonical_resume,
            raw_character_count=len(raw_text),
        )

    except ValueError as ve:
        logger.warning(f"[ResumeStudio] Validation/extraction error for {file.filename}: {ve}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"[ResumeStudio] Unexpected parsing error for {file.filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse resume document: {str(e)}",
        )


@router.post("/version", response_model=ResumeVersionDoc)
async def create_or_save_resume_version(
    payload: CreateVersionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Save or autosave a structured resume version in MongoDB Atlas.
    """
    user_id = get_user_id(current_user)
    try:
        saved_doc = await resume_studio_parser.create_resume_version(
            user_id=user_id, request=payload
        )
        return saved_doc
    except Exception as e:
        logger.error(f"[ResumeStudio] Error saving version for {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist resume version: {str(e)}",
        )


@router.get("/versions", response_model=List[VersionSummaryItem])
async def list_resume_versions(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieve all historical resume versions belonging to the authenticated candidate.
    """
    user_id = get_user_id(current_user)
    try:
        versions = await resume_studio_parser.list_user_versions(user_id=user_id)
        return versions
    except Exception as e:
        logger.error(f"[ResumeStudio] Error listing versions for {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve resume versions: {str(e)}",
        )


@router.get("/version/{version_id}", response_model=ResumeVersionDoc)
async def get_resume_version(
    version_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieve full Canonical Resume JSON for a specific version.
    Strictly verifies ownership by current user.
    """
    user_id = get_user_id(current_user)
    doc = await resume_studio_parser.get_version_by_id(user_id=user_id, version_id=version_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found.",
        )
    return doc


@router.delete("/version/{version_id}")
async def delete_resume_version(
    version_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete a resume version document.
    """
    user_id = get_user_id(current_user)
    deleted = await resume_studio_parser.delete_version(user_id=user_id, version_id=version_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found or already deleted.",
        )
    return {"status": "success", "message": f"Version '{version_id}' deleted."}

