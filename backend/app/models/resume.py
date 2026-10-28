from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    email: Optional[str] = ""
    phone: Optional[str] = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    location: Optional[str] = ""


class ExperienceItem(BaseModel):
    role: str
    company: str
    duration: Optional[str] = ""
    bullets: List[str] = Field(default_factory=list)
    has_metrics: bool = False


class EducationItem(BaseModel):
    institution: str
    degree: str
    year: Optional[str] = ""
    score: Optional[str] = ""


class ProjectItem(BaseModel):
    title: str
    description: str
    tech_stack: List[str] = Field(default_factory=list)
    link: Optional[str] = ""


class ParsedResume(BaseModel):
    candidate_name: str
    contact: ContactInfo = Field(default_factory=ContactInfo)
    summary: Optional[str] = ""
    technical_skills: List[str] = Field(default_factory=list)
    soft_skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)


class ATSBreakdown(BaseModel):
    keyword_match_score: float = Field(ge=0, le=100)
    section_completeness_score: float = Field(ge=0, le=100)
    formatting_score: float = Field(ge=0, le=100)
    action_verbs_score: float = Field(ge=0, le=100)
    quantifiable_impact_score: float = Field(ge=0, le=100)


class ATSAnalysisResult(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    breakdown: ATSBreakdown
    matched_keywords: List[str]
    missing_keywords: List[str]
    actionable_tips: List[str]
    target_role: str
    parsed_data: ParsedResume


class ResumeUploadResponse(BaseModel):
    status: str
    resume_id: str
    file_name: str
    file_type: str
    ats_analysis: ATSAnalysisResult
