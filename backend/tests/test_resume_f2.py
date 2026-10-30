import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.dependencies import get_current_user
from app.models.canonical_resume import (
    CanonicalResume,
    ContactInfo,
    CategorizedSkills,
    ExperienceItem,
    ProjectItem,
    EducationItem,
)
from app.services.canonical_scorer import canonical_scorer

TEST_USER = {
    "uid": "test_f2_user",
    "firebase_uid": "test_f2_user",
    "email": "shreya@vtu.ac.in",
    "display_name": "Shreya VTU",
}

STRONG_RESUME = CanonicalResume(
    contact=ContactInfo(
        full_name="Shreya VTU",
        email="shreya@vtu.ac.in",
        phone="+91 9876543210",
        location="Bengaluru, Karnataka",
        linkedin="linkedin.com/in/shreyavtu",
        github="github.com/shreyavtu",
    ),
    summary="Results-driven Software Engineer with 2 years of academic and internship experience architecting web applications, distributed APIs, and database indexing strategies.",
    skills=CategorizedSkills(
        languages=["Python", "TypeScript", "SQL", "C++"],
        frameworks=["FastAPI", "React", "Tailwind CSS"],
        developer_tools=["Git", "Docker", "Pytest", "Postman"],
        cloud_databases=["MongoDB", "Redis", "AWS"],
        other=["REST APIs", "Microservices", "System Design"],
    ),
    experience=[
        ExperienceItem(
            company="AccelTech Systems",
            role="Software Engineer Intern",
            location="Bengaluru, India",
            start_date="Jan 2024",
            end_date="Present",
            bullets=[
                "Engineered 12 asynchronous REST API endpoints using FastAPI and MongoDB Atlas, serving 25,000 requests per day with sub-50ms latency.",
                "Optimized database read latency by 45% through compound index implementation in MongoDB.",
                "Automated testing pipelines with Pytest, increasing test coverage from 60% to 94%.",
            ],
        )
    ],
    projects=[
        ProjectItem(
            name="InterviewIQ Platform",
            description="AI Interview preparation and ATS resume optimization platform.",
            tech_stack=["Python", "FastAPI", "React", "MongoDB Atlas"],
            bullets=[
                "Architected real-time WebSocket communication pipeline with Web Speech API audio processing.",
                "Reduced evaluation latency by 50% by combining rubric scoring and adaptive question generation in 1 Gemini call.",
            ],
        )
    ],
    education=[
        EducationItem(
            institution="Visvesvaraya Technological University",
            degree="Bachelor of Engineering",
            field_of_study="Computer Science & Engineering",
            graduation_year="2024",
            gpa_or_grade="8.9 / 10",
        )
    ],
)

WEAK_RESUME = CanonicalResume(
    contact=ContactInfo(
        full_name="John Doe",
        email="john@example.com",
    ),
    summary="Looking for a job.",
    skills=CategorizedSkills(
        languages=["HTML", "CSS"],
    ),
    experience=[
        ExperienceItem(
            company="Generic Corp",
            role="Assistant",
            start_date="2023",
            end_date="2023",
            bullets=[
                "Responsible for updating the web page.",
                "Assisted in database entry tasks.",
                "Worked on code debugging.",
            ],
        )
    ],
)

SAMPLE_JD = """
We are looking for a Full Stack Software Engineer proficient in Python, FastAPI, React, TypeScript, and Docker.
Experience with AWS cloud infrastructure, PostgreSQL databases, and Terraform is preferred.
Candidate will design scalable microservices and improve system latency.
"""


def test_scoring_weights_sum_to_100_with_jd():
    """Verify that when a Job Description is provided, weights sum exactly to 100% (40/15/15/15/15)."""
    result = canonical_scorer.evaluate(STRONG_RESUME, job_description=SAMPLE_JD)
    assert result.jd_provided is True
    assert result.redistribution_note is None

    # Verify weights
    factors = result.factors
    assert "keyword_match" in factors
    assert factors["keyword_match"].weight_pct == 40.0
    assert factors["section_completeness"].weight_pct == 15.0
    assert factors["quantified_achievements"].weight_pct == 15.0
    assert factors["action_verbs"].weight_pct == 15.0
    assert factors["formatting"].weight_pct == 15.0

    total_weight = sum(f.weight_pct for f in factors.values())
    assert abs(total_weight - 100.0) < 0.001
    assert 0 <= result.overall_score <= 100


