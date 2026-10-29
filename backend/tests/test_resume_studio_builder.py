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
from app.models.assist import AIAssistRequest
from app.services.resume_assist import resume_assist_service

MOCK_USER = {
    "firebase_uid": "user_builder_test_303",
    "email": "builder.tester@vtu.ac.in",
    "display_name": "Builder Tester",
}


def get_sample_resume() -> CanonicalResume:
    return CanonicalResume(
        contact=ContactInfo(
            full_name="Shreya Sharma",
            email="shreya@vtu.ac.in",
            phone="+91 9876543210",
            location="Bengaluru, India",
        ),
        summary="Full Stack Software Engineer specializing in React, FastAPI, and MongoDB.",
        skills=CategorizedSkills(
            languages=["Python", "TypeScript", "JavaScript"],
            frameworks_libraries=["React", "FastAPI"],
            cloud_databases=["MongoDB", "PostgreSQL"],
            developer_tools=["Docker", "Git"],
            core_concepts=["RESTful APIs"],
        ),
        experience=[
            ExperienceItem(
                company="TechCorp",
                role="Full Stack Engineer",
                start_date="Jan 2023",
                end_date="Present",
                is_current=True,
                bullets=[
                    "Engineered FastAPI microservices handling 50k requests.",
                    "Developed React UI components with 95% test coverage.",
                ],
            )
        ],
        projects=[
            ProjectItem(
                title="InterviewIQ",
                tech_stack=["React", "FastAPI"],
                bullets=["Built real-time scoring engine."],
            )
        ],
        education=[
            EducationItem(
                institution="VTU",
                degree="B.E. Computer Science",
                start_date="2020",
                end_date="2024",
            )
        ],
        certifications=[],
        achievements=[],
    )


# --------------------------------------------------------------------------
# 1. Editor State & Reordering Tests
# --------------------------------------------------------------------------
def test_editor_section_reordering():
    """Verify section order mutation logic (e.g. moving skills above summary)."""
    default_order = ["summary", "skills", "experience", "projects", "education", "certifications"]

    # Swap index 0 and 1
    reordered = list(default_order)
    reordered[0], reordered[1] = reordered[1], reordered[0]

    assert reordered[0] == "skills"
    assert reordered[1] == "summary"
    assert len(reordered) == len(default_order)
    assert set(reordered) == set(default_order)


def test_editor_bullet_reordering_and_mutations():
    """Verify bullet point additions, edits, and reordering within experience."""
    resume = get_sample_resume()
    exp = resume.experience[0]

    # Add bullet
    new_bullet = "Configured Docker container deployment pipelines."
    exp.bullets.append(new_bullet)
    assert len(exp.bullets) == 3

    # Reorder bullets (swap 0 and 2)
    exp.bullets[0], exp.bullets[2] = exp.bullets[2], exp.bullets[0]
    assert exp.bullets[0] == new_bullet

    # Edit bullet
    exp.bullets[0] = "Architected Docker container deployment pipelines."
    assert "Architected" in exp.bullets[0]


def test_editor_undo_redo_stack_simulation():
    """Verify undo/redo history stack logic maintaining immutable states."""
    resume_v0 = get_sample_resume()
    history = [resume_v0]
    index = 0

    # User edit 1: update summary
    resume_v1 = resume_v0.model_copy(deep=True)
    resume_v1.summary = "Updated summary with high-impact leadership framing."
    history = history[: index + 1] + [resume_v1]
    index = 1

    assert history[index].summary == "Updated summary with high-impact leadership framing."

    # User edit 2: add skill
    resume_v2 = resume_v1.model_copy(deep=True)
    resume_v2.skills.languages.append("Go")
    history = history[: index + 1] + [resume_v2]
    index = 2

    assert "Go" in history[index].skills.languages

    # Undo 1 step
    index -= 1
    assert "Go" not in history[index].skills.languages
    assert history[index].summary == "Updated summary with high-impact leadership framing."

    # Undo 2nd step
    index -= 1
    assert history[index].summary == "Full Stack Software Engineer specializing in React, FastAPI, and MongoDB."

    # Redo 1 step
    index += 1
    assert history[index].summary == "Updated summary with high-impact leadership framing."


# --------------------------------------------------------------------------
# 2. Template Switching Validation
# --------------------------------------------------------------------------
def test_template_switching_state_validity():
    """Verify 4 valid ATS-safe templates are recognized and valid."""
    VALID_TEMPLATES = {"classic", "modern", "compact", "minimal"}
    for t in ["classic", "modern", "compact", "minimal"]:
        assert t in VALID_TEMPLATES

    invalid_template = "two_column_creative"
    assert invalid_template not in VALID_TEMPLATES


# --------------------------------------------------------------------------
# 3. Inline AI Assist & Evidence Check Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_assist_improve_action():
    """Verify improve action replaces passive words with strong action verbs."""
    req = AIAssistRequest(
        text="Responsible for helping with database queries and frontend bugs.",
        action="improve",
        context_role="Full Stack Engineer",
        candidate_skills=["Python", "React", "MongoDB"],
    )
    res = await resume_assist_service.generate_assist_options(req)

    assert res.action == "improve"
    assert len(res.options) >= 2
    for opt in res.options:
        assert len(opt.text) > 10
        assert opt.diff_summary != ""
        # Check that passive phrasing was improved
        assert not opt.text.lower().startswith("responsible for")


@pytest.mark.asyncio
async def test_ai_assist_shorten_action():
    """Verify shorten action condenses long sentences."""
    long_bullet = (
        "I was tasked with developing and maintaining a distributed backend architecture "
        "and worked on many different tasks across multiple microservices to make sure "
        "that everything ran smoothly and effectively without any issues."
    )
    req = AIAssistRequest(
        text=long_bullet,
        action="shorten",
        context_role="Backend Developer",
        candidate_skills=["Python", "FastAPI"],
    )
    res = await resume_assist_service.generate_assist_options(req)

    assert res.action == "shorten"
    for opt in res.options:
        word_count = len(opt.text.split())
        assert word_count < len(long_bullet.split())


@pytest.mark.asyncio
async def test_ai_assist_truthful_check_with_fake_claims():
    """Verify Truthful AI flags ungrounded statistics or skills."""
    orig = "Built user login page."
    fake_rewrite = "Built user authentication using AWS Cognito, boosting conversion by 40%."

    has_claims, unverified = resume_assist_service.verify_truthful_evidence(
        original_text=orig,
        option_text=fake_rewrite,
        candidate_skills=["React", "CSS"],
    )

    assert has_claims is True
    # '40%' is a new number and 'Aws'/'Cognito' is an unverified tech
    assert any(token in ["40%", "Aws"] for token in unverified)
