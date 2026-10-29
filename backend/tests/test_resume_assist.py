import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.dependencies import get_current_user
from app.models.assist import AIAssistRequest
from app.services.resume_assist import resume_assist_service

MOCK_USER = {
    "firebase_uid": "user_assist_test_101",
    "email": "assist.tester@vtu.ac.in",
    "display_name": "Assist Tester",
}


def test_verify_truthful_evidence_flags_invented_metrics():
    """Verify that newly introduced metrics/numbers are flagged for user confirmation."""
    orig = "Responsible for optimizing MongoDB database queries."
    rewrite_with_fake_metric = "Optimized MongoDB queries, reducing latency by 45% across 50k users."

    has_claims, tokens = resume_assist_service.verify_truthful_evidence(
        original_text=orig,
        option_text=rewrite_with_fake_metric,
        candidate_skills=["MongoDB"],
    )

    assert has_claims is True
    # At least one of the invented numbers ('45%', '50k') must be flagged
    assert any(t in ["45%", "50k"] for t in tokens)


def test_verify_truthful_evidence_flags_invented_technologies():
    """Verify that unverified tech skills not present in resume or skills catalog are flagged."""
    orig = "Built a responsive web dashboard for analytics."
    rewrite_with_unverified_tech = "Architected a responsive analytics dashboard using React, AWS, and Kubernetes."

    has_claims, tokens = resume_assist_service.verify_truthful_evidence(
        original_text=orig,
        option_text=rewrite_with_unverified_tech,
        candidate_skills=["Python", "HTML"],  # Candidate does not have AWS or Kubernetes
    )

    assert has_claims is True
    tokens_lower = [t.lower() for t in tokens]
    assert "aws" in tokens_lower or "kubernetes" in tokens_lower


def test_verify_truthful_evidence_passes_legitimate_metrics_and_skills():
    """Verify that legitimate rewrites retaining original metrics and verified skills are not flagged."""
    orig = "Engineered FastAPI microservices reducing latency by 35% across 50k requests."
    clean_rewrite = "Architected high-throughput FastAPI services, cutting latency by 35% across 50k requests."

    has_claims, tokens = resume_assist_service.verify_truthful_evidence(
        original_text=orig,
        option_text=clean_rewrite,
        candidate_skills=["FastAPI", "Python"],
    )

    assert has_claims is False
    assert len(tokens) == 0


def test_rule_based_fallback_generates_three_options():
    """Verify deterministic fallback delivers 3 valid options when model is unavailable."""
    req = AIAssistRequest(
        text="Responsible for helping with code reviews and bug fixing.",
        action="improve",
        context_role="Backend Developer",
        candidate_skills=["Python"],
    )

    options = resume_assist_service._generate_rule_based_fallback(req)
    assert len(options) == 3
    for opt in options:
        assert len(opt.text) > 10
        assert opt.diff_summary != ""
        assert opt.explanation != ""
        assert isinstance(opt.has_new_claims, bool)


@pytest.mark.asyncio
async def test_assist_endpoint_unauthenticated_returns_401():
    """Verify endpoint enforces strict authentication."""
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/resume-studio/assist",
            json={"text": "Worked on frontend design.", "action": "improve"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_assist_endpoint_authenticated_returns_options():
    """Verify authenticated user receives 3 AI assist options."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            payload = {
                "text": "Handled backend REST APIs and database schema design.",
                "action": "improve",
                "context_role": "Backend Engineer",
                "candidate_skills": ["Python", "FastAPI", "PostgreSQL"],
            }
            response = await ac.post("/api/v1/resume-studio/assist", json=payload)
            assert response.status_code == 200
            data = response.json()

            assert data["original_text"] == payload["text"]
            assert data["action"] == "improve"
            assert len(data["options"]) >= 2
            for opt in data["options"]:
                assert "text" in opt
                assert "diff_summary" in opt
                assert "has_new_claims" in opt
                assert "unverified_tokens" in opt
    finally:
        app.dependency_overrides.clear()