def test_scoring_weights_redistribute_transparently_without_jd():
    """Verify that when NO JD is provided, 40% weight redistributes equally to 25/25/25/25 with transparent note."""
    result = canonical_scorer.evaluate(STRONG_RESUME, job_description="")
    assert result.jd_provided is False
    assert result.redistribution_note is not None
    assert "40% keyword weight redistributed equally" in result.redistribution_note

    factors = result.factors
    assert "keyword_match" not in factors
    assert factors["section_completeness"].weight_pct == 25.0
    assert factors["quantified_achievements"].weight_pct == 25.0
    assert factors["action_verbs"].weight_pct == 25.0
    assert factors["formatting"].weight_pct == 25.0

    total_weight = sum(f.weight_pct for f in factors.values())
    assert abs(total_weight - 100.0) < 0.001
    assert 0 <= result.overall_score <= 100


def test_semantic_skill_matching_and_evidence_citations():
    """Verify matched, partial, and missing skills with exact evidence line citations."""
    result = canonical_scorer.evaluate(STRONG_RESUME, job_description=SAMPLE_JD)

    analysis_by_name = {s.skill.lower(): s for s in result.skills_analysis}

    # 1. Matched skill: FastAPI
    assert "fastapi" in analysis_by_name
    fastapi_item = analysis_by_name["fastapi"]
    assert fastapi_item.status == "matched"
    assert fastapi_item.evidence_line is not None
    # Must cite line mentioning FastAPI
    assert "fastapi" in fastapi_item.evidence_line.lower()

    # 2. Matched skill: Docker
    assert "docker" in analysis_by_name
    docker_item = analysis_by_name["docker"]
    assert docker_item.status == "matched"
    assert docker_item.evidence_line is not None
    assert "docker" in docker_item.evidence_line.lower()

    # 3. Partial skill: PostgreSQL (Resume has MongoDB / SQL)
    assert "postgresql" in analysis_by_name or "postgres" in analysis_by_name
    pg_key = "postgresql" if "postgresql" in analysis_by_name else "postgres"
    pg_item = analysis_by_name[pg_key]
    assert pg_item.status in ("matched", "partial")
    if pg_item.status == "partial":
        assert pg_item.evidence_line is not None
        assert "mongodb" in pg_item.evidence_line.lower() or "sql" in pg_item.evidence_line.lower()

    # 4. Missing skill: Terraform
    assert "terraform" in analysis_by_name
    tf_item = analysis_by_name["terraform"]
    assert tf_item.status == "missing"
    assert tf_item.evidence_line is None

    # Check counts
    assert result.matched_skills_count >= 3
    assert result.missing_skills_count >= 1


def test_impact_ranked_fix_issues():
    """Verify issues are ordered by impact and categorize passive phrases and metrics."""
    result_weak = canonical_scorer.evaluate(WEAK_RESUME, job_description=SAMPLE_JD)

    issues = result_weak.issues_list
    assert len(issues) > 0

    # High impact issues should appear before low impact
    impact_levels = [issue.impact for issue in issues]
    if "high" in impact_levels and "low" in impact_levels:
        assert impact_levels.index("high") < impact_levels.index("low")

    # Passive verb check in weak resume: "responsible for", "assisted in", "worked on"
    action_verb_issues = [i for i in issues if i.category == "action_verb"]
    assert len(action_verb_issues) > 0
    assert any("responsible for" in i.title.lower() or "assisted" in i.title.lower() for i in action_verb_issues)

    # Missing metrics in weak resume
    metric_issues = [i for i in issues if i.category == "metric"]
    assert len(metric_issues) > 0


def test_strong_vs_weak_score_differentiation():
    """Verify strong resume achieves substantially higher ATS score than weak draft resume."""
    eval_strong = canonical_scorer.evaluate(STRONG_RESUME, job_description=SAMPLE_JD)
    eval_weak = canonical_scorer.evaluate(WEAK_RESUME, job_description=SAMPLE_JD)

    assert eval_strong.overall_score >= 80
    assert eval_weak.overall_score <= 50
    assert eval_strong.factors["quantified_achievements"].score > eval_weak.factors["quantified_achievements"].score
    assert eval_strong.factors["action_verbs"].score > eval_weak.factors["action_verbs"].score


@pytest.mark.asyncio
async def test_evaluate_endpoint_via_http():
    """Verify POST /api/v1/resume/evaluate returns structured ATSScoreBreakdown schema."""
    transport = ASGITransport(app=app)
    app.dependency_overrides[get_current_user] = lambda: TEST_USER

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/resume/evaluate",
            json={
                "canonical_resume": STRONG_RESUME.model_dump(),
                "job_description": SAMPLE_JD,
                "target_role": "Full Stack Developer",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "overall_score" in data
        assert data["overall_score"] >= 80
        assert "factors" in data
        assert "keyword_match" in data["factors"]
        assert "skills_analysis" in data
        assert len(data["skills_analysis"]) > 0
        assert len(data["issues_list"]) > 0

    app.dependency_overrides.pop(get_current_user, None)

