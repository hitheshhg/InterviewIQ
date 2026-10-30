from typing import List, Optional
from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    full_name: str = Field(default="", description="Full name of the candidate")
    email: str = Field(default="", description="Email address")
    phone: str = Field(default="", description="Phone number with country code if available")
    location: str = Field(default="", description="City, State / Country")
    linkedin: Optional[str] = Field(default=None, description="LinkedIn profile URL or handle")
    github: Optional[str] = Field(default=None, description="GitHub profile URL or handle")
    portfolio: Optional[str] = Field(default=None, description="Personal website or portfolio URL")


class CategorizedSkills(BaseModel):
    languages: List[str] = Field(
        default_factory=list, description="Programming languages (e.g., Python, TypeScript, Java)"
    )
    frameworks: List[str] = Field(
        default_factory=list, description="Frameworks and libraries (e.g., FastAPI, React, PyTorch)"
    )
    developer_tools: List[str] = Field(
        default_factory=list, description="Developer tools (e.g., Git, Docker, Kubernetes, Linux)"
    )
    cloud_databases: List[str] = Field(
        default_factory=list,
        description="Cloud platforms and databases (e.g., AWS, MongoDB, PostgreSQL, Redis)",
    )
    other: List[str] = Field(
        default_factory=list, description="Other technical concepts or soft skills"
    )


class ExperienceItem(BaseModel):
    company: str = Field(default="", description="Organization or employer name")
    role: str = Field(default="", description="Job title or designation")
    location: str = Field(default="", description="City, Country or Remote")
    start_date: str = Field(default="", description="Start date (e.g., Jun 2023)")
    end_date: str = Field(default="", description="End date (e.g., Present, Aug 2024)")
    bullets: List[str] = Field(
        default_factory=list, description="Accomplishment bullet points"
    )


class ProjectItem(BaseModel):
    name: str = Field(default="", description="Project title")
    description: str = Field(default="", description="Brief 1-line project overview")
    tech_stack: List[str] = Field(
        default_factory=list, description="Technologies and libraries used"
    )
    bullets: List[str] = Field(
        default_factory=list, description="Feature and impact bullet points"
    )
    link: Optional[str] = Field(default=None, description="Repository or live demo URL")


class EducationItem(BaseModel):
    institution: str = Field(default="", description="College, University or School name")
    degree: str = Field(default="", description="Degree level (e.g., B.E., B.Tech, M.S.)")
    field_of_study: str = Field(
        default="", description="Major or specialization (e.g., Computer Science)"
    )
    graduation_year: str = Field(default="", description="Graduation year (e.g., 2024)")
    gpa_or_grade: Optional[str] = Field(
        default=None, description="CGPA, GPA or percentage (e.g., 8.9/10)"
    )


class CertificationItem(BaseModel):
    name: str = Field(default="", description="Certification title")
    issuer: str = Field(default="", description="Issuing authority or platform")
    year: Optional[str] = Field(default=None, description="Year earned or credential ID")


class CanonicalResume(BaseModel):
    """
    Canonical, structured schema representing the single source of truth
    for a candidate's parsed and optimized resume.
    """
    contact: ContactInfo = Field(default_factory=ContactInfo)
    summary: str = Field(default="", description="Professional summary or objective statement")
    skills: CategorizedSkills = Field(default_factory=CategorizedSkills)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    certifications: List[CertificationItem] = Field(default_factory=list)

    def all_skills(self) -> List[str]:
        """Return a deduplicated, case-preserved list of all skills across categories."""
        combined = (
            self.skills.languages
            + self.skills.frameworks
            + self.skills.developer_tools
            + self.skills.cloud_databases
            + self.skills.other
        )
        seen = set()
        deduped = []
        for s in combined:
            norm = s.strip().lower()
            if norm and norm not in seen:
                seen.add(norm)
                deduped.append(s.strip())
        return deduped

    def all_bullets(self) -> List[str]:
        """Return all bullet points across experience and project sections."""
        bullets = []
        for exp in self.experience:
            bullets.extend(exp.bullets)
        for proj in self.projects:
            bullets.extend(proj.bullets)
        return bullets


class ParseResumeResponse(BaseModel):
    status: str = "success"
    file_name: str
    file_type: str
    raw_text_length: int
    canonical_resume: CanonicalResume
    job_description: Optional[str] = None
    resume_id: Optional[str] = None


class SaveActiveResumeRequest(BaseModel):
    canonical_resume: CanonicalResume
    job_description: Optional[str] = ""
    target_role: Optional[str] = "Full Stack Developer"
    file_name: Optional[str] = "Resume.pdf"
    previous_score: Optional[int] = None
    current_score: Optional[int] = None


class ActiveResumeResponse(BaseModel):
    status: str = "success"
    resume_id: str
    version: int
    is_active: bool
    target_role: str
    job_description: str
    canonical_resume: CanonicalResume
    updated_at: str

