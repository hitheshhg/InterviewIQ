import io
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

MOCK_USER = {
    "firebase_uid": "user_resume_studio_test_101",
    "email": "shreya.studio@vtu.ac.in",
    "display_name": "Shreya VTU",
}

OTHER_USER = {
    "firebase_uid": "user_resume_studio_test_202",
    "email": "intruder@vtu.ac.in",
    "display_name": "Intruder User",
}

# --------------------------------------------------------------------------
# 3 Standardized Technical Dummy Resumes
# --------------------------------------------------------------------------
RESUME_FULLSTACK = """
Shreya Sharma
Bangalore, India | shreya.sharma@gmail.com | +91 9876543210 | linkedin.com/in/shreyasharma | github.com/shreyasharma

PROFESSIONAL SUMMARY
Full Stack Software Engineer with 2+ years of experience developing responsive user interfaces and distributed backends using React, TypeScript, FastAPI, and MongoDB.

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, SQL
Frameworks & Libraries: React, FastAPI, Node.js, Tailwind CSS
Databases & Cloud: MongoDB Atlas, PostgreSQL, Redis, AWS S3
Developer Tools: Git, Docker, Vite, Pytest, Linux
Core Concepts: REST APIs, Microservices, Async Event Loop

EXPERIENCE
Full Stack Developer | CloudScale Solutions (June 2023 - Present)
- Engineered scalable microservices in FastAPI reducing latency by 35% across 50,000 daily active requests.
- Developed dynamic responsive frontend components in React and TypeScript with 98% test coverage.
- Configured MongoDB Atlas indexing and Redis cache layer, lowering p99 database query time to 42ms.

PROJECTS
InterviewIQ - Voice AI Preparation Platform
Technologies: React, TypeScript, FastAPI, Web Speech API, Gemini Flash
- Built multi-turn adaptive interview state machine with structured JSON rubric evaluation.
- Implemented real-time audio visualization and Web Speech API continuous transcription with 0ms server latency.

EDUCATION
Visvesvaraya Technological University (VTU)
Bachelor of Engineering in Computer Science and Engineering (2020 - 2024) | CGPA: 8.9/10

ACHIEVEMENTS
- First place in VTU Inter-Collegiate Web Hackathon 2023 out of 64 participating teams.
"""

RESUME_BACKEND = """
Arjun Patel
Pune, India | arjun.patel@dev.io | +91 9123456780 | github.com/arjunpatel

PROFESSIONAL SUMMARY
Backend Systems Engineer specializing in Python, Go, high-throughput message queues, and distributed databases.

TECHNICAL SKILLS
Languages: Python, Go, C++, SQL
Frameworks & Libraries: FastAPI, Django, gRPC, Celery
Databases & Cloud: PostgreSQL, Apache Kafka, Redis, Docker, GCP
Developer Tools: Git, Kubernetes, Terraform, Prometheus
Core Concepts: Distributed Systems, Concurrency, Database Sharding

EXPERIENCE
Backend Engineer | Distributed Core Technologies (Jan 2023 - Present)
- Designed streaming ingest pipelines with Apache Kafka processing 1.2M events/sec.
- Architected asynchronous worker pools with Celery and Redis to handle batch data migrations.

PROJECTS
High-Speed Distributed Rate Limiter
Technologies: Go, Redis Lua Scripts, Docker
- Implemented Token Bucket algorithm with sub-millisecond atomic decrement overhead.

EDUCATION
B.E. in Computer Science | Pune University (2019 - 2023) | CGPA: 8.7/10
"""

