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
    Response,
)

from app.models.resume_studio import (
    CanonicalResume,
    CreateVersionRequest,
    ResumeVersionDoc,
    VersionSummaryItem,
    ParseResumeResponse,
)
from app.models.scoring import ScoreRequest, ATSScoreResponse
from app.models.assist import AIAssistRequest, AIAssistResponse
from app.models.export import ExportResumeRequest, ExportSelfTestResponse
from app.models.multi_jd import MultiJDCompareRequest, MultiJDCompareResponse
from app.models.tailor import TailorResumeRequest, TailorResumeResponse
from app.models.version_compare import (
    CompareVersionsRequest,
    VersionComparisonResponse,
    UpdateVersionLabelRequest,
)
from app.models.platform_bridges import GenerateSeedsRequest, GenerateSeedsResponse
from app.services.resume_parser import resume_studio_parser
from app.services.scoring_engine import scoring_engine
from app.services.resume_assist import resume_assist_service
from app.services.resume_exporter import resume_exporter
from app.services.multi_jd_comparator import multi_jd_comparator
from app.services.resume_tailor import resume_tailor_service
from app.services.version_manager import version_manager_service
from app.services.platform_bridges import platform_bridges_service


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
@limiter.limit("30/minute")
async def create_or_save_resume_version(
    request: Request,
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


@router.post("/score", response_model=ATSScoreResponse)
@limiter.limit("60/minute")
async def evaluate_ats_score(
    request: Request,
    payload: ScoreRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Calculate deterministic, transparent ATS score across 5 weighted dimensions.
    Returns breakdown, matched/partial/missing skills with evidence lines, and weak line recommendations.
    """
    try:
        evaluation = scoring_engine.calculate_full_ats_score(
            resume=payload.resume,
            job_description=payload.job_description,
            target_role=payload.target_role,
        )
        return evaluation
    except Exception as e:
        logger.error(f"[ResumeStudio] Error scoring resume: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate ATS score: {str(e)}",
        )


@router.post("/assist", response_model=AIAssistResponse)
@limiter.limit("15/minute")
async def assist_resume_text(
    request: Request,
    payload: AIAssistRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Inline AI assistance for resume bullet points and summaries.
    Provides 3 distinct rewrite options for 'improve', 'add_impact', or 'shorten'.
    Enforces Truthful AI evidence checking to flag unverified numbers or skill claims.
    """
    try:
        response = await resume_assist_service.generate_assist_options(payload)
        return response
    except Exception as e:
        logger.error(f"[ResumeStudio] Assist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate assist options: {str(e)}",
        )


@router.post("/export")
@limiter.limit("20/minute")
async def export_resume_document(
    request: Request,
    payload: ExportResumeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Export ATS-safe PDF or DOCX file using selected template and typography settings.
    Returns binary file stream with standardized Name_Role_Resume.ext filename.
    """
    try:
        ext = payload.format.lower()
        filename = resume_exporter.sanitize_filename(
            full_name=payload.resume.contact.full_name,
            target_role=payload.target_role,
            ext=ext,
        )

        if ext == "pdf":
            file_bytes = resume_exporter.generate_pdf(
                resume=payload.resume,
                template=payload.template,
                accent_color=payload.accent_color,
                font_size=payload.font_size,
            )
            media_type = "application/pdf"
        elif ext == "docx":
            file_bytes = resume_exporter.generate_docx(
                resume=payload.resume,
                template=payload.template,
                accent_color=payload.accent_color,
            )
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: '{payload.format}'. Use 'pdf' or 'docx'.")

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Filename": filename,
        }
        return Response(content=file_bytes, media_type=media_type, headers=headers)

    except Exception as e:
        logger.error(f"[ResumeStudio] Export error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export resume: {str(e)}",
        )


@router.post("/export/self-test", response_model=ExportSelfTestResponse)
@limiter.limit("20/minute")
async def export_self_test(
    request: Request,
    payload: ExportResumeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Export Self-Test: Generates the file and immediately re-parses it with our ATS parser
    to verify that contact info, skills, and sections survive.
    """
    try:
        ext = payload.format.lower()
        filename = resume_exporter.sanitize_filename(
            full_name=payload.resume.contact.full_name,
            target_role=payload.target_role,
            ext=ext,
        )

        if ext == "pdf":
            file_bytes = resume_exporter.generate_pdf(
                resume=payload.resume,
                template=payload.template,
                accent_color=payload.accent_color,
                font_size=payload.font_size,
            )
        else:
            file_bytes = resume_exporter.generate_docx(
                resume=payload.resume,
                template=payload.template,
                accent_color=payload.accent_color,
            )

        test_result = resume_exporter.run_export_self_test(
            file_bytes=file_bytes,
            file_type=ext,
            expected_resume=payload.resume,
        )

        return ExportSelfTestResponse(
            is_ats_readable=test_result["is_ats_readable"],
            character_count=test_result["character_count"],
            name_matched=test_result["name_matched"],
            email_matched=test_result["email_matched"],
            survived_sections=test_result["survived_sections"],
            skills_survived_count=test_result["skills_survived_count"],
            file_type=test_result["file_type"],
            verdict=test_result["verdict"],
            filename=filename,
        )

    except Exception as e:
        logger.error(f"[ResumeStudio] Self-test error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute export self-test: {str(e)}",
        )


@router.post("/compare-jds", response_model=MultiJDCompareResponse)
@limiter.limit("15/minute")
async def compare_multiple_job_descriptions(
    request: Request,
    payload: MultiJDCompareRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Compare a single resume version against up to 5 Job Descriptions in parallel.
    Returns match rankings with best-fit badge, cross-JD skill matrix heatmap,
    common skill gaps, and Recharts radar/bar comparison datasets.
    """
    try:
        results = await multi_jd_comparator.compare_multiple_jds(payload)
        user_id = get_user_id(current_user)
        try:
            await multi_jd_comparator.record_comparison_history(
                user_id=user_id, request=payload, response=results
            )
        except Exception as he:
            logger.warning(f"[ResumeStudio] Failed to record comparison history: {he}")
        return results
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"[ResumeStudio] Multi-JD comparison error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare job descriptions: {str(e)}",
        )


@router.post("/tailor", response_model=TailorResumeResponse)
@limiter.limit("10/minute")
async def tailor_resume_to_jd(
    request: Request,
    payload: TailorResumeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate a tailored resume draft customized for a target Job Description.
    Front-loads matching skills and accomplishments, tailors the summary,
    and returns a side-by-side diff preview with Truthful AI evidence checking.
    """
    try:
        response = await resume_tailor_service.tailor_resume(payload)
        return response
    except Exception as e:
        logger.error(f"[ResumeStudio] Tailoring error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to tailor resume: {str(e)}",
        )


@router.patch("/version/{version_id}/label", response_model=VersionSummaryItem)
async def update_version_label(
    version_id: str,
    payload: UpdateVersionLabelRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update label of a resume version (e.g. 'Tailored: Amazon SDE')."""
    user_id = get_user_id(current_user)
    updated = await version_manager_service.update_version_label(
        user_id=user_id, version_id=version_id, new_label=payload.label
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found.",
        )
    return updated


@router.post("/version/{version_id}/restore", response_model=ResumeVersionDoc)
async def restore_resume_version(
    version_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Restore a target version by duplicating it as a newly active version entry."""
    user_id = get_user_id(current_user)
    restored = await version_manager_service.restore_version(
        user_id=user_id, version_id=version_id
    )
    if not restored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found to restore.",
        )
    return restored


@router.post("/compare-versions", response_model=VersionComparisonResponse)
@limiter.limit("30/minute")
async def compare_resume_versions(
    request: Request,
    payload: CompareVersionsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Compare any two resume versions side by side.
    Computes score delta, word count delta, skills added/removed, summary diff,
    and bullet differences.
    """
    user_id = get_user_id(current_user)
    try:
        diff_report = await version_manager_service.compare_versions(
            user_id=user_id, request=payload
        )
        return diff_report
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"[ResumeStudio] Version comparison error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare resume versions: {str(e)}",
        )


@router.get("/comparisons")
async def list_recent_comparisons(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve historical multi-JD comparisons for the authenticated candidate."""
    user_id = get_user_id(current_user)
    try:
        return await multi_jd_comparator.list_user_comparisons(user_id=user_id)
    except Exception as e:
        logger.error(f"[ResumeStudio] Error listing comparisons: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list comparisons: {str(e)}",
        )


@router.post("/interview-seeds", response_model=GenerateSeedsResponse)
@limiter.limit("20/minute")
async def extract_interview_seeds(
    request: Request,
    payload: GenerateSeedsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate targeted technical interview question seeds challenging the candidate's:
    1. Unsubstantiated skills (listed in skills catalog with no project/experience bullets)
    2. Weak phrasing or unquantified resume claims
    3. Missing job description requirements
    """
    try:
        seeds_resp = platform_bridges_service.generate_interview_seeds(
            resume=payload.resume,
            job_description=payload.job_description,
            target_role=payload.target_role,
        )
        return seeds_resp
    except Exception as e:
        logger.error(f"[ResumeStudio] Error generating interview seeds: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate interview seeds: {str(e)}",
        )








