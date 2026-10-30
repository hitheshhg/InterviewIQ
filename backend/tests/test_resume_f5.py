import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.dependencies import get_current_user
from app.models.canonical_resume import (
    CanonicalResume,
    ContactInfo,
    CategorizedSkills,
    ExperienceItem,
    ProjectItem,
    EducationItem,
    SaveActiveResumeRequest,
)
from app.services.canonical_resume_manager import canonical_resume_manager
from app.services.question_seed_generator import question_seed_generator
from app.services.canonical_parser import canonical_parser
from tests.test_resume_f1 import RESUME_1_STRONG_CS, RESUME_2_WEAK_DRAFT

TEST_USER_F5 = {
    "firebase_uid": "user_shreya_f5_test",
    "email": "shreya.f5@vtu.ac.in",
    "name": "Shreya VTU",
}

TEST_NEW_USER = {
    "firebase_uid": "user_new_candidate_f5",
    "email": "new.candidate@vtu.ac.in",
    "name": "New Candidate",
}


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_F5
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_question_seeds_generation_from_unproven_skills():
    """Verify that skills claimed with zero project/experience evidence generate probing seeds."""
    resume = CanonicalResume(
        contact=ContactInfo(
            full_name="Candidate CS",
            email="candidate@vtu.ac.in",
            phone="1234567890",
            location="Bengaluru",
        ),
        summary="Software Developer with Python and web experience.",
        skills=CategorizedSkills(
            languages=["Python"],
            frameworks=["FastAPI"],
            developer_tools=["Docker", "Kubernetes"],  # Docker & K8s are unproven below
            cloud_databases=["MongoDB"],
            other=[],
        ),
        experience=[
            ExperienceItem(
                company="TechCorp",
                role="Backend Intern",
                location="Bengaluru",
                start_date="2023",
                end_date="2024",
                bullets=["Built REST endpoints using Python and FastAPI with MongoDB Atlas."],
            )
        ],
        projects=[],
        education=[],
        certifications=[],
    )

    seeds = question_seed_generator.generate_seeds(resume=resume)
    assert len(seeds) >= 1
    # Either Docker or Kubernetes should be flagged as unproven
    assert any("Docker" in s or "Kubernetes" in s for s in seeds)
    assert any("no direct project" in s or "technical skills" in s for s in seeds)


@pytest.mark.asyncio
async def test_question_seeds_generation_from_weak_claims():
    """Verify that passive phrasing in bullets produces probing seeds on architecture/contribution."""
    resume = await canonical_parser.parse_resume_text(RESUME_2_WEAK_DRAFT)

    seeds = question_seed_generator.generate_seeds(
        resume=resume,
        job_description="Seeking a developer with Python and web experience.",
        target_role="Junior Developer",
    )

    assert len(seeds) >= 1
    # Check that passive phrasing or unproven skills are probed
    assert any("SmallCo" in s or "fixing bugs" in s or "technical architecture" in s for s in seeds)


@pytest.mark.asyncio
async def test_question_seeds_from_missing_jd_skills():
    """Verify that missing skills in target JD trigger ramp-up / architecture seeds."""
    resume = await canonical_parser.parse_resume_text(RESUME_2_WEAK_DRAFT)
    target_jd = "Looking for an engineer with Docker and Redis experience."

    seeds = question_seed_generator.generate_seeds(
        resume=resume,
        job_description=target_jd,
        target_role="Full Stack Developer",
    )

    assert any("Docker" in s or "Redis" in s for s in seeds)


@pytest.mark.asyncio
async def test_interview_active_context_endpoint_with_and_without_resume():
    """
    Test GET /api/v1/interview/active-context:
    - User with active resume receives has_resume=True, active_version, and question_seeds.
    - New user receives has_resume=False.
    """
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. New user without resume
        app.dependency_overrides[get_current_user] = lambda: TEST_NEW_USER
        res_new = await client.get("/api/v1/interview/active-context")
        assert res_new.status_code == 200
        data_new = res_new.json()
        assert data_new["has_resume"] is False
        assert data_new["active_version"] is None
        assert len(data_new["question_seeds"]) == 0

        # 2. User with active resume
        app.dependency_overrides[get_current_user] = lambda: TEST_USER_F5
        parsed_resume = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)
        save_req = SaveActiveResumeRequest(
            canonical_resume=parsed_resume,
            target_role="Full Stack Developer",
            job_description="Proficient in Python and FastAPI",
            file_name="Shreya_Resume_v1.pdf",
            current_score=88,
        )
        await canonical_resume_manager.save_active_resume(
            user_id=TEST_USER_F5["firebase_uid"],
            payload=save_req,
        )

        res_active = await client.get("/api/v1/interview/active-context")
        assert res_active.status_code == 200
        data_active = res_active.json()
        assert data_active["has_resume"] is True
        assert data_active["active_version"] >= 1
        assert "Shreya" in data_active["file_name"]
        assert len(data_active["question_seeds"]) >= 1


@pytest.mark.asyncio
async def test_automatic_active_resume_usage_in_interview_start():
    """
    Verify that calling POST /api/v1/interview/start without resume_id
    automatically binds candidate's active resume and generates seeds.
    """
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        app.dependency_overrides[get_current_user] = lambda: TEST_USER_F5

        start_payload = {
            "target_role": "Full Stack Developer",
            "total_questions": 3,
            "initial_difficulty": "medium",
        }

        res = await client.post("/api/v1/interview/start", json=start_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "in_progress"
        assert data["current_question_index"] == 1
        assert "first_question" in data
        assert data["active_resume_version"] is not None
        assert data["active_resume_version"] >= 1
        assert len(data["question_seeds"]) >= 1


@pytest.mark.asyncio
async def test_dashboard_metrics_displays_resume_score_and_version_trend():
    """Verify candidate dashboard metrics include latest ATS score and version trend."""
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        app.dependency_overrides[get_current_user] = lambda: TEST_USER_F5

        res = await client.get("/api/v1/dashboard/metrics")
        assert res.status_code == 200
        data = res.json()
        assert "latest_ats_score" in data
        assert data["latest_ats_score"] is not None
        assert data["latest_ats_score"] >= 70
        assert "resume_version_trend" in data
        assert len(data["resume_version_trend"]) >= 1
        assert data["resume_version_trend"][0]["version"] >= 1
