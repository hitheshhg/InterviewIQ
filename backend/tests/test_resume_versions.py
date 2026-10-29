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
    CreateVersionRequest,
)

from app.services.resume_parser import resume_studio_parser
from app.services.version_manager import version_manager_service
from app.services.multi_jd_comparator import multi_jd_comparator
from app.models.version_compare import CompareVersionsRequest
from app.models.multi_jd import MultiJDCompareRequest, JobDescriptionInput

MOCK_USER = {
    "uid": "shreya_vtu_version_user",
    "firebase_uid": "shreya_vtu_version_user",
    "email": "shreya.version@vtu.ac.in",
    "name": "Shreya VTU Versioner",
}

BASE_RESUME = CanonicalResume(
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
        developer_tools=["Git", "Docker"],
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
                "Developed RESTful endpoints with FastAPI reducing response times by 30%.",
                "Managed PostgreSQL migrations using Alembic with zero downtime.",
            ],
        )
    ],
    projects=[
        ProjectItem(
            id="proj-1",
            title="InterviewIQ Platform",
            tech_stack=["Python", "FastAPI", "Docker"],
            description="Interview preparation and ATS evaluation system.",
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

TAILORED_RESUME = CanonicalResume(
    contact=ContactInfo(
        full_name="Shreya Sharma",
        email="shreya@vtu.ac.in",
        phone="+91 9876543210",
        location="Bengaluru, India",
    ),
    summary="Full Stack Software Engineer specialized in high-performance cloud architectures, React, TypeScript, and FastAPI microservices.",
    skills=CategorizedSkills(
        languages=["TypeScript", "Python", "SQL", "JavaScript"],
        frameworks_libraries=["React", "FastAPI", "Tailwind CSS"],
        cloud_databases=["AWS", "PostgreSQL", "Redis", "MongoDB"],
        developer_tools=["Docker", "Kubernetes", "Git"],
        core_concepts=["Distributed Systems", "RESTful APIs", "Microservices"],
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
                "Developed RESTful endpoints with FastAPI and React, handling 50k daily active requests.",
                "Engineered Redis caching layer improving query response times by 45%.",
                "Managed PostgreSQL migrations using Alembic with zero downtime.",
            ],
        )
    ],
    projects=[
        ProjectItem(
            id="proj-1",
            title="InterviewIQ Platform",
            tech_stack=["Python", "FastAPI", "Docker", "React", "AWS"],
            description="Interview preparation and ATS evaluation system.",
            bullets=[
                "Engineered deterministic resume scoring engine.",
                "Integrated AWS S3 and automated CI/CD pipeline.",
            ],
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


@pytest.mark.asyncio
async def test_update_version_label_and_restore():
    """Verify updating a version's label and cloning it via restore endpoint."""
    user_id = MOCK_USER["firebase_uid"]

    # 1. Create a version
    created = await resume_studio_parser.create_resume_version(
        user_id=user_id,
        request=CreateVersionRequest(
            label="Initial Draft",
            target_role="Backend Developer",
            data=BASE_RESUME,
            ats_score=68.0,
        ),
    )
    assert created.id is not None
    version_id = created.id


    # 2. Update label
    updated = await version_manager_service.update_version_label(
        user_id=user_id,
        version_id=version_id,
        new_label="Base Master Resume",
    )
    assert updated is not None
    assert updated.label == "Base Master Resume"

    # 3. Restore version (duplicates as new version)
    restored = await version_manager_service.restore_version(
        user_id=user_id,
        version_id=version_id,
    )
    assert restored is not None
    assert restored.id != version_id
    assert restored.parent_version_id == version_id
    assert "Restored:" in restored.label
    assert restored.data.contact.full_name == "Shreya Sharma"


@pytest.mark.asyncio
async def test_compare_versions_service():
    """Verify side-by-side comparison identifies added skills, word delta, and score changes."""
    user_id = MOCK_USER["firebase_uid"]

    # Save v1 and v2
    v1 = await resume_studio_parser.create_resume_version(
        user_id=user_id,
        request=CreateVersionRequest(
            label="Base V1",
            target_role="Backend Developer",
            data=BASE_RESUME,
            ats_score=65.0,
        ),
    )
    v2 = await resume_studio_parser.create_resume_version(
        user_id=user_id,
        request=CreateVersionRequest(
            label="Tailored V2",
            target_role="Full Stack Engineer",
            data=TAILORED_RESUME,
            ats_score=85.0,
        ),
    )


    req = CompareVersionsRequest(version_id_1=v1.id, version_id_2=v2.id)
    diff = await version_manager_service.compare_versions(user_id=user_id, request=req)

    assert diff.score_delta == 20.0
    assert diff.version_1.label == "Base V1"
    assert diff.version_2.label == "Tailored V2"
    assert diff.summary_diff["changed"] is True

    # Check skills diff: React, TypeScript, AWS, Redis should be added
    added = [s.lower() for s in diff.skills_diff["added"]]
    assert "react" in added
    assert "typescript" in added
    assert "aws" in added
    assert "python" in [s.lower() for s in diff.skills_diff["common"]]

    # Check experience diff
    exp_items = diff.experience_diff["items"]
    assert len(exp_items) >= 1
    assert exp_items[0]["status"] == "modified"
    assert len(exp_items[0]["bullets_added"]) > 0

    assert "outperforms" in diff.verdict.lower() or "higher" in diff.verdict.lower()


@pytest.mark.asyncio
async def test_compare_versions_api_endpoint():
    """Verify POST /api/v1/resume-studio/compare-versions returns 200 with structured diff."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/resume-studio/compare-versions",
                json={
                    "resume_1": BASE_RESUME.model_dump(),
                    "resume_2": TAILORED_RESUME.model_dump(),
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "score_delta" in data
            assert "skills_diff" in data
            assert "verdict" in data
            assert data["skills_diff"]["total_v2"] > data["skills_diff"]["total_v1"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_multi_jd_history_and_dashboard_integration():
    """Verify comparisons are saved to history and reflected on candidate dashboard."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    user_id = MOCK_USER["firebase_uid"]
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Run a Multi-JD comparison
            compare_req = {
                "resume": TAILORED_RESUME.model_dump(),
                "target_role": "Full Stack Engineer",
                "job_descriptions": [
                    {
                        "id": "jd-test-1",
                        "title": "Full Stack Engineer",
                        "company": "Amazon",
                        "text": "Requires strong Python, FastAPI, React, TypeScript, Docker, and AWS microservices.",
                    },
                    {
                        "id": "jd-test-2",
                        "title": "Backend Specialist",
                        "company": "Google",
                        "text": "Requires Python, Go, Kubernetes, Distributed Systems, and Microservices.",
                    },
                ],
            }
            comp_res = await client.post("/api/v1/resume-studio/compare-jds", json=compare_req)
            assert comp_res.status_code == 200
            comp_data = comp_res.json()
            assert len(comp_data["rankings"]) == 2

            # 2. Check comparisons endpoint
            history_res = await client.get("/api/v1/resume-studio/comparisons")
            assert history_res.status_code == 200
            history_list = history_res.json()
            assert len(history_list) >= 1
            assert history_list[0]["role_count"] == 2
            assert history_list[0]["top_match_percentage"] > 0

            # 3. Check dashboard metrics integration
            dash_res = await client.get("/api/v1/dashboard/metrics")
            assert dash_res.status_code == 200
            dash_data = dash_res.json()
            assert "resume_versions_trend" in dash_data
            assert "recent_comparisons" in dash_data
            assert len(dash_data["recent_comparisons"]) >= 1
            assert dash_data["latest_ats_score"] is not None
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_versions_endpoints_unauthenticated_returns_401():
    """Verify all version endpoints strictly return 401 when called without credentials."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Patch label without auth
        r1 = await client.patch(
            "/api/v1/resume-studio/version/ver-fake/label",
            json={"label": "New Name"},
        )
        assert r1.status_code == 401

        # Restore without auth
        r2 = await client.post("/api/v1/resume-studio/version/ver-fake/restore")
        assert r2.status_code == 401

        # Compare versions without auth
        r3 = await client.post(
            "/api/v1/resume-studio/compare-versions",
            json={"version_id_1": "v1", "version_id_2": "v2"},
        )
        assert r3.status_code == 401

        # Comparisons history without auth
        r4 = await client.get("/api/v1/resume-studio/comparisons")
        assert r4.status_code == 401


@pytest.mark.asyncio
async def test_delete_version_endpoint():
    """Verify version deletion and subsequent 404 response."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    user_id = MOCK_USER["firebase_uid"]
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await resume_studio_parser.create_resume_version(
                user_id=user_id,
                request=CreateVersionRequest(
                    label="To be deleted",
                    target_role="Temp Role",
                    data=BASE_RESUME,
                    ats_score=50.0,
                ),
            )
            v_id = created.id

            # Delete
            del_res = await client.delete(f"/api/v1/resume-studio/version/{v_id}")
            assert del_res.status_code == 200
            assert "deleted" in del_res.json()["message"]

            # Subsequent fetch returns 404
            get_res = await client.get(f"/api/v1/resume-studio/version/{v_id}")
            assert get_res.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_compare_versions_adversarial_invalid_id():
    """Verify comparing non-existent version ID returns 400 Bad Request."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/v1/resume-studio/compare-versions",
                json={"version_id_1": "non-existent-id-12345", "version_id_2": "non-existent-id-67890"},
            )
            assert res.status_code == 400
            assert "not found" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)

