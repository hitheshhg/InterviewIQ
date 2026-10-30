from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.canonical_resume import CanonicalResume


class ExportResumeRequest(BaseModel):
    """Request payload to export canonical resume to PDF or DOCX."""
    canonical_resume: CanonicalResume
    template: str = Field(
        default="classic",
        description="Template style: 'classic', 'modern', or 'minimal'",
    )
    format: str = Field(
        default="pdf",
        description="Export file format: 'pdf' or 'docx'",
    )
    target_role: Optional[str] = Field(
        default="Full Stack Developer",
        description="Target job title",
    )
    previous_score: Optional[int] = Field(
        default=None,
        description="Original ATS score before fixes (e.g. 48)",
    )
    new_score: Optional[int] = Field(
        default=None,
        description="Improved ATS score after fixes (e.g. 82)",
    )


class ExportSelfTestResult(BaseModel):
    """Result of self-test re-parsing the exported resume file."""
    is_ats_readable: bool = Field(
        description="True if sections, contact info, and skills survived re-parsing",
    )
    character_count: int = Field(
        description="Total plain text characters extracted by the ATS parser",
    )
    name_matched: bool = Field(
        description="Candidate name identified by the parser",
    )
    email_matched: bool = Field(
        description="Candidate email successfully extracted",
    )
    survived_sections: List[str] = Field(
        default_factory=list,
        description="List of standard section headers recognized (e.g. Summary, Skills, Experience)",
    )
    skills_survived_count: int = Field(
        description="Count of key technical skills preserved in plain text",
    )
    file_type: str = Field(
        description="Export format ('PDF' or 'DOCX')",
    )
    filename: str = Field(
        description="ATS-compliant export filename (e.g. 'Shreya_Resume.pdf')",
    )
    verdict: str = Field(
        description="Human-readable verification verdict",
    )
    badge: str = Field(
        default="ATS-readable",
        description="Green badge status for candidate confidence",
    )
