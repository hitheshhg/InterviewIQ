import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status, Request
from bson import ObjectId
from app.middleware.rate_limit import limiter
from app.services.resume_extractor import extract_text_from_file
from app.services.ats_engine import run_full_ats_analysis
from app.models.resume import ResumeUploadResponse, ATSAnalysisResult
from app.models.canonical_resume import (
    CanonicalResume,
    ParseResumeResponse,
    SaveActiveResumeRequest,
    ActiveResumeResponse,
)
from app.services.canonical_parser import canonical_parser
from app.services.canonical_resume_manager import canonical_resume_manager
from app.dependencies import get_current_user
from app.database import get_db

router = APIRouter(prefix="/api/v1/resume", tags=["Resume & ATS Engine"])


@router.post("/upload", response_model=ResumeUploadResponse)
@limiter.limit("5/minute")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    job_description: str = Form(""),
    target_role: str = Form("Full Stack Developer"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Upload a PDF or DOCX resume, extract text, execute deterministic & semantic ATS analysis,
    and persist results in MongoDB Atlas.
    """
    # 1. Safe text extraction with size and type validation
    raw_text, file_type = await extract_text_from_file(file)

    # 2. Run hybrid ATS evaluation
    ats_result = await run_full_ats_analysis(
        resume_text=raw_text,
        job_description=job_description,
        target_role=target_role,
    )

    # 3. Store in MongoDB Atlas
    db = get_db()
    user_id = current_user.get("firebase_uid", "anonymous")
    
    resume_doc = {
        "user_id": user_id,
        "file_name": file.filename or "resume.pdf",
        "file_type": file_type,
        "raw_text": raw_text,
        "target_role": target_role,
        "job_description": job_description,
        "parsed_data": ats_result.parsed_data.model_dump(),
        "ats_analysis": ats_result.model_dump(),
        "created_at": datetime.now(timezone.utc),
    }

    insert_res = await db.resumes.insert_one(resume_doc)
    resume_id = str(insert_res.inserted_id)

    return ResumeUploadResponse(
        status="success",
        resume_id=resume_id,
        file_name=file.filename or "resume.pdf",
        file_type=file_type,
        ats_analysis=ats_result,
    )


@router.post("/analyze-text", response_model=ATSAnalysisResult)
@limiter.limit("5/minute")
async def analyze_raw_resume_text(
    request: Request,
    resume_text: str = Form(...),
    job_description: str = Form(""),
    target_role: str = Form("Full Stack Developer"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Direct text analysis endpoint allowing rapid ATS evaluation of pasted resume text.
    """
    if len(resume_text.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume text is too short. Please provide at least 50 characters."
        )

    return await run_full_ats_analysis(
        resume_text=resume_text,
        job_description=job_description,
        target_role=target_role,
    )


@router.get("/user/latest")
async def get_latest_resume(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve the candidate's most recent uploaded resume and ATS report."""
    db = get_db()
    user_id = current_user.get("firebase_uid")

    resume = await db.resumes.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No uploaded resume found for this user."
        )

    resume["_id"] = str(resume["_id"])
    return {
        "status": "success",
        "resume": resume
    }


# =========================================================================
# RESUME FLOW v2 (STEP 1: UPLOAD, PARSE, EDIT, ACTIVE RESUME STORAGE)
# =========================================================================

@router.post("/parse-upload", response_model=ParseResumeResponse)
@limiter.limit("5/minute")
async def parse_uploaded_resume(
    request: Request,
    file: UploadFile = File(...),
    job_description: Optional[str] = Form(""),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Step 1: Upload a PDF or DOCX resume.
    Validates file type/size/corruption/empty/scanned status, extracts plain text,
    and parses into the canonical Resume JSON using Gemini structured output with retry.
    """
    raw_text, file_type = await extract_text_from_file(file)

    canonical_resume = await canonical_parser.parse_resume_text(raw_text)

    return ParseResumeResponse(
        status="success",
        file_name=file.filename or "resume.pdf",
        file_type=file_type,
        raw_text_length=len(raw_text),
        canonical_resume=canonical_resume,
        job_description=job_description or "",
    )


@router.post("/save-active", response_model=ActiveResumeResponse)
async def save_active_resume(
    payload: SaveActiveResumeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Saves or updates the candidate's canonical resume as their active version in MongoDB.
    This active resume is immediately picked up by interview sessions and analytics.
    """
    user_id = current_user.get("firebase_uid") or current_user.get("uid") or "anonymous_user"
    active_resume = await canonical_resume_manager.save_active_resume(
        user_id=user_id, payload=payload
    )
    return active_resume


@router.get("/active", response_model=ActiveResumeResponse)
async def get_candidate_active_resume(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieve the candidate's currently active resume.
    """
    user_id = current_user.get("firebase_uid") or current_user.get("uid") or "anonymous_user"
    active_doc = await canonical_resume_manager.get_active_resume(user_id=user_id)
    if not active_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active resume found for this candidate. Upload a resume in Step 1.",
        )

    canonical_data = active_doc.get("canonical_data") or {}
    return ActiveResumeResponse(
        status="success",
        resume_id=str(active_doc.get("_id", "active_res")),
        version=active_doc.get("version", 1),
        is_active=True,
        target_role=active_doc.get("target_role", "Full Stack Developer"),
        job_description=active_doc.get("job_description", ""),
        canonical_resume=CanonicalResume(**canonical_data),
        updated_at=active_doc.get("updated_at", datetime.now(timezone.utc)).isoformat()
        if hasattr(active_doc.get("updated_at"), "isoformat")
        else str(active_doc.get("updated_at", "")),
    )


@router.get("/versions")
async def list_candidate_resume_versions(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List all saved resume versions for the candidate."""
    user_id = current_user.get("firebase_uid") or current_user.get("uid") or "anonymous_user"
    versions = await canonical_resume_manager.list_resume_versions(user_id=user_id)
    return {
        "status": "success",
        "total_versions": len(versions),
        "versions": versions,
    }


@router.get("/{resume_id}")
async def get_resume_by_id(
    resume_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve a specific resume and ATS report by ID."""
    db = get_db()
    try:
        obj_id = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resume ID format.")

    resume = await db.resumes.find_one({"_id": obj_id})
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    resume["_id"] = str(resume["_id"])
    return {
        "status": "success",
        "resume": resume
    }



