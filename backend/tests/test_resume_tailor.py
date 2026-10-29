import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.dependencies import get_current_user
from app.models.resume_studio import (
    CanonicalResume,
    ContactInfo,
    CategorizedSkills,
    ExperienceItem,
    ProjectItem,
    EducationItem,
)
from app.models.tailor import TailorResumeRequest
from app.services.resume_tailor import resume_tailor_service

MOCK_USER = {
    "firebase_uid": "user_tailor_test_606",
    "email": "tailor.tester@vtu.ac.in",
    "display_name": "Tailor Tester",
}


def get_base_resume() -> CanonicalResume:
    return CanonicalResume(
        contact=ContactInfo(
            full_name="Shreya Sharma",
            email="shreya.sharma@vtu.ac.in",
            phone="+91 9876543210",
            location="Bengaluru, India",
        ),
        summary="Software engineer with 2+ years of experience in web application development using Python and React.",
        skills=CategorizedSkills(
            languages=["Go", "Python", "JavaScript", "TypeScript"],
            frameworks_libraries=["Tailwind CSS", "FastAPI", "React"],
            cloud_databases=["Redis", "PostgreSQL", "MongoDB"],
            developer_tools=["Git", "Docker", "Linux"],
            core_concepts=["Microservices", "RESTful APIs"],
        ),
        experience=[
            ExperienceItem(
                company="CloudScale",
                role="Full Stack Developer",
                start_date="Jan 2023",
                end_date="Present",
                is_current=True,
                bullets=[
                    "Maintained internal company developer tools and automated tests.",
                    "Engineered FastAPI microservices and PostgreSQL schemas handling 50k requests with 35% latency drop.",
                ],
            )
        ],
        projects=[
            ProjectItem(
                title="InterviewIQ Platform",
                tech_stack=["React", "FastAPI", "MongoDB"],
                bullets=["Built real-time scoring engine evaluating technical candidate resumes."],
            )
        ],
        education=[
            EducationItem(
                institution="VTU",
                degree="B.E. Computer Science",
                start_date="2020",
                end_date="2024",
                gpa_or_percentage="8.9 CGPA",
            )
        ],
        certifications=[],
        achievements=[],
    )


# --------------------------------------------------------------------------
# 1. Front-loading Algorithms Tests
# --------------------------------------------------------------------------
def test_front_load_skills_places_matching_keywords_first():
    """Verify skills matching the JD are front-loaded to the start of arrays."""
    langs = ["Go", "Python", "JavaScript", "TypeScript"]
    jd_skills = {"typescript", "python"}

    reordered, changed = resume_tailor_service.front_load_skills(langs, jd_skills)

    assert changed is True
    # Python and TypeScript should be in the first 2 positions
    first_two = [s.lower() for s in reordered[:2]]
    assert "python" in first_two
    assert "typescript" in first_two
    assert set(reordered) == set(langs)


def test_front_load_bullets_elevates_matching_accomplishments():
    """Verify bullets containing matching JD skills are moved to the top."""
    bullets = [
        "Maintained internal company developer tools and automated tests.",
        "Engineered FastAPI microservices and PostgreSQL schemas handling 50k requests.",
    ]
    jd_skills = {"fastapi", "postgresql"}

    reordered, changed = resume_tailor_service.front_load_bullets(bullets, jd_skills)

    assert changed is True
    # The FastAPI & PostgreSQL bullet must be first
    assert "FastAPI" in reordered[0]
    assert "PostgreSQL" in reordered[0]


# --------------------------------------------------------------------------
# 2. End-to-End Tailoring & Score Improvement Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_tailoring_produces_higher_or_equal_ats_score():
    """Verify tailored resume produces a higher or equal ATS score than the base resume."""
    resume = get_base_resume()
    jd_text = (
        "Seeking a Senior Python & FastAPI Engineer proficient in FastAPI, PostgreSQL, "
        "and RESTful APIs microservices architecture."
    )

    req = TailorResumeRequest(
        resume=resume,
        job_description=jd_text,
        target_role="Senior Python Engineer",
        target_company="Stripe",
    )

    res = await resume_tailor_service.tailor_resume(req)

    assert res.projected_tailored_score >= res.base_score
    assert res.score_delta >= 0
    assert len(res.diff_items) >= 2
    assert res.target_role == "Senior Python Engineer"
    assert res.target_company == "Stripe"

    # Verify tailored summary mentions the target role
    assert "Senior Python Engineer" in res.tailored_resume.summary or "Python" in res.tailored_resume.summary


@pytest.mark.asyncio
async def test_tailoring_diff_items_and_evidence_check():
    """Verify diff items accurately track summary, skills, and unverified claims."""
    resume = get_base_resume()
    jd_text = "Looking for a React and TypeScript frontend developer."

    req = TailorResumeRequest(
        resume=resume,
        job_description=jd_text,
        target_role="Frontend Developer",
        target_company="Meta",
    )

    res = await resume_tailor_service.tailor_resume(req)

    diff_sections = [d.section for d in res.diff_items]
    assert "Professional Summary" in diff_sections
    assert isinstance(res.unverified_claims_count, int)


# --------------------------------------------------------------------------
# 3. API Security & Endpoint Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_tailor_endpoint_unauthenticated_returns_401():
    """Verify unauthenticated call returns 401."""
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/resume-studio/tailor",
            json={
                "resume": get_base_resume().model_dump(),
                "job_description": "We need a Python developer.",
                "target_role": "Python Developer",
            },
        )
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_tailor_endpoint_authenticated_returns_diff():
    """Verify authenticated call returns complete TailorResumeResponse with diffs."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            payload = {
                "resume": get_base_resume().model_dump(),
                "job_description": "We are seeking a Full Stack Engineer with FastAPI, React, and PostgreSQL.",
                "target_role": "Full Stack Engineer",
                "target_company": "TechCorp",
            }
            res = await ac.post("/api/v1/resume-studio/tailor", json=payload)
            assert res.status_code == 200
            data = res.json()

            assert "tailored_resume" in data
            assert "base_score" in data
            assert "projected_tailored_score" in data
            assert "diff_items" in data
            assert len(data["diff_items"]) > 0
    finally:
        app.dependency_overrides.clear()
