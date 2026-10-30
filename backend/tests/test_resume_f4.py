import pytest
import io
from docx import Document
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.dependencies import get_current_user
from app.models.canonical_resume import (
    CanonicalResume,
    ContactInfo,
    CategorizedSkills,
    ExperienceItem,
    ProjectItem,
    EducationItem,
    CertificationItem,
)
from app.models.canonical_export import ExportResumeRequest
from app.services.canonical_exporter import canonical_exporter
from tests.test_resume_f1 import RESUME_1_STRONG_CS
from app.services.canonical_parser import canonical_parser

TEST_USER = {
    "firebase_uid": "user_shreya_f4_test",
    "email": "shreya.test@vtu.ac.in",
    "name": "Shreya CS",
}


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_classic_modern_minimal_pdf_export():
    """Verify that all 3 templates (Classic, Modern, Minimal) generate valid single-column PDFs."""
    resume = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)

    for template in ["classic", "modern", "minimal"]:
        pdf_bytes = canonical_exporter.generate_pdf(resume=resume, template=template)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 2000
        # Valid PDF header
        assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_classic_modern_minimal_docx_export():
    """Verify that all 3 templates generate valid ATS-compliant DOCX documents."""
    resume = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)

    for template in ["classic", "modern", "minimal"]:
        docx_bytes = canonical_exporter.generate_docx(resume=resume, template=template)
        assert isinstance(docx_bytes, bytes)
        assert len(docx_bytes) > 2000
        # Valid DOCX zip signature PK\x03\x04
        assert docx_bytes.startswith(b"PK\x03\x04")

        # Verify python-docx can parse the document
        doc = Document(io.BytesIO(docx_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        assert len(paragraphs) >= 5
        assert any(resume.contact.full_name in p for p in paragraphs)


@pytest.mark.asyncio
async def test_export_self_test_pdf_and_docx():
    """
    Self-test verification: Re-parses the exported file with our own ATS parser
    and asserts that sections, contact info, and skills survive cleanly with the green badge.
    """
    resume = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)

    # 1. PDF Self-Test
    pdf_bytes = canonical_exporter.generate_pdf(resume=resume, template="classic")
    pdf_test = canonical_exporter.run_export_self_test(
        file_bytes=pdf_bytes,
        file_type="pdf",
        expected_resume=resume,
    )

    assert pdf_test.is_ats_readable is True
    assert pdf_test.badge == "ATS-readable"
    assert pdf_test.name_matched is True
    assert pdf_test.email_matched is True
    assert len(pdf_test.survived_sections) >= 4
    assert pdf_test.skills_survived_count >= 3

    # 2. DOCX Self-Test
    docx_bytes = canonical_exporter.generate_docx(resume=resume, template="modern")
    docx_test = canonical_exporter.run_export_self_test(
        file_bytes=docx_bytes,
        file_type="docx",
        expected_resume=resume,
    )

    assert docx_test.is_ats_readable is True
    assert docx_test.badge == "ATS-readable"
    assert docx_test.name_matched is True
    assert docx_test.email_matched is True
    assert len(docx_test.survived_sections) >= 4


@pytest.mark.asyncio
async def test_special_characters_and_international_accents():
    """
    Verify robust handling of XML entities, math symbols, and international accents:
    e.g. '&', '<', '>', quotes, 'José Ramón Müller', 'Café & Resumé'.
    Ensures ReportLab flowables and DOCX generators never crash on complex text.
    """
    resume = CanonicalResume(
        contact=ContactInfo(
            full_name="José Ramón Müller",
            email="jose.muller@café-resumé.de",
            phone="+49 151 2345678",
            location="München, Germany",
            linkedin="linkedin.com/in/jose-muller",
            github="github.com/josemuller",
        ),
        summary="Senior Engineer & Architect specializing in C++ & <React/> systems, delivering > 99.9% availability.",
        skills=CategorizedSkills(
            languages=["C++", "C#", "Python & Go", "SQL"],
            frameworks=["FastAPI", "<React/>", "Node.js & Express"],
            developer_tools=["Docker & K8s", "Git", "CI/CD"],
            cloud_databases=["PostgreSQL", "Redis"],
            other=["System Design & Architecture"],
        ),
        experience=[
            ExperienceItem(
                company="Café & Data Systems S.A.",
                role="Lead Developer & Researcher",
                location="Zürich, Switzerland",
                start_date="2021",
                end_date="Present",
                bullets=[
                    "Engineered distributed cache handler resolving > 10,000 req/s with 0% downtime.",
                    "Refactored legacy C++ codebase, improving throughput by 35% & reducing memory leaks.",
                ],
            )
        ],
        projects=[
            ProjectItem(
                name="Project Alpha & Omega",
                description="High-performance pipeline for data ingest & analytics.",
                tech_stack=["C++", "Python", "Docker"],
                bullets=["Automated continuous deployment with zero disruption."],
            )
        ],
        education=[
            EducationItem(
                institution="Technical University of Munich (TUM)",
                degree="M.Sc.",
                field_of_study="Informatics & Software Engineering",
                graduation_year="2021",
                gpa_or_grade="1.2 (Sehr Gut)",
            )
        ],
        certifications=[
            CertificationItem(
                name="AWS Certified Solutions Architect & DevOps",
                issuer="Amazon Web Services",
                year="2022",
            )
        ],
    )

    # 1. PDF export with accents & XML special characters
    pdf_bytes = canonical_exporter.generate_pdf(resume=resume, template="modern")
    assert len(pdf_bytes) > 1000

    # 2. DOCX export
    docx_bytes = canonical_exporter.generate_docx(resume=resume, template="classic")
    assert len(docx_bytes) > 1000

    # 3. Self-test confirmation
    test_result = canonical_exporter.run_export_self_test(pdf_bytes, "pdf", resume)
    assert test_result.is_ats_readable is True
    assert test_result.badge == "ATS-readable"


@pytest.mark.asyncio
async def test_long_content_multi_page_resilience():
    """Verify that comprehensive resumes with extensive bullets render without clipping or errors."""
    resume = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)

    # Add extra bullets and projects to simulate a 2-page senior resume
    resume.experience[0].bullets.extend([
        "Spearheaded database partitioning across 12 shards, reducing query latencies by 50%.",
        "Mentored 6 junior developers on asynchronous Python patterns and unit testing best practices.",
        "Authored comprehensive architectural decision records (ADRs) for production microservices.",
        "Integrated Prometheus metrics and Grafana dashboards for proactive alerting on SLO breaches.",
    ])

    pdf_bytes = canonical_exporter.generate_pdf(resume=resume, template="minimal")
    test_res = canonical_exporter.run_export_self_test(pdf_bytes, "pdf", resume)
    assert test_res.is_ats_readable is True
    assert test_res.character_count > 1200


