import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr


class ContactInfo(BaseModel):
    full_name: str = Field(..., description="Candidate full name")
    email: str = Field(..., description="Primary email address")
    phone: Optional[str] = Field(default="", description="Contact phone number")
    location: Optional[str] = Field(default="", description="City, State / Country")
    linkedin_url: Optional[str] = Field(default="", description="LinkedIn profile URL")
    github_url: Optional[str] = Field(default="", description="GitHub profile URL")
    portfolio_url: Optional[str] = Field(default="", description="Personal website or portfolio URL")


class ExperienceItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8], description="Unique item identifier")
    company: str = Field(..., description="Organization or employer name")
    role: str = Field(..., description="Job title / role")
    location: Optional[str] = Field(default="", description="Work location or Remote")
    start_date: str = Field(default="", description="Start date (e.g. 'Jan 2023')")
    end_date: Optional[str] = Field(default="", description="End date (e.g. 'Present' or 'Dec 2024')")
    is_current: bool = Field(default=False, description="Whether this is the current position")
    bullets: List[str] = Field(default_factory=list, description="Accomplishment bullet points")


class ProjectItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8], description="Unique item identifier")
    title: str = Field(..., description="Project title")
    tech_stack: List[str] = Field(default_factory=list, description="Technologies & tools used")
    bullets: List[str] = Field(default_factory=list, description="Key features and measurable impact")
    github_url: Optional[str] = Field(default="", description="Repository URL")
    live_url: Optional[str] = Field(default="", description="Live deployment URL")


class EducationItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8], description="Unique item identifier")
    institution: str = Field(..., description="College or University name")
    degree: str = Field(..., description="Degree earned (e.g. 'Bachelor of Engineering')")
    field_of_study: str = Field(default="", description="Major / Field (e.g. 'Computer Science')")
    start_date: str = Field(default="", description="Start year or month/year")
    end_date: Optional[str] = Field(default="", description="Graduation year or month/year")
    gpa_or_percentage: Optional[str] = Field(default="", description="GPA or percentage score")


class CertificationItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8], description="Unique item identifier")
    name: str = Field(..., description="Certification title")
    issuer: str = Field(..., description="Issuing body (e.g. 'AWS', 'Google Cloud')")
    year: Optional[str] = Field(default="", description="Year obtained")
    url: Optional[str] = Field(default="", description="Verification URL")


class CategorizedSkills(BaseModel):
    languages: List[str] = Field(default_factory=list, description="Programming languages (e.g. Python, TypeScript)")
    frameworks_libraries: List[str] = Field(default_factory=list, description="Frameworks (e.g. React, FastAPI, Node.js)")
    cloud_databases: List[str] = Field(default_factory=list, description="Databases & Cloud (e.g. MongoDB, PostgreSQL, AWS)")
    developer_tools: List[str] = Field(default_factory=list, description="Developer tools (e.g. Git, Docker, Vite)")
    core_concepts: List[str] = Field(default_factory=list, description="Core domains (e.g. System Design, REST APIs)")


class CanonicalResume(BaseModel):
    contact: ContactInfo
    summary: str = Field(default="", description="2-4 sentence executive summary")
    skills: CategorizedSkills = Field(default_factory=CategorizedSkills)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    certifications: List[CertificationItem] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)


# Versioning & API Request/Response Schemas
class CreateVersionRequest(BaseModel):
    label: str = Field(default="Base Resume", description="Version label (e.g. 'Base', 'Tailored: Google SDE')")
    target_role: str = Field(default="Full Stack Developer", description="Target position")
    parent_version_id: Optional[str] = Field(default=None, description="ID of parent version if derived")
    data: CanonicalResume
    ats_score: Optional[float] = Field(default=0.0, description="Calculated ATS score for this version")


class ResumeVersionDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    parent_version_id: Optional[str] = None
    label: str
    target_role: str
    data: CanonicalResume
    ats_score: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VersionSummaryItem(BaseModel):
    id: str
    user_id: str
    label: str
    target_role: str
    parent_version_id: Optional[str] = None
    ats_score: float
    created_at: str
    updated_at: str


class ParseResumeResponse(BaseModel):
    status: str = "success"
    file_name: str
    file_type: str
    resume: CanonicalResume
    raw_character_count: int

