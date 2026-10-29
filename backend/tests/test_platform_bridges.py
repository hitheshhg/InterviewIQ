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
from app.models.session import StartInterviewRequest
from app.services.session_manager import session_manager
from app.services.platform_bridges import platform_bridges_service
from app.models.platform_bridges import GenerateRoadmapFromGapsRequest

MOCK_USER = {
    "uid": "shreya_vtu_bridge_user",
    "firebase_uid": "shreya_vtu_bridge_user",
    "email": "shreya.bridge@vtu.ac.in",
    "name": "Shreya VTU Bridge",
}

TEST_RESUME = CanonicalResume(
    contact=ContactInfo(
        full_name="Shreya Sharma",
        email="shreya@vtu.ac.in",
        phone="+91 9876543210",
        location="Bengaluru, India",
    ),
    summary="Software Engineer experienced in building web applications with Python and FastAPI.",
    skills=CategorizedSkills(
        languages=["Python", "SQL"],
        frameworks_libraries=["FastAPI"],
        cloud_databases=["PostgreSQL"],
        developer_tools=["Kubernetes", "Git", "Docker"],  # Kubernetes is in skills but NOT in bullets!
        core_concepts=["RESTful APIs"],
    ),
    experience=[
        ExperienceItem(
            id="exp-1",
            company="Alpha Systems",
            role="Software Engineer",
            location="Bengaluru",
            start_date="2023",
            end_date="Present",
            is_current=True,
            bullets=[
                "Responsible for developing backend endpoints with FastAPI.",  # Passive phrase!
                "Managed PostgreSQL database migrations with zero downtime.",  # Missing metric!
            ],
        )
    ],
    projects=[
        ProjectItem(
            id="proj-1",
            title="InterviewIQ Platform",
            tech_stack=["Python", "FastAPI", "Docker"],
            bullets=["Engineered deterministic resume scoring engine."],
        )
    ],
    education=[
        EducationItem(
            id="edu-1",
            institution="VTU",
            degree="B.E. Computer Science",
            start_date="2020",
            end_date="2024",
        )
    ],
)

SAMPLE_JD = """
Full Stack Software Engineer
We require hands-on production expertise in Python, FastAPI, and Apache Kafka for event-driven streaming.
"""


def test_generate_interview_seeds_detects_unsubstantiated_skills_and_weak_claims():
    """Verify bridge service finds unsubstantiated skills (Kubernetes) and weak claims."""
    res = platform_bridges_service.generate_interview_seeds(
        resume=TEST_RESUME,
        job_description=SAMPLE_JD,
        target_role="Full Stack Engineer",
    )

    assert res.total_seeds > 0
    seed_types = [s.seed_type for s in res.seeds]

    # 1. Unsubstantiated skill: Kubernetes (listed in tools, never in bullets)
    assert "unsubstantiated_skill" in seed_types
    k8s_seed = next((s for s in res.seeds if "kubernetes" in s.topic.lower()), None)
    assert k8s_seed is not None
    assert "no project or experience bullet" in k8s_seed.seed_prompt.lower()

    # 2. Weak claim: passive phrase "responsible for" or missing metric
    assert "weak_claim" in seed_types

    # 3. Missing JD skill: Kafka
    kafka_seed = next((s for s in res.seeds if "kafka" in s.topic.lower()), None)
    assert kafka_seed is not None


def test_interview_seeds_without_jd_produces_weakness_seeds():
    """Verify calling seed generator with no JD still detects unsubstantiated skills & weak lines."""
    res = platform_bridges_service.generate_interview_seeds(
        resume=TEST_RESUME,
        job_description="",
        target_role="Backend Developer",
    )
    assert res.total_seeds > 0
    types = [s.seed_type for s in res.seeds]
    assert "unsubstantiated_skill" in types
    assert "missing_jd_skill" not in types  # No JD provided


