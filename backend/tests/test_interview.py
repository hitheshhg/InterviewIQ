import pytest
from unittest.mock import patch
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.session import (
    StartInterviewRequest,
    SubmitAnswerRequest,
    QuestionItem,
    AnswerScores,
    AnswerEvaluation,
    CombinedTurnResponse,
)
from app.services.session_manager import InterviewSessionManager, session_manager
from app.dependencies import get_current_user


MOCK_USER = {
    "uid": "test_vtu_user_123",
    "email": "shreya.student@vtu.ac.in",
    "name": "Shreya VTU",
    "firebase_uid": "test_vtu_user_123",
}


def test_schema_validations():
    """Verify Pydantic models reject invalid scores and generate properly."""
    scores = AnswerScores(
        relevance=8,
        technical_accuracy=9,
        clarity=7,
        depth=8,
        confidence=9,
    )
    assert scores.relevance == 8

    # Reject out of bounds scores
    with pytest.raises(Exception):
        AnswerScores(
            relevance=11,  # > 10 invalid
            technical_accuracy=9,
            clarity=7,
            depth=8,
            confidence=9,
        )

    eval_obj = AnswerEvaluation(
        scores=scores,
        average_score=8.2,
        feedback="Excellent depth in explaining concurrency.",
        strengths=["Strong terminology", "Clear architecture overview"],
        areas_for_improvement=["Could mention Redis failover"],
        ideal_answer_summary="Senior candidates describe distributed locks and lease renewals.",
    )
    assert eval_obj.average_score == 8.2


def test_adaptive_difficulty_calculation():
    """Verify adaptive difficulty raises or lowers difficulty based on rolling scores."""
    mgr = InterviewSessionManager()

    # High scores (> 7.5) should raise difficulty from medium to hard
    next_diff = mgr._calculate_next_difficulty("medium", [8.0, 8.5])
    assert next_diff == "hard"

    # High scores from easy should raise to medium
    next_diff = mgr._calculate_next_difficulty("easy", [8.0, 9.0])
    assert next_diff == "medium"

    # Already at hard, stays hard
    next_diff = mgr._calculate_next_difficulty("hard", [9.0, 9.5])
    assert next_diff == "hard"

    # Low scores (< 4.5) should lower difficulty from hard to medium
    next_diff = mgr._calculate_next_difficulty("hard", [3.5, 4.0])
    assert next_diff == "medium"

    # Low scores from medium should lower to easy
    next_diff = mgr._calculate_next_difficulty("medium", [3.0, 4.0])
    assert next_diff == "easy"

    # Moderate scores (5-7) retain difficulty
    next_diff = mgr._calculate_next_difficulty("medium", [6.0, 6.5])
    assert next_diff == "medium"


@pytest.mark.asyncio
async def test_session_manager_lifecycle():
    """Verify start session, submit answer, and end session lifecycle."""
    mgr = InterviewSessionManager()
    req = StartInterviewRequest(
        target_role="Full Stack Developer",
        total_questions=3,
        initial_difficulty="medium",
        resume_text="Built full stack apps using FastAPI, React, and MongoDB."
    )

    # 1. Start Session
    start_resp = await mgr.start_session(user_id="user_test_456", request=req)
    assert start_resp.session_id is not None
    assert start_resp.total_questions == 3
    assert start_resp.current_question_index == 1
    assert start_resp.first_question.question_text is not None
    assert start_resp.first_question.difficulty == "medium"

    # 2. Submit Turn 1 Answer
    turn1_req = SubmitAnswerRequest(
        answer_text="In FastAPI I use async def endpoints with Motor for non-blocking I/O to MongoDB Atlas.",
        duration_seconds=30
    )
    turn1_resp = await mgr.process_answer(
        session_id=start_resp.session_id,
        user_id="user_test_456",
        request=turn1_req
    )
    assert turn1_resp.question_index == 1
    assert turn1_resp.evaluation.average_score >= 1.0
    assert turn1_resp.is_complete is False
    assert turn1_resp.next_question is not None
    assert turn1_resp.next_question.question_index == 2

    # 3. Submit Turn 2 Answer
    turn2_req = SubmitAnswerRequest(
        answer_text="For state management in React I use Context API with custom hooks for auth and Zustand for global state.",
        duration_seconds=25
    )
    turn2_resp = await mgr.process_answer(
        session_id=start_resp.session_id,
        user_id="user_test_456",
        request=turn2_req
    )
    assert turn2_resp.question_index == 2
    assert turn2_resp.is_complete is False

    # 4. Submit Turn 3 (Final) Answer
    turn3_req = SubmitAnswerRequest(
        answer_text="When a conflict occurs I review technical requirements, build a quick benchmark prototype, and align on data-driven metrics.",
        duration_seconds=40
    )
    turn3_resp = await mgr.process_answer(
        session_id=start_resp.session_id,
        user_id="user_test_456",
        request=turn3_req
    )
    assert turn3_resp.question_index == 3
    assert turn3_resp.is_complete is True
    assert turn3_resp.next_question is None

    # 5. End Session Summary
    summary = await mgr.end_session(
        session_id=start_resp.session_id,
        user_id="user_test_456"
    )
    assert summary.status == "completed"
    assert summary.completed_turns == 3
    assert summary.overall_average_score > 0


@pytest.mark.asyncio
async def test_interview_routes_auth_protection():
    """Verify unauthenticated requests return 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Start without auth
        resp = await client.post("/api/v1/interview/start", json={"target_role": "Backend Engineer"})
        assert resp.status_code == 401

        # Submit without auth
        resp = await client.post("/api/v1/interview/fake-session/answer", json={"answer_text": "hello"})
        assert resp.status_code == 401

        # Get without auth
        resp = await client.get("/api/v1/interview/fake-session")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_interview_api_flow_with_mock_auth():
    """Verify end-to-end API flow with mocked authentication dependency."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Start interview
            start_payload = {
                "target_role": "Python Backend Engineer",
                "total_questions": 3,
                "initial_difficulty": "medium",
                "resume_text": "Experienced with FastAPI, Celery, Redis, and PostgreSQL."
            }
            start_res = await client.post("/api/v1/interview/start", json=start_payload)
            assert start_res.status_code == 200
            session_data = start_res.json()
            session_id = session_data["session_id"]
            assert session_data["current_question_index"] == 1
            assert "first_question" in session_data

            # 2. Get session details
            get_res = await client.get(f"/api/v1/interview/{session_id}")
            assert get_res.status_code == 200
            assert get_res.json()["session_id"] == session_id

            # 3. Submit answer turn 1
            answer_payload = {
                "answer_text": "I design RESTful APIs using Pydantic models for validation, dependency injection for DB sessions, and structured logging.",
                "duration_seconds": 35
            }
            answer_res = await client.post(f"/api/v1/interview/{session_id}/answer", json=answer_payload)
            assert answer_res.status_code == 200
            ans_data = answer_res.json()
            assert ans_data["evaluation"]["scores"]["relevance"] >= 1
            assert ans_data["is_complete"] is False

            # 4. End interview
            end_res = await client.post(f"/api/v1/interview/{session_id}/end")
            assert end_res.status_code == 200
            end_data = end_res.json()
            assert end_data["status"] == "completed"
            assert end_data["session_id"] == session_id
    finally:
        app.dependency_overrides.pop(get_current_user, None)

