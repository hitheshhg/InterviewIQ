import pytest
from unittest.mock import patch
from io import BytesIO
from fastapi import UploadFile
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services.ats_engine import calculate_rule_based_ats, run_full_ats_analysis
from app.services.resume_extractor import extract_text_from_file
from app.database import connect_to_mongo, close_mongo_connection
from app.config import settings

SAMPLE_STRONG_RESUME = """
Hithesh HG
Full Stack Software Engineer
Email: hitheshhg@gmail.com | Phone: +91 9876543210 | GitHub: github.com/hitheshhg | LinkedIn: linkedin.com/in/hitheshhg

SUMMARY
Experienced Full Stack Developer with expertise in building high-throughput web applications using Python, FastAPI, React, TypeScript, and MongoDB.

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, SQL
Frameworks & Libraries: FastAPI, React.js, Tailwind CSS, Node.js
Databases & Cloud: MongoDB Atlas, Redis, PostgreSQL, Docker, AWS
Tools: Git, Pytest, WebSockets

WORK EXPERIENCE
Senior Full Stack Developer | Tech Innovations (2023 - Present)
• Architected and deployed microservices backend using FastAPI and MongoDB, handling over 10,000 requests per minute with 99.9% uptime.
• Reduced API endpoint response times by 45% through implementation of Redis caching and compound database indexing strategies.
• Engineered responsive frontend user interfaces with React and TypeScript, boosting user engagement metrics by 30%.
• Automated CI/CD deployment pipelines using Docker and GitHub Actions, cutting release turnaround time from 2 hours to 15 minutes.

PROJECTS
InterviewIQ - Voice AI Mock Interview Platform
• Built real-time WebSocket interview platform with Web Speech API audio processing and Google Gemini structured evaluation.
• Implemented deterministic ATS scoring engine analyzing keyword density, action verbs, and quantified metric achievements.

EDUCATION
Bachelor of Engineering in Computer Science & Engineering (2020 - 2024)
Visvesvaraya Technological University (VTU) | CGPA: 8.9/10
"""

SAMPLE_WEAK_RESUME = """
Jane Doe
Email: jane@test.com
I am looking for a software job. I know computers and basic programming.
I like coding and worked on a few university projects.
"""

SAMPLE_JD = """
We are seeking a Full Stack Software Engineer proficient in Python, FastAPI, React, TypeScript, MongoDB, Docker, and Redis.
The ideal candidate has hands-on experience designing scalable microservices, optimizing database latency, and implementing modern frontend state management.
"""


def test_rule_based_ats_strong_resume():
    """Verify strong resume achieves high ATS score, detects metrics, and matches keywords."""
    score, breakdown, matched, missing = calculate_rule_based_ats(SAMPLE_STRONG_RESUME, SAMPLE_JD)
    
    assert score >= 75, f"Expected high score, got {score}"
    assert breakdown.keyword_match_score >= 70
    assert breakdown.section_completeness_score == 100.0  # All 5 sections present
    assert breakdown.quantifiable_impact_score >= 80  # Has 45%, 10,000, 30%, etc.
    assert breakdown.action_verbs_score >= 80  # Has Architected, Engineered, Reduced, Automated
    assert "Fastapi" in matched or "Python" in matched
    print(f"\n[ATS Test] Strong Resume Score: {score}/100 | Matched: {len(matched)} | Missing: {len(missing)}")


def test_rule_based_ats_weak_resume():
    """Verify weak resume scores significantly lower and highlights missing keywords."""
    score, breakdown, matched, missing = calculate_rule_based_ats(SAMPLE_WEAK_RESUME, SAMPLE_JD)
    
    assert score < 50, f"Expected weak score, got {score}"
    assert len(missing) > len(matched)
    assert breakdown.section_completeness_score < 50
    assert breakdown.quantifiable_impact_score == 0
    print(f"[ATS Test] Weak Resume Score: {score}/100")


@pytest.mark.asyncio
async def test_extractor_rejects_unsupported_format():
    """Verify extractor rejects files with unsupported extensions (.txt)."""
    fake_file = UploadFile(
        filename="resume.txt",
        file=BytesIO(b"Hello world this is some random text file"),
    )
    with pytest.raises(Exception) as exc_info:
        await extract_text_from_file(fake_file)
    assert "Unsupported file format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_extractor_rejects_empty_file():
    """Verify extractor rejects empty 0-byte files."""
    fake_file = UploadFile(
        filename="empty.pdf",
        file=BytesIO(b""),
    )
    with pytest.raises(Exception) as exc_info:
        await extract_text_from_file(fake_file)
    assert "empty" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_analyze_text_endpoint():
    """Verify direct text analysis endpoint returns structured ATS results."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/resume/analyze-text",
            data={
                "resume_text": SAMPLE_STRONG_RESUME,
                "job_description": SAMPLE_JD,
                "target_role": "Full Stack Developer",
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["overall_score"] >= 70
        assert "breakdown" in data
        assert len(data["matched_keywords"]) > 0
        assert len(data["actionable_tips"]) > 0


@pytest.mark.asyncio
async def test_upload_endpoint_requires_auth():
    """Verify that uploading a resume requires Firebase token authentication."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/resume/upload")
        assert response.status_code == 401
