import uuid
from typing import List, Dict, Optional, Literal, Any
from pydantic import BaseModel, Field
from app.models.resume_studio import CanonicalResume


class JobDescriptionInput(BaseModel):
    id: str = Field(default_factory=lambda: f"jd-{uuid.uuid4().hex[:6]}")
    title: str = Field(..., min_length=2, description="Target role title (e.g. 'Backend Engineer')")
    company: Optional[str] = Field(default="Target Company", description="Employer or company name")
    text: str = Field(..., min_length=15, description="Full job description text")


class MultiJDCompareRequest(BaseModel):
    resume: CanonicalResume
    job_descriptions: List[JobDescriptionInput] = Field(
        ..., min_length=1, max_length=5, description="1 to 5 Job Descriptions to compare against"
    )


class SingleJDMatchResult(BaseModel):
    jd_id: str
    title: str
    company: str
    overall_score: int
    keyword_match_pct: float
    verdict: str
    matched_skills: List[str]
    partial_skills: List[str]
    missing_skills: List[str]


class SkillHeatmapRow(BaseModel):
    skill: str
    category: str
    cells: Dict[str, Literal["matched", "partial", "missing"]]
    missing_count: int
    matched_count: int


class MultiJDCompareResponse(BaseModel):
    rankings: List[SingleJDMatchResult]
    best_fit_jd_id: str
    skill_matrix: List[SkillHeatmapRow]
    common_gaps: List[str]
    comparison_chart_data: List[Dict[str, Any]]