def test_interview_seeds_fields_and_explanations():
    """Verify seed items contain structured id, topic, seed_prompt, and reason."""
    res = platform_bridges_service.generate_interview_seeds(resume=TEST_RESUME)
    for s in res.seeds:
        assert s.id.startswith("seed-")
        assert len(s.topic) > 0
        assert len(s.seed_prompt) > 20
        assert len(s.reason) > 5
        assert "?" in s.seed_prompt or "." in s.seed_prompt



@pytest.mark.asyncio
async def test_interview_session_incorporates_question_seeds():
    """Verify session manager uses question seeds in Question 1 formulation or fallback."""
    seed = "You listed Kubernetes with no project evidence: explain how you configured pods and ingress in production."
    req = StartInterviewRequest(
        target_role="Cloud Engineer",
        total_questions=3,
        initial_difficulty="medium",
        resume_text="Experienced with Python and FastAPI.",
        question_seeds=[seed],
    )

    session_resp = await session_manager.start_session(
        user_id=MOCK_USER["firebase_uid"],
        request=req,
    )

    assert session_resp.session_id is not None
    assert session_resp.current_question_index == 1
    # Check that session record holds question seeds
    session_data = await session_manager.get_session(session_resp.session_id, MOCK_USER["firebase_uid"])
    assert session_data is not None
    assert "question_seeds" in session_data
    assert len(session_data["question_seeds"]) == 1


@pytest.mark.asyncio
async def test_roadmap_generation_from_common_gaps():
    """Verify bridge service builds customized 4-milestone roadmap targeting multi-JD gaps."""
    user_id = MOCK_USER["firebase_uid"]
    gaps = ["Kubernetes", "Apache Kafka", "Redis", "Distributed Tracing"]

    req = GenerateRoadmapFromGapsRequest(
        target_role="Backend Systems Architect",
        common_gaps=gaps,
    )

    roadmap = await platform_bridges_service.generate_roadmap_from_common_gaps(
        user_id=user_id,
        request=req,
    )

    assert roadmap.target_role == "Backend Systems Architect"
    assert len(roadmap.milestones) == 4
    assert roadmap.identified_weak_areas == gaps

    # Check milestone 1 targets first gaps
    assert "Kubernetes" in roadmap.milestones[0].title or "Kafka" in roadmap.milestones[0].title
    # Check milestone 4 capstone includes gaps
    assert "Capstone" in roadmap.milestones[3].title


@pytest.mark.asyncio
async def test_platform_bridge_endpoints_authenticated():
    """Verify authenticated API calls to /interview-seeds and /roadmap/generate-from-gaps."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Interview seeds endpoint
            seed_payload = {
                "resume": TEST_RESUME.model_dump(),
                "job_description": SAMPLE_JD,
                "target_role": "Full Stack Engineer",
            }
            seed_res = await client.post("/api/v1/resume-studio/interview-seeds", json=seed_payload)
            assert seed_res.status_code == 200
            seed_data = seed_res.json()
            assert "seeds" in seed_data
            assert len(seed_data["seeds"]) > 0

            # 2. Roadmap generation endpoint
            road_payload = {
                "target_role": "DevOps Engineer",
                "common_gaps": ["Docker", "Kubernetes", "Terraform"],
            }
            road_res = await client.post("/api/v1/roadmap/generate-from-gaps", json=road_payload)
            assert road_res.status_code == 200
            road_data = road_res.json()
            assert road_data["target_role"] == "DevOps Engineer"
            assert len(road_data["milestones"]) == 4
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_platform_bridge_endpoints_unauthenticated_returns_401():
    """Verify endpoints strictly return 401 when unauthenticated."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.post(
            "/api/v1/resume-studio/interview-seeds",
            json={"resume": TEST_RESUME.model_dump()},
        )
        assert r1.status_code == 401

        r2 = await client.post(
            "/api/v1/roadmap/generate-from-gaps",
            json={"target_role": "DevOps", "common_gaps": ["Docker"]},
        )
        assert r2.status_code == 401
