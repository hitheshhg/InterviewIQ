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
    CertificationItem,
)
from app.models.export import ExportResumeRequest
from app.services.resume_exporter import resume_exporter

MOCK_USER = {
    "firebase_uid": "user_export_test_404",
    "email": "export.tester@vtu.ac.in",
    "display_name": "Export Tester",
}


def get_standard_resume() -> CanonicalResume:
    return CanonicalResume(
        contact=ContactInfo(
            full_name="Shreya Sharma",
            email="shreya.sharma@vtu.ac.in",
            phone="+91 9876543210",
            location="Bengaluru, Karnataka, India",
            linkedin_url="https://linkedin.com/in/shreyasharma",
            github_url="https://github.com/shreyasharma",
        ),
        summary="Results-oriented Full Stack Software Engineer with 2+ years experience building scalable microservices and responsive frontends using React, TypeScript, FastAPI, and MongoDB.",
        skills=CategorizedSkills(
            languages=["Python", "TypeScript", "JavaScript", "SQL"],
            frameworks_libraries=["React", "FastAPI", "Node.js", "Tailwind CSS"],
            cloud_databases=["MongoDB", "PostgreSQL", "Redis", "AWS"],
            developer_tools=["Docker", "Git", "Vite", "Linux"],
            core_concepts=["RESTful APIs", "Microservices", "System Design"],
        ),
        experience=[
            ExperienceItem(
                company="CloudScale Solutions",
                role="Full Stack Developer",
                start_date="Jan 2023",
                end_date="Present",
                is_current=True,
                bullets=[
                    "Architected high-throughput FastAPI microservices handling 50,000 daily requests.",
                    "Engineered responsive React and TypeScript interfaces boosting user retention by 25%.",
                    "Optimized MongoDB Atlas database indexing, reducing p99 query latency to 38ms.",
                ],
            )
        ],
        projects=[
            ProjectItem(
                title="InterviewIQ",
                tech_stack=["React", "TypeScript", "FastAPI", "MongoDB"],
                bullets=[
                    "Spearheaded multi-turn WebSocket interview session manager with sub-200ms audio latency.",
                    "Integrated deterministic ATS scoring algorithm evaluating resumes across 5 weighted dimensions.",
                ],
            )
        ],
        education=[
            EducationItem(
                institution="Visvesvaraya Technological University",
                degree="B.E.",
                field_of_study="Computer Science and Engineering",
                start_date="2020",
                end_date="2024",
                gpa_or_percentage="8.9 CGPA",
            )
        ],
        certifications=[
            CertificationItem(
                name="AWS Solutions Architect Associate",
                issuer="Amazon Web Services",
                year="2023",
            )
        ],
    )


# --------------------------------------------------------------------------
# 1. Filename Convention Tests
# --------------------------------------------------------------------------
def test_sanitize_filename_convention():
    """Verify filename adheres to Name_Role_Resume.ext."""
    fn1 = resume_exporter.sanitize_filename("Shreya Sharma", "Full Stack Developer", "pdf")
    assert fn1 == "Shreya_Sharma_Full_Stack_Developer_Resume.pdf"

    fn2 = resume_exporter.sanitize_filename("René O'Connor", "Backend & Cloud Engineer", "docx")
    assert fn2 == "Ren_O_Connor_Backend_Cloud_Engineer_Resume.docx"

    fn3 = resume_exporter.sanitize_filename("  Aarav   Gupta  ", "SDE-1", ".pdf")
    assert fn3 == "Aarav_Gupta_SDE_1_Resume.pdf"


# --------------------------------------------------------------------------
# 2. PDF & DOCX Generation for All 4 Templates
# --------------------------------------------------------------------------
@pytest.mark.parametrize("template_name", ["classic", "modern", "compact", "minimal"])
def test_pdf_export_all_templates(template_name):
    """Verify all 4 ATS templates generate valid, non-empty PDF bytes."""
    resume = get_standard_resume()
    pdf_bytes = resume_exporter.generate_pdf(
        resume=resume,
        template=template_name,
        accent_color="cyan",
        font_size="md",
    )
    assert len(pdf_bytes) > 1000
    # PDF signature check
    assert pdf_bytes.startswith(b"%PDF")


@pytest.mark.parametrize("template_name", ["classic", "modern", "compact", "minimal"])
def test_docx_export_all_templates(template_name):
    """Verify all 4 ATS templates generate valid Microsoft Word (.docx) zip bytes."""
    resume = get_standard_resume()
    docx_bytes = resume_exporter.generate_docx(
        resume=resume,
        template=template_name,
        accent_color="cyan",
    )
    assert len(docx_bytes) > 2000
    # DOCX PK Zip header signature
    assert docx_bytes.startswith(b"PK\x03\x04")


