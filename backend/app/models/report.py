from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from app.models.session import AnswerScores


class DimensionScore(BaseModel):
    """Represents candidate score vs industry standard benchmark for one rubric dimension."""
    dimension: str = Field(..., description="e.g. Relevance, Technical Accuracy, Clarity, Depth, Confidence")
    score: float = Field(..., ge=0, le=10, description="Candidate score out of 10")
    benchmark: float = Field(7.5, description="Target industry benchmark score (default 7.5/10)")
    percentage: int = Field(..., description="Score expressed as percentage (0-100)")


class QuestionBreakdownItem(BaseModel):
    """Deep-dive breakdown of a specific question from the interview session."""
    question_index: int
    question_text: str
    question_category: str
    difficulty: str
    candidate_answer: str
    scores: AnswerScores
    average_score: float
    feedback: str
    strengths: List[str]
    areas_for_improvement: List[str]
    ideal_answer_summary: str


class RoadmapMilestone(BaseModel):
    """A personalized learning milestone targeting weaknesses from the mock interview."""
    milestone_id: str
    step_number: int
    title: str
    target_skill: str
    difficulty: Literal["Beginner", "Intermediate", "Advanced"]
    estimated_days: int
    actionable_tasks: List[str]
    recommended_resources: List[str]
    capstone_mini_project: str


class PersonalizedRoadmap(BaseModel):
    """Algorithmic career progression roadmap generated to resolve identified gaps."""
    roadmap_id: str
    user_id: str
    target_role: str
    identified_weak_areas: List[str]
    milestones: List[RoadmapMilestone]
    estimated_total_weeks: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InterviewReport(BaseModel):
    """Comprehensive performance evaluation report for a completed mock interview."""
    report_id: str
    session_id: str
    user_id: str
    target_role: str
    overall_score: float
    verdict: Literal["Strong Hire", "Hire", "Leaning Hire", "Needs Revision"]
    executive_summary: str
    dimension_scores: List[DimensionScore]
    category_scores: Dict[str, float]
    top_strengths: List[str]
    priority_improvements: List[str]
    questions_breakdown: List[QuestionBreakdownItem]
    roadmap: Optional[PersonalizedRoadmap] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DashboardMetrics(BaseModel):
    """Aggregate analytics for candidate dashboard."""
    user_id: str
    total_interviews_completed: int
    average_interview_score: float
    highest_interview_score: float
    readiness_level: str
    latest_ats_score: Optional[int] = None
    recent_sessions: List[Dict[str, Any]] = Field(default_factory=list)
    score_trend: List[Dict[str, Any]] = Field(default_factory=list)
    dimension_averages: List[DimensionScore] = Field(default_factory=list)

