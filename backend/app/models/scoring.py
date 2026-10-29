from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.resume_studio import CanonicalResume


class ScoreRequest(BaseModel):
    resume: CanonicalResume
    job_description: Optional[str] = Field(default="", description="Target job description for alignment scoring")
    target_role: Optional[str] = Field(default="Full Stack Developer", description="Target role name")


class SkillMatchItem(BaseModel):
    skill: str
    status: str = Field(..., description="'matched', 'partial', or 'missing'")
    resume_evidence_line: Optional[str] = Field(default="", description="Exact line from candidate resume supporting the match")
    category: Optional[str] = Field(default="general", description="Skill category (e.g. 'language', 'framework', 'cloud')")


class WeakLineItem(BaseModel):
    section: str = Field(..., description="Section containing the line (e.g. 'Experience', 'Projects')")
    original_line: str = Field(..., description="The bullet or text flagged")
    issue_type: str = Field(..., description="'passive_phrase', 'missing_metric', 'too_long', 'too_short'")
    recommendation: str = Field(..., description="Actionable improvement suggestion")


class SectionScoreItem(BaseModel):
    name: str
    score_percentage: float = Field(..., description="Score achieved on this dimension (0-100)")
    weight_percentage: float = Field(..., description="Weight assigned in the ATS formula (e.g. 40 or 15)")
    points_earned: float = Field(..., description="Calculated contribution to overall ATS score")
    max_points: float = Field(..., description="Maximum possible contribution")
    tips: List[str] = Field(default_factory=list, description="Top tips to gain remaining points")


class ScoreBreakdown(BaseModel):
    keyword_semantic_match: SectionScoreItem
    section_completeness: SectionScoreItem
    quantified_achievements: SectionScoreItem
    action_verbs_quality: SectionScoreItem
    formatting_parseability: SectionScoreItem


class ATSScoreResponse(BaseModel):
    overall_score: int = Field(..., description="Overall calculated ATS score (0-100)")
    is_tailored: bool = Field(..., description="True if scored against a specific Job Description; False for general ATS")
    summary_verdict: str = Field(..., description="Status tier (e.g. 'Interview Ready', 'Competitive', 'Needs Work')")
    breakdown: ScoreBreakdown
    matched_skills: List[SkillMatchItem] = Field(default_factory=list)
    partial_skills: List[SkillMatchItem] = Field(default_factory=list)
    missing_skills: List[SkillMatchItem] = Field(default_factory=list)
    weak_lines: List[WeakLineItem] = Field(default_factory=list)
    top_action_items: List[str] = Field(default_factory=list)
