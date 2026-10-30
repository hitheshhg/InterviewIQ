from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field


class SkillEvidenceItem(BaseModel):
    skill: str = Field(description="Name of the required skill or keyword")
    status: Literal["matched", "partial", "missing"] = Field(
        description="Whether the skill is matched, partially matched, or missing"
    )
    evidence_line: Optional[str] = Field(
        default=None, description="Exact line from the resume citing the skill"
    )
    note: Optional[str] = Field(
        default=None, description="Explanation or recommendation for partial / missing skill"
    )


class FactorScore(BaseModel):
    name: str
    score: float = Field(description="Score from 0.0 to 100.0")
    weight_pct: float = Field(description="Weight percentage in overall score (e.g., 40.0, 15.0, 25.0)")
    weighted_points: float = Field(description="Points contributed to overall score (score * weight / 100)")
    feedback: str


class FixIssueItem(BaseModel):
    id: str
    category: Literal["metric", "action_verb", "missing_skill", "formatting", "section"]
    impact: Literal["high", "medium", "low"]
    title: str = Field(description="Short human-friendly summary, e.g. 'Add a metric to this bullet'")
    original_text: str = Field(description="The original sentence or skill name in question")
    section: str = Field(description="Section where the issue occurs, e.g. 'Experience', 'Skills'")
    suggested_action: str = Field(description="Actionable guidance on how to fix")
    potential_points: float = Field(description="Estimated point gain upon fixing")


class ATSScoreBreakdown(BaseModel):
    overall_score: int = Field(description="Weighted total score from 0 to 100")
    jd_provided: bool = Field(description="True if evaluation was calibrated against a target JD")
    redistribution_note: Optional[str] = Field(
        default=None,
        description="Note explaining weight redistribution when no job description is provided",
    )
    factors: Dict[str, FactorScore]
    skills_analysis: List[SkillEvidenceItem] = Field(default_factory=list)
    matched_skills_count: int = 0
    partial_skills_count: int = 0
    missing_skills_count: int = 0
    issues_list: List[FixIssueItem] = Field(
        default_factory=list, description="Ordered fix list ranked by impact"
    )


class EvaluateResumeRequest(BaseModel):
    canonical_resume: dict
    job_description: Optional[str] = ""
    target_role: Optional[str] = "Full Stack Developer"

