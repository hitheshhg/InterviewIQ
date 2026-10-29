from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from app.models.resume_studio import CanonicalResume


class GenerateSeedsRequest(BaseModel):
    """Payload to extract interview seeds from resume weak spots and JD gaps."""
    resume: CanonicalResume
    job_description: Optional[str] = None
    target_role: Optional[str] = "Software Engineer"


class InterviewSeedItem(BaseModel):
    """A single interview seed challenging a weak resume claim or missing skill."""
    id: str
    seed_type: Literal["unsubstantiated_skill", "weak_claim", "missing_jd_skill"]
    topic: str
    seed_prompt: str
    reason: str


class GenerateSeedsResponse(BaseModel):
    """Response containing extracted interview seeds."""
    seeds: List[InterviewSeedItem]
    target_role: str
    total_seeds: int


class GenerateRoadmapFromGapsRequest(BaseModel):
    """Payload to construct a targeted Career Roadmap from Multi-JD common gaps."""
    target_role: str = Field("Software Engineer", description="Target role title")
    common_gaps: List[str] = Field(..., min_length=1, description="List of common skill gaps")
