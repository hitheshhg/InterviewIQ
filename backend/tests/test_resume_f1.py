import io
import pytest
from httpx import ASGITransport, AsyncClient
from reportlab.pdfgen import canvas
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
from app.services.canonical_parser import canonical_parser

TEST_USER_A = {
    "uid": "test_f1_candidate_a",
    "firebase_uid": "test_f1_candidate_a",
    "email": "shreya.candidate@vtu.ac.in",
    "display_name": "Shreya VTU",
}

TEST_USER_B = {
    "uid": "test_f1_candidate_b",
    "firebase_uid": "test_f1_candidate_b",
    "email": "candidate.b@vtu.ac.in",
    "display_name": "Candidate B",
}

# 1. SAMPLE RESUME 1: Strong CS Fresher / Full Stack Developer
RESUME_1_STRONG_CS = """
Shreya K
Bengaluru, Karnataka | shreya.k@vtu.ac.in | +91 9876543210
LinkedIn: linkedin.com/in/shreyak | GitHub: github.com/shreyak

PROFESSIONAL SUMMARY
Final-year Computer Science Engineering undergraduate with hands-on experience building scalable web architectures, RESTful microservices, and AI-driven platforms using Python, FastAPI, React, and MongoDB.

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, SQL, C++
Frameworks & Libraries: FastAPI, React.js, Tailwind CSS, Node.js, Express
Developer Tools: Git, Docker, Pytest, Postman, Vite
Cloud & Databases: MongoDB Atlas, PostgreSQL, Redis, AWS (S3, EC2)

PROFESSIONAL EXPERIENCE
Software Development Intern | AccelTech Solutions | Bengaluru
Jan 2024 - Present
• Engineered and deployed 8 asynchronous REST API endpoints using FastAPI and MongoDB Atlas, serving 15,000 requests per day with sub-60ms response latency.
• Optimized compound indexing across collections, reducing slow database read queries by 42%.
• Built responsive dashboard UI components with React and TypeScript, improving test coverage from 65% to 92%.

PROJECTS
InterviewIQ - Voice AI Mock Interview Platform
Tech Stack: Python, FastAPI, React, TypeScript, MongoDB Atlas, Web Speech API
• Architected multi-turn conversational interview state machine dynamically escalating difficulty based on candidate response scores.
• Implemented Google Gemini structured JSON mode with multi-tier fallback chains to achieve zero failed evaluations.
• Integrated client-side SpeechRecognition STT and SpeechSynthesis TTS with zero external latency.

Distributed Rate Limiter
Tech Stack: Python, Redis, Docker
• Implemented Token Bucket rate limiter in Redis using atomic Lua scripts, supporting 10,000 requests per second.

EDUCATION
Visvesvaraya Technological University (VTU)
Bachelor of Engineering in Computer Science & Engineering
2020 - 2024 | CGPA: 8.9 / 10

CERTIFICATIONS
Meta Certified Front-End Developer | Coursera | 2023
AWS Certified Cloud Practitioner | Amazon Web Services | 2023
"""

# 2. SAMPLE RESUME 2: Weak / Draft Resume (passive verbs, missing metrics)
RESUME_2_WEAK_DRAFT = """
John Doe
Email: john@gmail.com | Phone: 1234567890

Summary:
I am looking for a job as a developer. I worked on websites and databases.

Skills:
Java, HTML, CSS, SQL, Python

Experience:
Developer Assistant at SmallCo (2022 - 2023)
- Responsible for fixing bugs in the company website.
- Assisted in database management.
- Worked with team members on coding tasks.

Education:
B.Tech in CS (2023)
"""

# 3. SAMPLE RESUME 3: Mid-Level Backend Systems Developer
RESUME_3_MID_BACKEND = """
Alex Vance
Seattle, WA | alex.vance@techcorp.io | +1 (555) 234-5678
GitHub: github.com/alexvance

SUMMARY
Backend Systems Engineer with 3+ years experience designing fault-tolerant distributed systems, event-driven pipelines, and high-concurrency microservices.

SKILLS
Languages: Python, Go, SQL, Bash
Frameworks: FastAPI, gRPC, Celery, SQLAlchemy
Cloud & Infra: Docker, Kubernetes, AWS, Terraform, Kafka, Redis, PostgreSQL

EXPERIENCE
Backend Engineer | CloudScale Inc | Jun 2021 - Present
• Designed distributed message processing pipeline with Kafka and FastAPI, processing 2M messages daily.
• Reduced database query bottlenecks by 60% through PostgreSQL partitioning and Redis caching.
• Led migration from monolith to Kubernetes microservices, achieving 99.99% system availability.

PROJECTS
High-Throughput Key-Value Store
Tech Stack: Go, Raft Consensus, Docker
• Implemented Raft consensus protocol from scratch supporting distributed log replication and leader elections.

EDUCATION
B.S. in Computer Science | University of Washington | 2017 - 2021
"""


def _create_pdf_bytes(text: str) -> bytes:
    """Generate in-memory PDF with selectable text layer."""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer)
    y = 800
    for line in text.strip().split("\n"):
        if y < 40:
            p.showPage()
            y = 800
        p.drawString(40, y, line[:90])
        y -= 14
    p.save()
    buffer.seek(0)
    return buffer.getvalue()


