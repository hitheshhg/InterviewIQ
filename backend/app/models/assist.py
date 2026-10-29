from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class AIAssistRequest(BaseModel):
    text: str = Field(..., min_length=3, description="Original bullet point or summary text to enhance")
    action: Literal["improve", "add_impact", "shorten"] = Field(
        default="improve",
        description="Enhancement action: 'improve' (stronger verbs/clarity), 'add_impact' (metrics/outcome structure), 'shorten' (concise < 22 words)"
    )
    context_role: Optional[str] = Field(default="", description="Role or position title")
    context_company: Optional[str] = Field(default="", description="Company or organization name")
    candidate_skills: Optional[List[str]] = Field(default_factory=list, description="Verified candidate skills from resume catalog")


class AIAssistOption(BaseModel):
    text: str = Field(..., description="The rewritten bullet or summary option")
    diff_summary: str = Field(..., description="Concise explanation of the key enhancements made")
    has_new_claims: bool = Field(default=False, description="Flagged TRUE if rewrite contains unverified numbers or skills")
    unverified_tokens: List[str] = Field(default_factory=list, description="List of unverified numbers, metrics, or technologies detected")
    explanation: str = Field(default="", description="Brief guidance on why this phrasing resonates with ATS and recruiters")


class AIAssistResponse(BaseModel):
    original_text: str
    action: str
    options: List[AIAssistOption]