RESUME_DEVOPS = """
Rohan Verma
Hyderabad, India | rohan.v@cloud.org | +91 9988776655 | github.com/rohanverma

PROFESSIONAL SUMMARY
DevOps & Cloud Infrastructure Engineer with hands-on expertise in automated CI/CD pipelines, Kubernetes container orchestration, and Infrastructure as Code.

TECHNICAL SKILLS
Languages: Python, Bash, YAML, HCL
Frameworks & Libraries: Flask, Shell Scripts
Databases & Cloud: AWS (EKS, EC2, S3, RDS), Docker, Kubernetes
Developer Tools: Terraform, Ansible, GitHub Actions, Helm, Grafana
Core Concepts: Site Reliability Engineering, Zero Downtime Deployments, IaC

EXPERIENCE
Cloud Infrastructure Associate | InfraOps Global (Aug 2023 - Present)
- Automated multitenant Kubernetes cluster provisioning on AWS EKS using Terraform and Helm.
- Implemented continuous integration and deployment pipelines using GitHub Actions, reducing release cycle time by 60%.

PROJECTS
GitOps Kubernetes Observability Stack
Technologies: Kubernetes, Prometheus, Grafana, ArgoCD
- Built self-healing GitOps deployment pipeline with automated alerts and live telemetry dashboards.

EDUCATION
Bachelor of Technology in Information Technology | JNTU (2019 - 2023) | CGPA: 8.5/10
"""


# --------------------------------------------------------------------------
# Test Cases
# --------------------------------------------------------------------------
def test_canonical_resume_model_validation():
    """Verify CanonicalResume Pydantic model correctly instantiates and validates fields."""
    resume = CanonicalResume(
        contact=ContactInfo(
            full_name="Shreya Sharma",
            email="shreya@vtu.ac.in",
            phone="+91 9876543210",
        ),
        summary="Experienced Full Stack Developer.",
        skills=CategorizedSkills(
            languages=["Python", "TypeScript"],
            frameworks_libraries=["React", "FastAPI"],
            cloud_databases=["MongoDB"],
            developer_tools=["Git", "Docker"],
            core_concepts=["REST APIs"],
        ),
        experience=[
            ExperienceItem(
                company="Tech Corp",
                role="Software Engineer",
                start_date="Jan 2023",
                end_date="Present",
                is_current=True,
                bullets=["Built scalable microservices."],
            )
        ],
        projects=[
            ProjectItem(
                title="InterviewIQ",
                tech_stack=["React", "FastAPI"],
                bullets=["Designed AI interview platform."],
            )
        ],
        education=[
            EducationItem(
                institution="VTU",
                degree="Bachelor of Engineering",
                field_of_study="Computer Science",
            )
        ],
        certifications=[],
        achievements=["Hackathon Winner 2023"],
    )

    assert resume.contact.full_name == "Shreya Sharma"
    assert "Python" in resume.skills.languages
    assert resume.experience[0].company == "Tech Corp"
    assert resume.experience[0].is_current is True


@pytest.mark.asyncio
async def test_parse_3_dummy_resumes_accuracy():
    """Verify parsing accuracy across 3 distinct domain resumes (FullStack, Backend, DevOps)."""
    # 1. Full Stack Resume
    res_fs = await resume_studio_parser.parse_text_to_canonical_resume(RESUME_FULLSTACK)
    assert res_fs.contact.full_name != ""
    assert "@" in res_fs.contact.email
    assert len(res_fs.skills.languages) > 0 or len(res_fs.skills.frameworks_libraries) > 0
    assert len(res_fs.experience) > 0

    # 2. Backend Systems Resume
    res_be = await resume_studio_parser.parse_text_to_canonical_resume(RESUME_BACKEND)
    assert "Patel" in res_be.contact.full_name or "Arjun" in res_be.contact.full_name or "@" in res_be.contact.email
    assert len(res_be.experience) > 0

    # 3. DevOps Resume
    res_devops = await resume_studio_parser.parse_text_to_canonical_resume(RESUME_DEVOPS)
    assert "@" in res_devops.contact.email
    assert len(res_devops.education) > 0


