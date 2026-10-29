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
from app.models.multi_jd import JobDescriptionInput, MultiJDCompareRequest
from app.services.multi_jd_comparator import multi_jd_comparator

MOCK_USER = {
    "firebase_uid": "user_multijd_test_505",
    "email": "multijd.tester@vtu.ac.in",
    "display_name": "Multi-JD Tester",
}


def get_test_resume() -> CanonicalResume:
    return CanonicalResume(
        contact=ContactInfo(
            full_name="Shreya Sharma",
            email="shreya.sharma@vtu.ac.in",
            phone="+91 9876543210",
            location="Bengaluru, India",
        ),
        summary="Full Stack Software Engineer with expertise in React, TypeScript, FastAPI, MongoDB, and Docker.",
        skills=CategorizedSkills(
            languages=["Python", "TypeScript", "JavaScript", "SQL"],
            frameworks_libraries=["React", "FastAPI", "Tailwind CSS"],
            cloud_databases=["MongoDB", "PostgreSQL", "Redis"],
            developer_tools=["Docker", "Git", "Vite", "Linux"],
            core_concepts=["RESTful APIs", "Microservices"],
        ),
        experience=[
            ExperienceItem(
                company="CloudScale Solutions",
                role="Full Stack Developer",
                start_date="Jan 2023",
                end_date="Present",
                is_current=True,
                bullets=[
                    "Engineered FastAPI microservices handling 50k requests with 35% latency reduction.",
                    "Developed responsive React frontends with 95% test coverage.",
                ],
            )
        ],
        projects=[
            ProjectItem(
                title="InterviewIQ",
                tech_stack=["React", "FastAPI", "MongoDB"],
                bullets=["Built automated multi-turn audio interview simulator."],
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
# Sample JDs
# --------------------------------------------------------------------------
JD_REACT_FASTAPI = JobDescriptionInput(
    id="jd-fullstack",
    title="Full Stack Engineer",
    company="TechCorp",
    text="We are seeking a Full Stack Engineer with expertise in React, TypeScript, Python, FastAPI, and MongoDB.",
)

JD_DEVOPS_CLOUD = JobDescriptionInput(
    id="jd-devops",
    title="Cloud & DevOps Engineer",
    company="CloudScale",
    text="Looking for a DevOps Engineer with deep skills in Kubernetes, Terraform, AWS, Docker, and Linux CI/CD pipelines.",
)

JD_BACKEND_PYTHON = JobDescriptionInput(
    id="jd-backend",
    title="Backend Python Developer",
    company="Stripe",
    text="Seeking a Backend Engineer proficient in Python, FastAPI, PostgreSQL, Redis, and REST APIs.",
)

JD_FRONTEND_VUE = JobDescriptionInput(
    id="jd-frontend",
    title="Frontend Specialist",
    company="DesignCo",
    text="Frontend Engineer required with Vue.js, Angular, JavaScript, CSS, and HTML design systems.",
)

JD_DATA_ENG = JobDescriptionInput(
    id="jd-data",
    title="Data Engineer",
    company="DataFlow",
    text="Data Engineer proficient in Python, SQL, Apache Spark, Kafka, and Snowflake pipelines.",
)


# --------------------------------------------------------------------------
# 1. Single & Multi-JD Unit Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_compare_single_jd():
    """Verify comparison with exactly 1 JD works cleanly."""
    resume = get_test_resume()
    req = MultiJDCompareRequest(resume=resume, job_descriptions=[JD_REACT_FASTAPI])

    res = await multi_jd_comparator.compare_multiple_jds(req)

    assert len(res.rankings) == 1
    assert res.best_fit_jd_id == "jd-fullstack"
    assert res.rankings[0].title == "Full Stack Engineer"
    assert res.rankings[0].overall_score >= 80
    assert len(res.skill_matrix) > 0


@pytest.mark.asyncio
async def test_compare_three_jds():
    """Verify comparison with 3 distinct JDs produces proper rankings and heatmap."""
    resume = get_test_resume()
    req = MultiJDCompareRequest(
        resume=resume,
        job_descriptions=[JD_REACT_FASTAPI, JD_DEVOPS_CLOUD, JD_BACKEND_PYTHON],
    )

    res = await multi_jd_comparator.compare_multiple_jds(req)

    assert len(res.rankings) == 3
    # Candidate is Full Stack / Python, so Full Stack or Backend should outscore Cloud/DevOps (missing Kubernetes/AWS)
    scores = {r.jd_id: r.overall_score for r in res.rankings}
    assert scores["jd-fullstack"] >= scores["jd-devops"]
    assert res.best_fit_jd_id in ["jd-fullstack", "jd-backend"]

    # Verify skill heatmap matrix covers all 3 JDs
    for row in res.skill_matrix:
        assert len(row.cells) == 3
        for jd_id in ["jd-fullstack", "jd-devops", "jd-backend"]:
            assert row.cells[jd_id] in ["matched", "partial", "missing"]


@pytest.mark.asyncio
async def test_compare_five_jds_and_common_gaps():
    """Verify max 5 JDs comparison calculates common skill gaps and ranking correctly."""
    resume = get_test_resume()
    req = MultiJDCompareRequest(
        resume=resume,
        job_descriptions=[
            JD_REACT_FASTAPI,
            JD_DEVOPS_CLOUD,
            JD_BACKEND_PYTHON,
            JD_FRONTEND_VUE,
            JD_DATA_ENG,
        ],
    )

    res = await multi_jd_comparator.compare_multiple_jds(req)

    assert len(res.rankings) == 5
    assert res.best_fit_jd_id == res.rankings[0].jd_id

    # Verify Common Gaps contains skills candidate lacks across multiple JDs (e.g. Kubernetes, AWS, Kafka)
    assert len(res.common_gaps) > 0

    # Verify chart data has 5 metrics
    assert len(res.comparison_chart_data) == 5


@pytest.mark.asyncio
async def test_duplicate_jds_and_caching():
    """Verify duplicate JDs are processed smoothly using in-memory cache without errors."""
    resume = get_test_resume()
    dup_jd_1 = JobDescriptionInput(
        id="jd-dup-1",
        title="Full Stack Engineer",
        company="Company A",
        text="We are seeking a Full Stack Engineer with React and FastAPI.",
    )
    dup_jd_2 = JobDescriptionInput(
        id="jd-dup-2",
        title="Full Stack Engineer",
        company="Company B",
        text="We are seeking a Full Stack Engineer with React and FastAPI.",
    )

    req = MultiJDCompareRequest(resume=resume, job_descriptions=[dup_jd_1, dup_jd_2])
    res = await multi_jd_comparator.compare_multiple_jds(req)

    assert len(res.rankings) == 2
    # Both identical JDs should produce identical scores
    assert res.rankings[0].overall_score == res.rankings[1].overall_score


@pytest.mark.asyncio
async def test_empty_jd_validation():
    """Verify empty or short text (< 15 chars) is rejected gracefully."""
    resume = get_test_resume()
    # Bypass pydantic validation using model_construct to test service-level guard
    empty_jd = JobDescriptionInput.model_construct(
        id="jd-empty",
        title="Short Role",
        company="None",
        text="short text",
    )

    req = MultiJDCompareRequest(resume=resume, job_descriptions=[empty_jd])
    with pytest.raises(ValueError, match="At least one valid Job Description"):
        await multi_jd_comparator.compare_multiple_jds(req)


# --------------------------------------------------------------------------
# 2. API Endpoint & Security Token Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_compare_endpoint_unauthenticated_returns_401():
    """Verify unauthenticated call returns 401 Unauthorized."""
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/resume-studio/compare-jds",
            json={
                "resume": get_test_resume().model_dump(),
                "job_descriptions": [JD_REACT_FASTAPI.model_dump()],
            },
        )
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_compare_endpoint_authenticated_returns_results():
    """Verify authenticated call returns complete MultiJDCompareResponse."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            payload = {
                "resume": get_test_resume().model_dump(),
                "job_descriptions": [
                    JD_REACT_FASTAPI.model_dump(),
                    JD_BACKEND_PYTHON.model_dump(),
                ],
            }
            res = await ac.post("/api/v1/resume-studio/compare-jds", json=payload)
            assert res.status_code == 200
            data = res.json()

            assert "rankings" in data
            assert len(data["rankings"]) == 2
            assert "best_fit_jd_id" in data
            assert "skill_matrix" in data
            assert "common_gaps" in data
            assert "comparison_chart_data" in data
    finally:
        app.dependency_overrides.clear()
