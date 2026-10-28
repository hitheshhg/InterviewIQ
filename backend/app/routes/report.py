import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.report import (
    InterviewReport,
    PersonalizedRoadmap,
    DashboardMetrics,
)
from app.services.report_engine import report_engine
from app.dependencies import get_current_user

logger = logging.getLogger("interviewiq.routes.report")

router = APIRouter(prefix="/api/v1", tags=["Reports, Roadmap & Dashboard"])


def get_user_id(current_user: Dict[str, Any]) -> str:
    return current_user.get("firebase_uid") or current_user.get("uid") or "anonymous_user"


@router.post("/report/generate/{session_id}", response_model=InterviewReport)
async def generate_interview_report(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate comprehensive 5-dimension analytics report and personalized career roadmap
    for a completed mock interview session.
    """
    user_id = get_user_id(current_user)
    try:
        report = await report_engine.generate_report_for_session(
            session_id=session_id, user_id=user_id
        )
        return report
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        logger.error(f"[ReportRoute] Failed to generate report for {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation error: {str(e)}",
        )


@router.get("/report/session/{session_id}", response_model=InterviewReport)
async def get_report_by_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve existing interview report by session ID."""
    user_id = get_user_id(current_user)
    report = await report_engine.get_report_by_session(session_id=session_id, user_id=user_id)
    if not report:
        # If report not generated yet, attempt auto-generation
        try:
            report = await report_engine.generate_report_for_session(
                session_id=session_id, user_id=user_id
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report for session '{session_id}' not found.",
            )
    return report


@router.get("/report/user/latest", response_model=InterviewReport)
async def get_latest_candidate_report(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve the most recent interview report for the authenticated candidate."""
    user_id = get_user_id(current_user)
    report = await report_engine.get_latest_report(user_id=user_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No interview reports found for this candidate. Complete a mock interview first.",
        )
    return report


@router.get("/roadmap/user/latest", response_model=PersonalizedRoadmap)
async def get_latest_candidate_roadmap(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve the candidate's personalized milestone career roadmap."""
    user_id = get_user_id(current_user)
    roadmap = await report_engine.get_latest_roadmap(user_id=user_id)
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No roadmap found.",
        )
    return roadmap


@router.get("/dashboard/metrics", response_model=DashboardMetrics)
async def get_candidate_dashboard_metrics(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve aggregate performance KPIs, score history, and interview history for candidate dashboard."""
    user_id = get_user_id(current_user)
    try:
        metrics = await report_engine.get_dashboard_metrics(user_id=user_id)
        return metrics
    except Exception as e:
        logger.error(f"[ReportRoute] Error compiling dashboard metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard metrics: {str(e)}",
        )