@pytest.mark.asyncio
async def test_scanned_pdf_detection_guard():
    """Verify scanned PDFs (under 50 printable characters) are rejected with a clear user notice."""
    class DummyScannedFile:
        filename = "scanned_invoice_resume.pdf"
        async def read(self):
            # Valid PDF byte-stream with a blank page and 0 text characters
            return (
                b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
                b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
                b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n"
                b"0000000109 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
            )
        async def seek(self, pos):
            pass

    with pytest.raises(ValueError) as excinfo:
        await resume_studio_parser.extract_text_from_file(DummyScannedFile())
    assert "scanned image" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_empty_and_corrupt_file_handling():
    """Verify empty and corrupt documents raise polite validation errors."""
    class EmptyFile:
        filename = "empty_resume.txt"
        async def read(self):
            return b""
        async def seek(self, pos):
            pass

    with pytest.raises(ValueError) as excinfo:
        await resume_studio_parser.extract_text_from_file(EmptyFile())
    assert "empty" in str(excinfo.value).lower()

    class CorruptPDF:
        filename = "broken.pdf"
        async def read(self):
            return b"%PDF-broken-garbage-data-bytes"
        async def seek(self, pos):
            pass

    with pytest.raises(ValueError) as excinfo:
        await resume_studio_parser.extract_text_from_file(CorruptPDF())
    assert "corrupted" in str(excinfo.value).lower() or "document" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_very_long_file_handling():
    """Verify overly long resume text is handled safely and parsed without overflow."""
    long_text = RESUME_FULLSTACK + ("\nAdditional project note with technical details." * 500)
    assert len(long_text) > 20000

    parsed = await resume_studio_parser.parse_text_to_canonical_resume(long_text)
    assert parsed.contact.full_name != ""
    assert len(parsed.experience) > 0


@pytest.mark.asyncio
async def test_versioning_crud_and_cross_user_isolation():
    """Verify version persistence, listing, retrieval, deletion, and cross-account isolation."""
    # 1. Create a version for User A
    version_req = CreateVersionRequest(
        label="Base Resume v1",
        target_role="Full Stack Engineer",
        ats_score=84.5,
        data=CanonicalResume(
            contact=ContactInfo(full_name="Shreya Sharma", email="shreya@vtu.ac.in"),
            summary="Experienced Full Stack Developer.",
            skills=CategorizedSkills(languages=["Python", "TypeScript"]),
            experience=[
                ExperienceItem(
                    company="Tech Corp",
                    role="Developer",
                    bullets=["Engineered API microservices."],
                )
            ],
            projects=[],
            education=[],
            certifications=[],
            achievements=[],
        ),
    )

    doc_a = await resume_studio_parser.create_resume_version(
        user_id=MOCK_USER["firebase_uid"], request=version_req
    )
    assert doc_a.id is not None
    assert doc_a.label == "Base Resume v1"

    # 2. List versions for User A
    versions_a = await resume_studio_parser.list_user_versions(user_id=MOCK_USER["firebase_uid"])
    assert len(versions_a) >= 1
    assert any(v.id == doc_a.id for v in versions_a)

    # 3. User B cannot list or access User A's version
    versions_b = await resume_studio_parser.list_user_versions(user_id=OTHER_USER["firebase_uid"])
    assert not any(v.id == doc_a.id for v in versions_b)

    doc_b_fetch = await resume_studio_parser.get_version_by_id(
        user_id=OTHER_USER["firebase_uid"], version_id=doc_a.id
    )
    assert doc_b_fetch is None

    # 4. User A retrieves their own version
    doc_a_fetch = await resume_studio_parser.get_version_by_id(
        user_id=MOCK_USER["firebase_uid"], version_id=doc_a.id
    )
    assert doc_a_fetch is not None
    assert doc_a_fetch.data.contact.full_name == "Shreya Sharma"

    # 5. User B cannot delete User A's version
    b_deleted = await resume_studio_parser.delete_version(
        user_id=OTHER_USER["firebase_uid"], version_id=doc_a.id
    )
    assert b_deleted is False

    # 6. User A deletes their version
    a_deleted = await resume_studio_parser.delete_version(
        user_id=MOCK_USER["firebase_uid"], version_id=doc_a.id
    )
    assert a_deleted is True


@pytest.mark.asyncio
async def test_resume_studio_endpoints_require_authentication():
    """Verify all /resume-studio API endpoints reject unauthenticated calls with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Unauthenticated calls must return 401
        res_parse = await client.post("/api/v1/resume-studio/parse")
        assert res_parse.status_code == 401

        res_versions = await client.get("/api/v1/resume-studio/versions")
        assert res_versions.status_code == 401

        res_ver = await client.get("/api/v1/resume-studio/version/some-random-id")
        assert res_ver.status_code == 401
