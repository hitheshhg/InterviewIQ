from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
from app.services.gemini_client import gemini_client
from app.config import settings

router = APIRouter(prefix="/api/v1/gemini", tags=["Gemini AI Engine"])


class SampleEvaluation(BaseModel):
    summary: str = Field(description="A concise summary of the candidate's answer")
    score: int = Field(ge=1, le=10, description="Overall score out of 10")
    key_strengths: List[str] = Field(description="1-3 specific strengths noted")
    suggested_improvement: str = Field(description="One actionable improvement recommendation")


@router.get("/test")
async def gemini_diagnostic():
    """
    Diagnostic endpoint to verify Gemini connectivity, structured JSON generation,
    and automatic model fallback.
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured in backend/.env"
        )

    test_prompt = """
    Evaluate this answer for a Junior Software Engineer position:
    Question: "How do you handle asynchronous operations in Python using FastAPI?"
    Answer: "I use async def route handlers along with the motor driver for non-blocking database queries, and async context managers for connection lifecycles."
    """

    try:
        evaluation, model_used, latency = await gemini_client.generate_structured_json(
            prompt=test_prompt,
            response_model=SampleEvaluation,
            system_instruction="You are a senior technical interviewer evaluating candidate answers strictly and constructively."
        )

        return {
            "status": "healthy",
            "model_configured": settings.GEMINI_MODEL,
            "fallback_configured": settings.GEMINI_FALLBACK_MODEL,
            "model_used": model_used,
            "latency_ms": latency,
            "evaluation": evaluation.model_dump()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini generation failed: {str(e)}"
        )