# --------------------------------------------------------------------------
# 3. Export Self-Test Re-Parser Verification
# --------------------------------------------------------------------------
def test_export_self_test_pdf_survives():
    """Verify exported PDF re-parses cleanly and preserves all critical ATS data."""
    resume = get_standard_resume()
    pdf_bytes = resume_exporter.generate_pdf(resume=resume, template="modern")

    self_test = resume_exporter.run_export_self_test(
        file_bytes=pdf_bytes,
        file_type="pdf",
        expected_resume=resume,
    )

    assert self_test["is_ats_readable"] is True
    assert self_test["name_matched"] is True
    assert self_test["email_matched"] is True
    assert self_test["character_count"] >= 300
    assert len(self_test["survived_sections"]) >= 3
    assert "Skills" in self_test["survived_sections"]
    assert "Experience" in self_test["survived_sections"]
    assert self_test["skills_survived_count"] >= 2


def test_export_self_test_docx_survives():
    """Verify exported DOCX re-parses cleanly and preserves all critical ATS data."""
    resume = get_standard_resume()
    docx_bytes = resume_exporter.generate_docx(resume=resume, template="modern")

    self_test = resume_exporter.run_export_self_test(
        file_bytes=docx_bytes,
        file_type="docx",
        expected_resume=resume,
    )

    assert self_test["is_ats_readable"] is True
    assert self_test["name_matched"] is True
    assert self_test["email_matched"] is True
    assert self_test["character_count"] >= 300
    assert len(self_test["survived_sections"]) >= 3


# --------------------------------------------------------------------------
# 4. Special Characters, Accents & Edge Cases
# --------------------------------------------------------------------------
def test_export_special_characters_and_symbols():
    """Verify bullets with symbols, HTML characters (&, <, >), and accented names survive."""
    special_resume = get_standard_resume()
    special_resume.contact.full_name = "René François Müller"
    special_resume.experience[0].bullets = [
        "Led R&D team building C++ and Python <REST> APIs with 99.9% uptime & zero crashes.",
        "Managed budget of $120k — improved throughput by 40% across distributed nodes.",
    ]

    # Generate both formats
    pdf_bytes = resume_exporter.generate_pdf(special_resume, template="modern")
    docx_bytes = resume_exporter.generate_docx(special_resume, template="modern")

    assert len(pdf_bytes) > 1000
    assert len(docx_bytes) > 2000

    pdf_test = resume_exporter.run_export_self_test(pdf_bytes, "pdf", special_resume)
    assert pdf_test["is_ats_readable"] is True
    assert pdf_test["name_matched"] is True


# --------------------------------------------------------------------------
# 5. API Endpoint Tests & Security Token Enforcements
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_export_endpoint_unauthenticated_returns_401():
    """Verify export endpoints reject unauthenticated requests with 401."""
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/resume-studio/export",
            json={"resume": get_standard_resume().model_dump(), "format": "pdf"},
        )
        assert res.status_code == 401

        res_test = await ac.post(
            "/api/v1/resume-studio/export/self-test",
            json={"resume": get_standard_resume().model_dump(), "format": "pdf"},
        )
        assert res_test.status_code == 401


@pytest.mark.asyncio
async def test_export_endpoint_authenticated_returns_pdf_stream():
    """Verify authenticated user can download binary PDF stream."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            payload = {
                "resume": get_standard_resume().model_dump(),
                "format": "pdf",
                "template": "modern",
                "target_role": "Full Stack Engineer",
            }
            res = await ac.post("/api/v1/resume-studio/export", json=payload)
            assert res.status_code == 200
            assert res.headers["content-type"] == "application/pdf"
            assert "Shreya_Sharma_Full_Stack_Engineer_Resume.pdf" in res.headers["content-disposition"]
            assert res.content.startswith(b"%PDF")
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_export_self_test_endpoint_authenticated_returns_report():
    """Verify authenticated user receives detailed ATS-readable self-test report."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            payload = {
                "resume": get_standard_resume().model_dump(),
                "format": "pdf",
                "template": "compact",
                "target_role": "Full Stack Engineer",
            }
            res = await ac.post("/api/v1/resume-studio/export/self-test", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["is_ats_readable"] is True
            assert data["name_matched"] is True
            assert data["email_matched"] is True
            assert "Skills" in data["survived_sections"]
            assert data["file_type"] == "PDF"
    finally:
        app.dependency_overrides.clear()
