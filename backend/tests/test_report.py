import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.report import (
    DimensionScore,
    RoadmapMilestone,
    PersonalizedRoadmap,
    InterviewReport,
    DashboardMetrics,
)
from app.models.session import StartInterviewRequest, SubmitAnswerRequest
from app.services.session_manager import session_manager
from app.services.report_engine import report_engine
from app.dependencies import get_current_user

MOCK_USER = {
    "uid": "vtu_student_report_test",
    "email": "shreya.report@vtu.ac.in",
    "name": "Shreya VTU",
    "firebase_uid": "vtu_student_report_test",
}


def test_report_models():
    """Verify validation of dimension scores, roadmaps, and reports."""
    dim = DimensionScore(
        dimension="Technical Depth",
        score=8.5,
        benchmark=7.5,
        percentage=85
    )
    assert dim.percentage == 85
    assert dim.score == 8.5

    milestone = RoadmapMilestone(
        milestone_id="m1",
        step_number=1,
        title="Async Event Loops",
        target_skill="Concurrency",
        difficulty="Intermediate",
        estimated_days=10,
        actionable_tasks=["Task 1", "Task 2"],
        recommended_resources=["Book 1"],
        capstone_mini_project="Project 1"
    )
    assert milestone.step_number == 1

    roadmap = PersonalizedRoadmap(
        roadmap_id="r1",
        user_id="u1",
        target_role="Full Stack Developer",
        identified_weak_areas=["Depth"],
        milestones=[milestone],
        estimated_total_weeks=4
    )
    assert len(roadmap.milestones) == 1


@pytest.mark.asyncio
async def test_report_engine_full_lifecycle():
    """Verify session creation, turns, report generation, and personalized roadmap creation."""
    user_id = "user_report_lifecycle_test"

    # 1. Start a mock session
    start_req = StartInterviewRequest(
        target_role="Backend Python Engineer",
        total_questions=3,
        initial_difficulty="medium"
    )
    session_res = await session_manager.start_session(user_id=user_id, request=start_req)
    session_id = session_res.session_id

    # 2. Submit Turn 1
    await session_manager.process_answer(
        session_id=session_id,
        user_id=user_id,
        request=SubmitAnswerRequest(
            answer_text="I design high throughput microservices using FastAPI, Redis caching, and MongoDB compound indexes.",
            duration_seconds=30
        )
    )

    # 3. Submit Turn 2 (Final)
    await session_manager.process_answer(
        session_id=session_id,
        user_id=user_id,
        request=SubmitAnswerRequest(
            answer_text="For rate limiting I implement the Token Bucket algorithm in Redis with Lua scripts for atomic operations.",
            duration_seconds=40
        )
    )

    # 4. Generate Report
    report = await report_engine.generate_report_for_session(session_id=session_id, user_id=user_id)
    assert report.session_id == session_id
    assert report.overall_score >= 1.0
    assert len(report.dimension_scores) == 5
    assert report.verdict in ["Strong Hire", "Hire", "Leaning Hire", "Needs Revision"]
    assert report.roadmap is not None
    assert len(report.roadmap.milestones) >= 3

    # 5. Fetch Dashboard Metrics
    metrics = await report_engine.get_dashboard_metrics(user_id=user_id)
    assert metrics.user_id == user_id
    assert metrics.readiness_level is not None
    assert len(metrics.dimension_averages) == 5


@pytest.mark.asyncio
async def test_report_routes_require_auth():
    """Verify unauthenticated requests to report and roadmap endpoints return 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.post("/api/v1/report/generate/fake-session")
        assert r1.status_code == 401

        r2 = await client.get("/api/v1/report/session/fake-session")
        assert r2.status_code == 401

        r3 = await client.get("/api/v1/roadmap/user/latest")
        assert r3.status_code == 401

        r4 = await client.get("/api/v1/dashboard/metrics")
        assert r4.status_code == 401


@pytest.mark.asyncio
async def test_report_routes_with_mock_auth():
    """Verify report and roadmap endpoints respond with valid JSON under authenticated session."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Start an interview
            start_res = await client.post(
                "/api/v1/interview/start",
                json={"target_role": "AI Engineer", "total_questions": 3}
            )
            assert start_res.status_code == 200
            session_id = start_res.json()["session_id"]

            # 2. Answer question
            ans_res = await client.post(
                f"/api/v1/interview/{session_id}/answer",
                json={"answer_text": "I train models with PyTorch and deploy them via FastAPI with ONNX runtime.", "duration_seconds": 25}
            )
            assert ans_res.status_code == 200

            # 3. Generate Report endpoint
            rep_res = await client.post(f"/api/v1/report/generate/{session_id}")
            assert rep_res.status_code == 200
            rep_data = rep_res.json()
            assert rep_data["session_id"] == session_id
            assert "dimension_scores" in rep_data
            assert "roadmap" in rep_data

            # 4. Roadmap endpoint
            road_res = await client.get("/api/v1/roadmap/user/latest")
            assert road_res.status_code == 200
            assert "milestones" in road_res.json()

            # 5. Dashboard metrics endpoint
            dash_res = await client.get("/api/v1/dashboard/metrics")
            assert dash_res.status_code == 200
            assert "average_interview_score" in dash_res.json()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