@pytest.mark.asyncio
async def test_filename_standard_formatting():
    """Verify filename adheres to Name_Resume.pdf specification."""
    fn_pdf = canonical_exporter.sanitize_filename("Shreya CS", "pdf")
    assert fn_pdf == "Shreya_CS_Resume.pdf"

    fn_docx = canonical_exporter.sanitize_filename("Hithesh H.G.", "docx")
    assert fn_docx == "Hithesh_H_G_Resume.docx"


@pytest.mark.asyncio
async def test_api_export_and_self_test_endpoints():
    """Verify HTTP API endpoints for file export and self-test re-parsing."""
    transport = ASGITransport(app=app)
    resume = await canonical_parser.parse_resume_text(RESUME_1_STRONG_CS)

    req = ExportResumeRequest(
        canonical_resume=resume,
        template="classic",
        format="pdf",
        target_role="Full Stack Developer",
    )

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test POST /api/v1/resume/export-self-test
        res_test = await client.post("/api/v1/resume/export-self-test", json=req.model_dump())
        assert res_test.status_code == 200
        data_test = res_test.json()
        assert data_test["is_ats_readable"] is True
        assert data_test["badge"] == "ATS-readable"
        assert "Shreya" in data_test["filename"]

        # 2. Test POST /api/v1/resume/export-file (PDF)
        res_file = await client.post("/api/v1/resume/export-file", json=req.model_dump())
        assert res_file.status_code == 200
        assert res_file.headers["content-type"] == "application/pdf"
        assert 'attachment; filename="Shreya' in res_file.headers.get("content-disposition", "")
        assert len(res_file.content) > 1000

        # 3. Test POST /api/v1/resume/export-file (DOCX)
        req_docx = ExportResumeRequest(
            canonical_resume=resume,
            template="modern",
            format="docx",
            target_role="Full Stack Developer",
        )
        res_docx = await client.post("/api/v1/resume/export-file", json=req_docx.model_dump())
        assert res_docx.status_code == 200
        assert "wordprocessingml" in res_docx.headers["content-type"]
        assert len(res_docx.content) > 1000

