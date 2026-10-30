from typing import List, Optional
from pydantic import BaseModel, Field


class BulletRewriteOption(BaseModel):
    """A single suggested rewrite for a resume bullet point."""
    rewrite_id: str = Field(description="Unique identifier for this rewrite option")
    text: str = Field(description="Rewritten bullet text using strong action verbs and STAR / Google X-Y-Z formula")
    needs_fill_in: bool = Field(
        default=False,
        description="True if the candidate must type a real metric/number to complete the rewrite",
    )
    fill_in_prompts: List[str] = Field(
        default_factory=list,
        description="List of placeholders requiring candidate inputs, e.g. ['metric: latency reduction %']",
    )
    rationale: str = Field(
        default="",
        description="Brief explanation of why this rewrite improves ATS score and impact",
    )


class SuggestBulletRewritesRequest(BaseModel):
    """Request to generate truthful AI rewrites for a resume line/bullet."""
    bullet_text: str = Field(..., min_length=3, description="Original bullet text or sentence to rewrite")
    category: str = Field(
        default="metric",
        description="Issue category: 'metric', 'action_verb', 'general', or 'formatting'",
    )
    context_role: Optional[str] = Field(
        default=None,
        description="Candidate's job role or project title for this bullet",
    )
    context_company: Optional[str] = Field(
        default=None,
        description="Company or project name associated with this bullet",
    )
    target_role: Optional[str] = Field(
        default="Full Stack Developer",
        description="Target job title the candidate is aiming for",
    )
    job_description: Optional[str] = Field(
        default=None,
        description="Target job description for alignment",
    )


class SuggestBulletRewritesResponse(BaseModel):
    """Structured response containing up to 3 truthful rewrites."""
    original_text: str
    category: str
    suggestions: List[BulletRewriteOption] = Field(
        default_factory=list,
        description="Up to 3 high-impact rewrite suggestions adhering to the Truth Rule",
    )
    truth_check_passed: bool = Field(
        default=True,
        description="Verified that no ungrounded numbers, technologies, or facts were hallucinated",
    )
    evidence_notes: List[str] = Field(
        default_factory=list,
        description="Validation notes regarding truthfulness and fill-in placeholders",
    )


class GeminiRewriteEnvelope(BaseModel):
    """Structured schema for Gemini JSON output generation."""
    suggestions: List[BulletRewriteOption] = Field(default_factory=list)
