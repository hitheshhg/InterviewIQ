import json
import logging
from typing import Dict, Any, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    WebSocket,
    WebSocketDisconnect,
    Query,
    Request,
)
from firebase_admin import auth
from app.middleware.rate_limit import limiter

from app.models.session import (
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    SessionSummary,
)
from app.services.session_manager import session_manager
from app.dependencies import get_current_user

logger = logging.getLogger("interviewiq.routes.interview")

router = APIRouter(prefix="/api/v1/interview", tags=["Interview Engine"])


def get_user_id(current_user: Dict[str, Any]) -> str:
    return current_user.get("firebase_uid") or current_user.get("uid") or "anonymous_user"


@router.get("/active-context")
async def get_interview_active_context(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Phase F5: Retrieves candidate's active resume version, available versions,
    and precomputed question seeds for the interview setup screen.
    If the candidate has no resume yet, returns has_resume=False.
    """
    user_id = get_user_id(current_user)
    from app.services.canonical_resume_manager import canonical_resume_manager
    from app.services.question_seed_generator import question_seed_generator
    from app.models.canonical_resume import CanonicalResume

    active_doc = await canonical_resume_manager.get_active_resume(user_id)
    versions = await canonical_resume_manager.list_resume_versions(user_id)

    if not active_doc or "canonical_data" not in active_doc:
        return {
            "has_resume": False,
            "active_version": None,
            "file_name": None,
            "target_role": "Full Stack Developer",
            "question_seeds": [],
            "versions": [],
        }

    c_resume = CanonicalResume(**active_doc["canonical_data"])
    target_role = active_doc.get("target_role", "Full Stack Developer")
    job_desc = active_doc.get("job_description", "")
    seeds = question_seed_generator.generate_seeds(
        resume=c_resume,
        job_description=job_desc,
        target_role=target_role,
    )

    clean_versions = [
        {
            "version": v.get("version", 1),
            "file_name": v.get("file_name", "Resume.pdf"),
            "target_role": v.get("target_role", target_role),
            "is_active": v.get("is_active", False),
            "score": v.get("current_score"),
        }
        for v in versions
    ]

    return {
        "has_resume": True,
        "active_version": active_doc.get("version", 1),
        "file_name": active_doc.get("file_name", "Resume.pdf"),
        "target_role": target_role,
        "job_description": job_desc,
        "question_seeds": seeds,
        "versions": clean_versions,
    }


@router.post("/start", response_model=StartInterviewResponse)
@limiter.limit("10/minute")
async def start_interview_session(
    request: Request,
    payload: StartInterviewRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Initiate a new AI mock interview session.
    Retrieves candidate resume context (if supplied), generates Question 1 tailored
    to the target role, and creates the session document.
    """
    user_id = get_user_id(current_user)
    try:
        response = await session_manager.start_session(user_id=user_id, request=payload)
        return response
    except Exception as e:
        logger.error(f"[InterviewRoute] Error starting interview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview session: {str(e)}",
        )


@router.post("/{session_id}/answer", response_model=SubmitAnswerResponse)
@limiter.limit("10/minute")
async def submit_turn_answer(
    session_id: str,
    request: Request,
    payload: SubmitAnswerRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Submit candidate answer for the current question.
    Evaluates response on the 5-point rubric and generates the next adaptive question in 1 turn.
    """
    user_id = get_user_id(current_user)
    try:
        response = await session_manager.process_answer(
            session_id=session_id, user_id=user_id, request=payload
        )
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"[InterviewRoute] Error submitting answer for {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Turn evaluation failed: {str(e)}",
        )


@router.get("/{session_id}")
async def get_interview_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve full details, current question, and complete turn history for a session."""
    user_id = get_user_id(current_user)
    session = await session_manager.get_session(session_id=session_id, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found.",
        )
    return session


@router.post("/{session_id}/end", response_model=SessionSummary)
async def end_interview_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Mark session as completed and calculate final summary metrics."""
    user_id = get_user_id(current_user)
    try:
        summary = await session_manager.end_session(session_id=session_id, user_id=user_id)
        return summary
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        logger.error(f"[InterviewRoute] Error ending session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to finalize session: {str(e)}",
        )


@router.websocket("/ws/{session_id}")
async def interview_websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None),
):
    """
    Bidirectional WebSocket connection for real-time interview turns.
    Receives JSON:
      {"type": "submit_answer", "answer_text": "...", "duration_seconds": 35}
    Streams back:
      {"type": "turn_evaluating"}
      {"type": "turn_result", "data": {...}}
      {"type": "session_completed", "summary": {...}}
    """
    # Authenticate token strictly via query parameter
    if not token:
        await websocket.close(code=1008, reason="Authentication token required.")
        return

    try:
        decoded = auth.verify_id_token(token)
        user_id = decoded.get("uid")
        if not user_id:
            await websocket.close(code=1008, reason="Invalid token UID.")
            return
    except Exception as e:
        logger.warning(f"[InterviewWS] Invalid query token: {e}")
        await websocket.close(code=1008, reason="Invalid authentication token.")
        return

    await websocket.accept()

    try:
        # Send initial connected greeting
        await websocket.send_text(
            json.dumps({"type": "connected", "session_id": session_id, "user_id": user_id})
        )

        while True:
            raw_msg = await websocket.receive_text()
            try:
                data = json.loads(raw_msg)
            except Exception:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Invalid JSON format."})
                )
                continue

            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            elif msg_type == "submit_answer":
                answer_text = data.get("answer_text", "").strip()
                duration_seconds = data.get("duration_seconds", 0)

                if not answer_text:
                    await websocket.send_text(
                        json.dumps({"type": "error", "message": "Answer text cannot be empty."})
                    )
                    continue

                # Notify client evaluation is in progress
                await websocket.send_text(
                    json.dumps({"type": "evaluating", "question_index": data.get("question_index")})
                )

                try:
                    submit_req = SubmitAnswerRequest(
                        answer_text=answer_text, duration_seconds=duration_seconds
                    )
                    result = await session_manager.process_answer(
                        session_id=session_id, user_id=user_id, request=submit_req
                    )
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "turn_result",
                                "data": result.model_dump(mode="json"),
                            }
                        )
                    )
                except Exception as e:
                    logger.error(f"[InterviewWS] Error evaluating turn: {e}")
                    await websocket.send_text(
                        json.dumps(
                            {"type": "error", "message": f"Evaluation error: {str(e)}"}
                        )
                    )

            elif msg_type == "end_session":
                try:
                    summary = await session_manager.end_session(
                        session_id=session_id, user_id=user_id
                    )
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "session_completed",
                                "summary": summary.model_dump(mode="json"),
                            }
                        )
                    )
                except Exception as e:
                    await websocket.send_text(
                        json.dumps(
                            {"type": "error", "message": f"End session error: {str(e)}"}
                        )
                    )
                break

    except WebSocketDisconnect:
        logger.info(f"[InterviewWS] Client disconnected from session {session_id}")
    except Exception as e:
        logger.error(f"[InterviewWS] Unexpected WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass

