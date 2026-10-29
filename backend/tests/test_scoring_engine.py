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
    CertificationItem,
)
from app.services.scoring_engine import (
    scoring_engine,
    SYNONYM_MAP,
    RELATED_SKILLS,
    ATSScoringEngine,
)

MOCK_USER = {
    "firebase_uid": "user_scoring_test_101",
    "email": "scoring.test@vtu.ac.in",
    "display_name": "Scoring Tester",
}

# --------------------------------------------------------------------------
# Fixtures & Sample Resumes
# --------------------------------------------------------------------------
def get_strong_resume() -> CanonicalResume:
    return CanonicalResume(
        contact=ContactInfo(
            full_name="Arjun Rao",
            email="arjun.rao@vtu.ac.in",
            phone="+91 9123456789",
            location="Bengaluru, Karnataka, India",
            linkedin_url="https://linkedin.com/in/arjunrao",
            github_url="https://github.com/arjunrao",
        ),
        summary="High-impact Full Stack Software Engineer with 3+ years experience building microservices and responsive web applications using React, TypeScript, FastAPI, and PostgreSQL.",
        skills=CategorizedSkills(
            languages=["Python", "TypeScript", "JavaScript", "SQL"],
            frameworks_libraries=["React", "FastAPI", "Node.js", "Tailwind CSS"],
            cloud_databases=["PostgreSQL", "MongoDB", "Redis", "AWS"],
            developer_tools=["Docker", "Git", "Kubernetes", "Linux"],
            core_concepts=["RESTful APIs", "Microservices", "Data Structures"],
        ),
        experience=[
            ExperienceItem(
                company="CloudScale Tech",
                role="Senior Full Stack Engineer",
                location="Bengaluru, India",
                start_date="Jan 2023",
                end_date="Present",
                is_current=True,
                bullets=[
                    "Architected high-throughput asynchronous REST APIs in FastAPI reducing p99 response latency by 45% across 200,000 daily requests.",
                    "Engineered modern responsive user interfaces in React and TypeScript boosting user retention by 28% across 15,000 active sessions.",
                    "Configured automated CI/CD pipelines with Docker and Kubernetes reducing cloud deployment cycle times by 60%.",
                ],
            )
        ],
        projects=[
            ProjectItem(
                title="InterviewIQ Platform",
                description="Real-time AI voice interview simulator with deterministic ATS scoring and rubric evaluations.",
                tech_stack=["React", "TypeScript", "FastAPI", "MongoDB"],
                bullets=[
                    "Spearheaded multi-threaded WebSocket session manager handling 50 concurrent simulated technical interviews with zero packet drop.",
                    "Integrated Gemini structured output parser delivering comprehensive rubric scores within 1.8 seconds.",
                ],
            )
        ],
        education=[
            EducationItem(
                institution="Visvesvaraya Technological University",
                degree="B.E.",
                field_of_study="Computer Science and Engineering",
                start_year="2019",
                end_year="2023",
                grade="8.9 CGPA",
            )
        ],
        certifications=[
            CertificationItem(
                name="AWS Certified Solutions Architect",
                issuer="Amazon Web Services",
                issue_date="2023",
            )
        ],
    )


def get_weak_resume() -> CanonicalResume:
    return CanonicalResume(
        contact=ContactInfo(
            full_name="Newbie Dev",
            email="newbie@example.com",
            phone="",
            location="",
        ),
        summary="Looking for a job.",
        skills=CategorizedSkills(
            languages=["Python"],
            frameworks_libraries=[],
            cloud_databases=[],
            developer_tools=[],
            core_concepts=[],
        ),
        experience=[
            ExperienceItem(
                company="Old Corp",
                role="Intern",
                location="Remote",
                start_date="unspecified",
                end_date="unspecified",
                is_current=False,
                bullets=[
                    "Responsible for helping with website updates and bug fixing when needed.",
                    "Worked on tasks assigned by senior members of the engineering team.",
                    "Did coding.",
                    "This is an extremely long bullet point written to describe a task that rambles on without any structure and contains over thirty eight words in total which causes automated applicant tracking systems to penalize candidate readability significantly across multiple parsing dimensions.",
                ],
            )
        ],
        projects=[],
        education=[],
        certifications=[],
    )


# --------------------------------------------------------------------------
# 1. Deterministic Weight Redistribution Tests
# --------------------------------------------------------------------------
def test_ats_weight_distribution_with_jd():
    engine = ATSScoringEngine()
    resume = get_strong_resume()
    jd = "Seeking a Full Stack Engineer proficient in React, FastAPI, Python, Docker, and PostgreSQL."

    score_res = engine.calculate_full_ats_score(resume=resume, job_description=jd)

    assert score_res.is_tailored is True
    # 5 factors must sum to 100% total weight
    bd = score_res.breakdown
    assert bd.keyword_semantic_match.weight_percentage == 40.0
    assert bd.section_completeness.weight_percentage == 15.0
    assert bd.quantified_achievements.weight_percentage == 15.0
    assert bd.action_verbs_quality.weight_percentage == 15.0
    assert bd.formatting_parseability.weight_percentage == 15.0

    total_weight = (
        bd.keyword_semantic_match.weight_percentage
        + bd.section_completeness.weight_percentage
        + bd.quantified_achievements.weight_percentage
        + bd.action_verbs_quality.weight_percentage
        + bd.formatting_parseability.weight_percentage
    )
    assert total_weight == 100.0
    assert 0 <= score_res.overall_score <= 100
    assert score_res.summary_verdict in ["Interview Ready", "Competitive", "Needs Optimization"]


def test_ats_weight_redistribution_without_jd():
    engine = ATSScoringEngine()
    resume = get_strong_resume()

    # Empty or None JD should trigger weight redistribution
    score_res = engine.calculate_full_ats_score(resume=resume, job_description="")

    assert score_res.is_tailored is False
    bd = score_res.breakdown
    assert bd.keyword_semantic_match.weight_percentage == 0.0
    assert bd.section_completeness.weight_percentage == 25.0
    assert bd.quantified_achievements.weight_percentage == 25.0
    assert bd.action_verbs_quality.weight_percentage == 25.0
    assert bd.formatting_parseability.weight_percentage == 25.0

    total_weight = (
        bd.section_completeness.weight_percentage
        + bd.quantified_achievements.weight_percentage
        + bd.action_verbs_quality.weight_percentage
        + bd.formatting_parseability.weight_percentage
    )
    assert total_weight == 100.0
    assert score_res.overall_score >= 80  # Strong resume should score high


# --------------------------------------------------------------------------
# 2. Synonym Normalization & Skill Matching Tests
# --------------------------------------------------------------------------
def test_skill_normalization_and_synonyms():
    engine = ATSScoringEngine()
    assert engine.normalize_skill("ReactJS") == "react"
    assert engine.normalize_skill("react.js") == "react"
    assert engine.normalize_skill("NodeJS") == "node.js"
    assert engine.normalize_skill("k8s") == "kubernetes"
    assert engine.normalize_skill("postgres") == "postgresql"
    assert engine.normalize_skill("Mongo") == "mongodb"
    assert engine.normalize_skill("GCP") == "google cloud"


def test_skill_classification_matched_partial_missing():
    engine = ATSScoringEngine()
    resume = get_strong_resume()

    # Candidate has: React, TypeScript, FastAPI, PostgreSQL, MongoDB, Docker, Kubernetes, etc.
    # We ask for:
    # - "ReactJS" (should match candidate's "React")
    # - "Django" (candidate has FastAPI -> partial match via RELATED_SKILLS)
    # - "GraphQL" (missing from candidate's profile)
    jd_text = "Required skills: ReactJS, Django, and GraphQL architecture."

    score_res = engine.calculate_full_ats_score(resume=resume, job_description=jd_text)

    matched_names = [m.skill.lower() for m in score_res.matched_skills]
    partial_names = [p.skill.lower() for p in score_res.partial_skills]
    missing_names = [m.skill.lower() for m in score_res.missing_skills]

    # ReactJS normalized to react, which candidate has
    assert any("react" in m for m in matched_names)

    # Candidate has FastAPI and Python, so Django requirement yields partial match
    assert any("django" in p for p in partial_names)
    # Check that partial evidence mentions candidate capability
    django_item = next(p for p in score_res.partial_skills if "django" in p.skill.lower())
    evidence_lower = django_item.resume_evidence_line.lower()
    assert "fastapi" in evidence_lower or "python" in evidence_lower

    # GraphQL is missing
    assert any("graphql" in m for m in missing_names)
    graphql_item = next(m for m in score_res.missing_skills if "graphql" in m.skill.lower())
    assert "No direct or related evidence found" in graphql_item.resume_evidence_line


# --------------------------------------------------------------------------
# 3. Linguistic Quality & Weak-Line Diagnostics Tests
# --------------------------------------------------------------------------
def test_weak_line_detection():
    engine = ATSScoringEngine()
    weak_resume = get_weak_resume()

    score_res = engine.calculate_full_ats_score(resume=weak_resume)

    issue_types = [w.issue_type for w in score_res.weak_lines]
    # Check for passive phrases like "Responsible for" or "helped with"
    assert "passive_phrase" in issue_types
    # Check for missing metrics
    assert "missing_metric" in issue_types
    # Check for too short or too long bullets
    assert ("too_short" in issue_types) or ("too_long" in issue_types)

    # Ensure weak resume gets "Needs Optimization" or "Competitive" verdict
    assert score_res.summary_verdict in ["Needs Optimization", "Competitive"]
    assert len(score_res.top_action_items) > 0


def test_strong_resume_high_score_and_action_items():
    engine = ATSScoringEngine()
    strong_resume = get_strong_resume()

    score_res = engine.calculate_full_ats_score(resume=strong_resume)

    assert score_res.overall_score >= 80
    assert score_res.summary_verdict == "Interview Ready"
    assert len(score_res.top_action_items) <= 3


# --------------------------------------------------------------------------
# 4. API Security & Endpoint Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_score_endpoint_unauthenticated_returns_401():
    """Verify endpoint rejects unauthenticated access with 401."""
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/resume-studio/score",
            json={
                "resume": get_strong_resume().model_dump(),
                "job_description": "React Developer",
            },
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_score_endpoint_authenticated_returns_valid_evaluation():
    """Verify endpoint returns complete 5-factor evaluation for authenticated user."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            payload = {
                "resume": get_strong_resume().model_dump(),
                "job_description": "We are seeking a Full Stack Developer with React, Python, and AWS expertise.",
                "target_role": "Full Stack Engineer",
            }
            response = await ac.post("/api/v1/resume-studio/score", json=payload)
            assert response.status_code == 200
            data = response.json()

            assert "overall_score" in data
            assert "breakdown" in data
            assert data["is_tailored"] is True
            assert "matched_skills" in data
            assert "partial_skills" in data
            assert "missing_skills" in data
            assert "weak_lines" in data
            assert "top_action_items" in data
            assert len(data["top_action_items"]) <= 3
    finally:
        app.dependency_overrides.clear()
