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
)
from firebase_admin import auth

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


@router.post("/start", response_model=StartInterviewResponse)
async def start_interview_session(
    request: StartInterviewRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Initiate a new AI mock interview session.
    Retrieves candidate resume context (if supplied), generates Question 1 tailored
    to the target role, and creates the session document.
    """
    user_id = get_user_id(current_user)
    try:
        response = await session_manager.start_session(user_id=user_id, request=request)
        return response
    except Exception as e:
        logger.error(f"[InterviewRoute] Error starting interview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview session: {str(e)}",
        )


@router.post("/{session_id}/answer", response_model=SubmitAnswerResponse)
async def submit_turn_answer(
    session_id: str,
    request: SubmitAnswerRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Submit candidate answer for the current question.
    Evaluates response on the 5-point rubric and generates the next adaptive question in 1 turn.
    """
    user_id = get_user_id(current_user)
    try:
        response = await session_manager.process_answer(
            session_id=session_id, user_id=user_id, request=request
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
    await websocket.accept()

    # Authenticate token if provided via query param or fallback to guest uid for evaluation demo
    user_id = "ws_user"
    if token:
        try:
            decoded = auth.verify_id_token(token)
            user_id = decoded.get("uid", "ws_user")
        except Exception as e:
            logger.warning(f"[InterviewWS] Invalid query token, proceeding in sandbox mode: {e}")

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

