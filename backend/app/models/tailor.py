from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from app.models.resume_studio import CanonicalResume


class TailorResumeRequest(BaseModel):
    resume: CanonicalResume
    job_description: str = Field(..., min_length=15, description="Target job description requirements")
    target_role: str = Field(default="Software Engineer", description="Target job title")
    target_company: Optional[str] = Field(default="Target Company", description="Employer name")
    parent_version_id: Optional[str] = Field(default=None, description="Current version ID")


class BulletDiffItem(BaseModel):
    id: str
    section: str
    original_text: str
    tailored_text: str
    change_type: Literal["modified", "reordered", "unchanged"] = "modified"
    has_unverified_claims: bool = False
    unverified_tokens: List[str] = Field(default_factory=list)
    explanation: str = ""


class TailorResumeResponse(BaseModel):
    tailored_resume: CanonicalResume
    target_role: str
    target_company: str
    base_score: int
    projected_tailored_score: int
    score_delta: int
    diff_items: List[BulletDiffItem]
    unverified_claims_count: int
    summary_changes: str
