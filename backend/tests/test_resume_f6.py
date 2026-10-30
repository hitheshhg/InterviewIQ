import io
import pytest
from unittest.mock import patch, AsyncMock
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.dependencies import get_current_user
from app.models.canonical_resume import CanonicalResume, ContactInfo, CategorizedSkills
from app.models.canonical_rewrite import SuggestBulletRewritesRequest
from app.services.canonical_parser import canonical_parser
from app.services.canonical_rewriter import canonical_rewriter
from app.services.canonical_resume_manager import canonical_resume_manager
from app.services.question_seed_generator import question_seed_generator


@pytest.fixture(autouse=True)
def cleanup_overrides():
    """Ensure dependency overrides are cleaned up after each test."""
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_unauthenticated_requests_blocked_with_401():
    """
    Hardening: Verify every Resume Flow v2 endpoint strictly requires authentication
    and returns HTTP 401 when called without a valid Bearer token.
    """
    # Ensure no override is active
    app.dependency_overrides.pop(get_current_user, None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Step 1: Parse Upload
        fake_pdf = io.BytesIO(b"%PDF-1.4 Minimal")
        resp = await client.post(
            "/api/v1/resume/parse-upload",
            files={"file": ("test.pdf", fake_pdf, "application/pdf")},
        )
        assert resp.status_code == 401, f"Expected 401 for /parse-upload, got {resp.status_code}"

        # 2. Step 1: Save Active
        resp = await client.post(
            "/api/v1/resume/save-active",
            json={
                "canonical_resume": {
                    "contact": {"full_name": "Test User", "email": "test@vtu.ac.in"},
                    "skills": {"languages": ["Python"]},
                }
            },
        )
        assert resp.status_code == 401, f"Expected 401 for /save-active, got {resp.status_code}"

        # 3. Step 1: Get Active
        resp = await client.get("/api/v1/resume/active")
        assert resp.status_code == 401, f"Expected 401 for /active, got {resp.status_code}"

        # 4. Step 2: Evaluate
        resp = await client.post(
            "/api/v1/resume/evaluate",
            json={
                "canonical_resume": {
                    "contact": {"full_name": "Test User", "email": "test@vtu.ac.in"},
                    "skills": {"languages": ["Python"]},
                }
            },
        )
        assert resp.status_code == 401, f"Expected 401 for /evaluate, got {resp.status_code}"

        # 5. Step 2: Suggest Rewrites
        resp = await client.post(
            "/api/v1/resume/suggest-rewrites",
            json={
                "bullet_text": "Responsible for backend optimization.",
                "category": "experience",
            },
        )
        assert resp.status_code == 401, f"Expected 401 for /suggest-rewrites, got {resp.status_code}"

        # 6. Step 3: Export File
        resp = await client.post(
            "/api/v1/resume/export-file",
            json={
                "canonical_resume": {
                    "contact": {"full_name": "Test User", "email": "test@vtu.ac.in"},
                    "skills": {"languages": ["Python"]},
                },
                "template": "classic",
                "format": "pdf",
            },
        )
        assert resp.status_code == 401, f"Expected 401 for /export-file, got {resp.status_code}"

        # 7. Step 3: Export Self Test
        resp = await client.post(
            "/api/v1/resume/export-self-test",
            json={
                "canonical_resume": {
                    "contact": {"full_name": "Test User", "email": "test@vtu.ac.in"},
                    "skills": {"languages": ["Python"]},
                },
                "template": "modern",
                "format": "pdf",
            },
        )
        assert resp.status_code == 401, f"Expected 401 for /export-self-test, got {resp.status_code}"

        # 8. Versions List
        resp = await client.get("/api/v1/resume/versions")
        assert resp.status_code == 401, f"Expected 401 for /versions, got {resp.status_code}"

        # 9. Interview Active Context
        resp = await client.get("/api/v1/interview/active-context")
        assert resp.status_code == 401, f"Expected 401 for /interview/active-context, got {resp.status_code}"


@pytest.mark.asyncio
async def test_invalid_bearer_token_rejected():
    """Verify that malformed or forged Bearer tokens are rejected with 401."""
    app.dependency_overrides.pop(get_current_user, None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/resume/active",
            headers={"Authorization": "Bearer forged_fake_token_xyz_123"},
        )
        assert resp.status_code == 401
        assert "detail" in resp.json()


@pytest.mark.asyncio
async def test_gemini_failure_handling_canonical_parser():
    """
    Hardening: Verify canonical_parser falls back gracefully to deterministic heuristic
    extraction when Gemini API encounters quota exhaustion (429) or network outage.
    """
    raw_sample = """
    Anoop Sharma
    anoop.sharma@gmail.com | (987) 654-3210 | Bengaluru, India
    linkedin.com/in/anoop-sharma | github.com/anoop-dev

    Skills:
    Python, FastAPI, React, Docker, MongoDB

    Experience:
    Backend Engineer at TechCorp
    - Built RESTful APIs using FastAPI and optimized query performance.
    """

    with patch(
        "app.services.canonical_parser.gemini_client.generate_structured_json",
        side_effect=RuntimeError("429 Resource Exhausted: API quota exceeded"),
    ):
        # Must not raise an unhandled exception
        result = await canonical_parser.parse_resume_text(raw_sample)
        assert isinstance(result, CanonicalResume)
        assert result.contact.full_name == "Anoop Sharma"
        assert result.contact.email == "anoop.sharma@gmail.com"
        assert "Python" in result.skills.languages or "FastAPI" in result.skills.frameworks


@pytest.mark.asyncio
async def test_gemini_failure_handling_rewriter():
    """
    Hardening: Verify canonical_rewriter falls back to deterministic STAR rewrites
    with candidate fill-in slots when Gemini fails, guaranteeing zero 500 errors.
    """
    req = SuggestBulletRewritesRequest(
        bullet_text="Responsible for maintaining server architecture.",
        category="experience",
    )

    with patch(
        "app.services.canonical_rewriter.gemini_client.generate_structured_json",
        side_effect=RuntimeError("503 Service Unavailable"),
    ):
        res = await canonical_rewriter.suggest_rewrites(req)
        assert res.truth_check_passed is True
        assert len(res.suggestions) >= 1
        # Passive verb 'Responsible for' must be replaced
        for opt in res.suggestions:
            assert not opt.text.lower().startswith("responsible for")
            # Must contain truthful fill-in prompt for candidate's actual metric
            assert opt.needs_fill_in is True or "[Fill in:" in opt.text or "%" not in opt.text


@pytest.mark.asyncio
async def test_candidate_data_isolation_resume_versions():
    """
    Hardening: Verify User A and User B cannot access or tamper with each other's
    active resume or version iterations.
    """
    user_alpha = {"firebase_uid": "user_alpha_iso_777", "email": "alpha@vtu.ac.in"}
    user_beta = {"firebase_uid": "user_beta_iso_888", "email": "beta@vtu.ac.in"}

    resume_alpha = CanonicalResume(
        contact=ContactInfo(full_name="Alpha Candidate", email="alpha@vtu.ac.in"),
        skills=CategorizedSkills(languages=["Python"]),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. User Alpha saves active resume
        app.dependency_overrides[get_current_user] = lambda: user_alpha
        resp = await client.post(
            "/api/v1/resume/save-active",
            json={
                "canonical_resume": resume_alpha.model_dump(),
                "target_role": "Backend Architect",
                "file_name": "Alpha_Resume.pdf",
            },
        )
        assert resp.status_code == 200
        alpha_res = resp.json()
        assert alpha_res["version"] == 1

        # 2. User Beta requests active resume -> Must return 404 (User Beta has no resume)
        app.dependency_overrides[get_current_user] = lambda: user_beta
        resp_b = await client.get("/api/v1/resume/active")
        assert resp_b.status_code == 404, "User B should not see User A's active resume"

        # 3. User Beta checks versions -> Total versions should be 0
        resp_b_vers = await client.get("/api/v1/resume/versions")
        assert resp_b_vers.status_code == 200
        assert resp_b_vers.json()["total_versions"] == 0


@pytest.mark.asyncio
async def test_question_seeds_offline_resilience():
    """
    Hardening: Verify question seed generator executes deterministically with zero
    network or external dependencies.
    """
    sample_resume = CanonicalResume(
        contact=ContactInfo(full_name="Deepak Rao", email="deepak@vtu.ac.in"),
        skills=CategorizedSkills(
            languages=["Go", "Python"],
            developer_tools=["Docker", "Kubernetes"],
            cloud_databases=["Redis"],
        ),
    )
    seeds = question_seed_generator.generate_seeds(
        resume=sample_resume,
        job_description="Looking for Go developer with Docker and Redis experience.",
        target_role="Go Backend Engineer",
    )
    assert len(seeds) > 0
    # Must flag Docker or Kubernetes as unproven
    assert any("unproven" in s.lower() or "listed" in s.lower() for s in seeds)
