import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.dependencies import get_current_user
from app.models.canonical_resume import CanonicalResume
from app.models.canonical_rewrite import (
    SuggestBulletRewritesRequest,
    BulletRewriteOption,
)
from app.services.canonical_rewriter import canonical_rewriter, FILL_IN_REGEX
from app.services.canonical_scorer import canonical_scorer
from tests.test_resume_f1 import RESUME_2_WEAK_DRAFT, RESUME_1_STRONG_CS
from app.services.canonical_parser import canonical_parser

TEST_USER = {
    "firebase_uid": "user_shreya_f3_test",
    "email": "shreya.test@vtu.ac.in",
    "name": "Shreya CS",
}


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_weak_bullet_rewrite_generation_and_fill_in_prompts():
    """Verify that passive bullets are rewritten into strong action verbs with truthful fill-in slots."""
    weak_bullet = "Responsible for debugging issues in backend and maintaining databases."
    
    req = SuggestBulletRewritesRequest(
        bullet_text=weak_bullet,
        category="action_verb",
        context_role="Backend Developer Intern",
        target_role="Backend Systems Engineer",
    )
    
    res = await canonical_rewriter.suggest_rewrites(req)
    
    assert res.truth_check_passed is True
    assert len(res.suggestions) >= 1
    
    # Assert all suggestions replace passive clichés
    for opt in res.suggestions:
        lower_text = opt.text.lower()
        assert "responsible for" not in lower_text
        assert "worked on" not in lower_text
        # Original had no metrics -> must have fill-in prompts
        assert opt.needs_fill_in is True
        assert len(opt.fill_in_prompts) > 0
        assert "[" in opt.text and "]" in opt.text


@pytest.mark.asyncio
async def test_truth_rule_preserves_existing_metrics_without_inventing_fake_ones():
    """Verify that bullets with existing metrics do not invent new ungrounded numbers."""
    metric_bullet = "Reduced database query latency by 45% using Redis caching and index optimization."
    
    req = SuggestBulletRewritesRequest(
        bullet_text=metric_bullet,
        category="metric",
        context_role="Backend Engineer",
        target_role="Full Stack Developer",
    )
    
    res = await canonical_rewriter.suggest_rewrites(req)
    assert len(res.suggestions) >= 1
    
    for opt in res.suggestions:
        # 45% should be retained or highlighted
        assert opt.needs_fill_in is False or "45%" in opt.text


@pytest.mark.asyncio
async def test_adversarial_truth_rule_catches_and_sanitizes_hallucinations():
    """
    Adversarial test: An unaligned rewrite attempts to hallucinate fake percentages ($200k, 85%)
    when the original bullet had no metrics. The Truth Rule must intercept and sanitize them.
    """
    orig = "Assisted with manual testing and Jira bug tracking for customer login portal."
    adversarial_rewrite = "Spearheaded QA overhaul cutting bug escape rates by 85% and saving $200k annually."
    
    is_truthful, notes, sanitized = canonical_rewriter.verify_bullet_truthfulness(
        original_text=orig,
        rewritten_text=adversarial_rewrite,
    )
    
    assert is_truthful is True
    # Sanitizer must detect ungrounded numbers (85, 200) and replace them with truthful fill-in prompts
    assert "85%" not in sanitized
    assert "200k" not in sanitized
    assert "[Fill in:" in sanitized
    assert any("Truth check caught unverified numbers" in note for note in notes)


@pytest.mark.asyncio
async def test_missing_skill_confirmation_workflow():
    """
    Verify that missing skills are confirmed by the user before being added,
    and upon addition, the ATS score dynamically improves.
    """
    resume = await canonical_parser.parse_resume_text(RESUME_2_WEAK_DRAFT)
    target_jd = "Looking for a Software Engineer with expertise in Docker, Python, and MongoDB."
    
    # 1. Initial Evaluation
    initial_eval = canonical_scorer.evaluate(
        resume=resume,
        job_description=target_jd,
        target_role="Software Engineer",
    )
    initial_score = initial_eval.overall_score
    initial_matched = initial_eval.matched_skills_count
    
    # Verify Docker is identified as missing
    docker_item = next(
        (s for s in initial_eval.skills_analysis if s.skill.lower() == "docker"),
        None,
    )
    assert docker_item is not None
    assert docker_item.status in ("missing", "partial")
    
    # 2. Simulate User Confirms Skill: "Have you used Docker?" -> Candidate accepts: Yes
    resume.skills.developer_tools.append("Docker")
    
    # 3. Dynamic Re-evaluation
    updated_eval = canonical_scorer.evaluate(
        resume=resume,
        job_description=target_jd,
        target_role="Software Engineer",
    )
    
    assert updated_eval.matched_skills_count > initial_matched
    assert updated_eval.overall_score >= initial_score
    updated_docker = next(
        s for s in updated_eval.skills_analysis if s.skill.lower() == "docker"
    )
    assert updated_docker.status == "matched"
    assert updated_docker.evidence_line is not None


@pytest.mark.asyncio
async def test_live_score_recalculation_upon_accepting_metric_rewrite():
    """
    Verify that accepting an AI rewrite with quantified numbers immediately
    boosts the Quantified Achievements factor and overall ATS score.
    """
    resume = await canonical_parser.parse_resume_text(RESUME_2_WEAK_DRAFT)
    
    initial_eval = canonical_scorer.evaluate(
        resume=resume,
        job_description="",
        target_role="Junior Developer",
    )
    initial_overall = initial_eval.overall_score
    initial_metric_score = initial_eval.factors["quantified_achievements"].score
    
    # Candidate accepts rewrites with quantified impact into experience bullets
    assert len(resume.experience) > 0
    resume.experience[0].bullets = [
        "Architected REST endpoints processing 15,000 requests per minute with 99.9% uptime.",
        "Optimized database indices reducing query execution time by 42%.",
    ]
    
    updated_eval = canonical_scorer.evaluate(
        resume=resume,
        job_description="",
        target_role="Junior Developer",
    )
    
    updated_metric_score = updated_eval.factors["quantified_achievements"].score
    updated_overall = updated_eval.overall_score
    
    # Metric score must rise significantly
    assert updated_metric_score > initial_metric_score
    assert updated_overall > initial_overall


@pytest.mark.asyncio
async def test_suggest_rewrites_api_endpoint():
    """Verify HTTP POST /api/v1/resume/suggest-rewrites endpoint returns valid structure."""
    transport = ASGITransport(app=app)
    
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "bullet_text": "Worked on frontend design using React components.",
            "category": "action_verb",
            "context_role": "Frontend Intern",
            "target_role": "Frontend Developer",
        }
        
        res = await client.post("/api/v1/resume/suggest-rewrites", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["truth_check_passed"] is True
        assert len(data["suggestions"]) >= 1
        assert "rew_1" in data["suggestions"][0]["rewrite_id"]
        assert data["suggestions"][0]["needs_fill_in"] is True