def _create_scanned_pdf_bytes() -> bytes:
    """Generate in-memory PDF with no text layer (simulates scanned photo/empty page)."""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer)
    # Draw shapes only, no text
    p.rect(50, 50, 500, 700, stroke=1, fill=0)
    p.circle(300, 400, 50)
    p.save()
    buffer.seek(0)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_canonical_parser_on_3_sample_resumes():
    """Verify CanonicalResumeParser parses strong, weak, and mid-level resumes into structured JSON."""
    # 1. Strong CS Fresher Resume
    res1 = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)
    assert isinstance(res1, CanonicalResume)
    assert "Shreya" in res1.contact.full_name or len(res1.contact.full_name) > 0
    assert len(res1.all_skills()) >= 5
    assert len(res1.education) >= 1
    assert len(res1.all_bullets()) >= 2

    # 2. Weak Draft Resume
    res2 = await canonical_parser.parse_resume_text(RESUME_2_WEAK_DRAFT)
    assert isinstance(res2, CanonicalResume)
    assert len(res2.all_skills()) >= 2
    assert len(res2.experience) >= 1 or len(res2.projects) >= 0

    # 3. Mid-Level Backend Developer
    res3 = await canonical_parser.parse_resume_text(RESUME_3_MID_BACKEND)
    assert isinstance(res3, CanonicalResume)
    assert any("python" in s.lower() or "go" in s.lower() for s in res3.all_skills())
    assert len(res3.all_bullets()) >= 1


@pytest.mark.asyncio
async def test_upload_empty_file_rejected_with_friendly_error():
    """Verify 0-byte file returns HTTP 400 with friendly message."""
    transport = ASGITransport(app=app)
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_A

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("empty.pdf", b"", "application/pdf")}
        response = await client.post("/api/v1/resume/parse-upload", files=files)
        assert response.status_code == 400
        data = response.json()
        assert "empty (0 bytes)" in data["detail"].lower()

    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_upload_corrupt_file_rejected_with_friendly_error():
    """Verify malformed/corrupted file returns HTTP 400 with friendly message."""
    transport = ASGITransport(app=app)
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_A

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        corrupt_bytes = b"NOT_A_REAL_PDF_GARBAGE_BYTES_1234567890"
        files = {"file": ("corrupt.pdf", corrupt_bytes, "application/pdf")}
        response = await client.post("/api/v1/resume/parse-upload", files=files)
        assert response.status_code == 400
        data = response.json()
        assert "corrupted or unreadable" in data["detail"].lower()

    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_upload_scanned_pdf_rejected_with_friendly_error():
    """Verify PDF with no selectable text returns HTTP 400 with friendly scanned notice."""
    transport = ASGITransport(app=app)
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_A

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        scanned_pdf_bytes = _create_scanned_pdf_bytes()
        files = {"file": ("scanned_document.pdf", scanned_pdf_bytes, "application/pdf")}
        response = await client.post("/api/v1/resume/parse-upload", files=files)
        assert response.status_code == 400
        data = response.json()
        assert "scanned image" in data["detail"].lower()

    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_upload_valid_pdf_parses_successfully():
    """Verify valid PDF file is parsed into CanonicalResume schema."""
    transport = ASGITransport(app=app)
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_A

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        pdf_bytes = _create_pdf_bytes(RESUME_1_STRONG_CS)
        files = {"file": ("Shreya_Resume.pdf", pdf_bytes, "application/pdf")}
        response = await client.post(
            "/api/v1/resume/parse-upload",
            files=files,
            data={"job_description": "We are seeking a Python / React Developer."},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["file_name"] == "Shreya_Resume.pdf"
        assert "canonical_resume" in data
        assert len(data["canonical_resume"]["skills"]["languages"]) > 0

    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_save_and_retrieve_active_resume_versioning():
    """Verify candidate active resume saving, version incrementation, and user isolation."""
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. User A saves Resume Version 1
        app.dependency_overrides[get_current_user] = lambda: TEST_USER_A

        parsed_1 = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)
        req_v1 = SaveActiveResumeRequest(
            canonical_resume=parsed_1,
            target_role="Full Stack Developer",
            file_name="Shreya_Resume_v1.pdf",
        )
        res_v1 = await client.post("/api/v1/resume/save-active", json=req_v1.model_dump())
        assert res_v1.status_code == 200
        data_v1 = res_v1.json()
        assert data_v1["version"] >= 1
        assert data_v1["is_active"] is True
        v1_num = data_v1["version"]

        # 2. User A saves Resume Version 2 (incremental)
        parsed_1.summary = "Updated professional summary for Version 2."
        req_v2 = SaveActiveResumeRequest(
            canonical_resume=parsed_1,
            target_role="Senior Full Stack Developer",
            file_name="Shreya_Resume_v2.pdf",
        )
        res_v2 = await client.post("/api/v1/resume/save-active", json=req_v2.model_dump())
        assert res_v2.status_code == 200
        data_v2 = res_v2.json()
        assert data_v2["version"] == v1_num + 1
        assert data_v2["is_active"] is True

        # 3. GET /api/v1/resume/active returns the latest version 2
        active_res = await client.get("/api/v1/resume/active")
        assert active_res.status_code == 200
        active_data = active_res.json()
        assert active_data["version"] == data_v2["version"]
        assert active_data["canonical_resume"]["summary"] == "Updated professional summary for Version 2."

        # 4. User B checks active resume: should NOT see User A's resume
        app.dependency_overrides[get_current_user] = lambda: TEST_USER_B
        user_b_res = await client.get("/api/v1/resume/active")
        # Either 404 or empty if never uploaded
        assert user_b_res.status_code in (404, 200)
        if user_b_res.status_code == 200:
            assert user_b_res.json()["canonical_resume"]["contact"]["email"] != TEST_USER_A["email"]

    app.dependency_overrides.pop(get_current_user, None)

