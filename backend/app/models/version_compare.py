from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.models.resume_studio import CanonicalResume


class CompareVersionsRequest(BaseModel):
    """Request payload to compare two resume versions or active drafts."""
    version_id_1: Optional[str] = None
    version_id_2: Optional[str] = None
    resume_1: Optional[CanonicalResume] = None
    resume_2: Optional[CanonicalResume] = None


class VersionSummaryMeta(BaseModel):
    """Metadata header for a version in comparison."""
    id: str
    label: str
    target_role: str
    ats_score: float
    created_at: str
    word_count: int


class VersionComparisonResponse(BaseModel):
    """Detailed side-by-side comparison report between two resume versions."""
    version_1: VersionSummaryMeta
    version_2: VersionSummaryMeta
    score_delta: float
    word_count_delta: int
    summary_diff: Dict[str, Any]
    skills_diff: Dict[str, Any]  # added, removed, common, total_v1, total_v2
    experience_diff: Dict[str, Any]
    projects_diff: Dict[str, Any]
    verdict: str


class UpdateVersionLabelRequest(BaseModel):
    """Request to update a resume version label."""
    label: str = Field(..., min_length=1, max_length=100)


class MultiJDHistoryItem(BaseModel):
    """Historical summary of a multi-JD comparison."""
    id: str
    user_id: str
    target_role: str
    resume_id: Optional[str] = None
    role_count: int
    top_match_role: str
    top_match_percentage: float
    common_gaps_count: int
    created_at: str
