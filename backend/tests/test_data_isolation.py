import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.dependencies import get_current_user
from app.database import get_db
from app.models.session import StartInterviewRequest
from app.services.session_manager import session_manager


@pytest.mark.asyncio
async def test_candidate_data_isolation_between_accounts():
    """Verify that two different accounts cannot view or leak each other's interview sessions or metrics."""
    user_a = {
        "firebase_uid": "user_a_isolated_111",
        "email": "user.a@vtu.ac.in",
        "display_name": "Candidate Alpha",
    }
    user_b = {
        "firebase_uid": "user_b_isolated_222",
        "email": "user.b@vtu.ac.in",
        "display_name": "Candidate Beta",
    }

    # 1. Create a session for User A in session manager
    req_a = StartInterviewRequest(target_role="Frontend Specialist", total_questions=3)
    res_a = await session_manager.start_session(user_id=user_a["firebase_uid"], request=req_a)
    session_id_a = res_a.session_id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 2. When User A queries their own session, it succeeds
        app.dependency_overrides[get_current_user] = lambda: user_a
        resp_a = await client.get(f"/api/v1/interview/{session_id_a}")
        assert resp_a.status_code == 200
        assert resp_a.json()["session_id"] == session_id_a

        # 3. When User B attempts to access User A's session, they are denied (404 Not Found)
        app.dependency_overrides[get_current_user] = lambda: user_b
        resp_b_hijack = await client.get(f"/api/v1/interview/{session_id_a}")
        assert resp_b_hijack.status_code == 404

        # 4. User B dashboard metrics do NOT include User A's sessions
        resp_b_metrics = await client.get("/api/v1/dashboard/metrics")
        assert resp_b_metrics.status_code == 200
        metrics_b = resp_b_metrics.json()
        assert metrics_b["total_interviews_completed"] == 0
        assert len(metrics_b["recent_sessions"]) == 0

        # Clean up dependency override
        app.dependency_overrides.pop(get_current_user, None)

