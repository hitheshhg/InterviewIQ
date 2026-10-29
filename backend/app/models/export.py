from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from app.models.resume_studio import CanonicalResume


class ExportResumeRequest(BaseModel):
    resume: CanonicalResume
    format: Literal["pdf", "docx"] = Field(default="pdf", description="Export format: 'pdf' or 'docx'")
    template: str = Field(default="modern", description="Template id: classic, modern, compact, minimal")
    accent_color: str = Field(default="cyan", description="Accent color: slate, cyan, emerald, navy, violet")
    font_size: str = Field(default="md", description="Font size scale: sm, md, lg")
    target_role: str = Field(default="Full Stack Engineer", description="Target role for naming")


class ExportSelfTestResponse(BaseModel):
    is_ats_readable: bool
    character_count: int
    name_matched: bool
    email_matched: bool
    survived_sections: List[str]
    skills_survived_count: int
    file_type: str
    verdict: str
    filename: str
