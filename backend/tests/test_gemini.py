import pytest
from pydantic import BaseModel, Field
from typing import List
from app.services.gemini_client import gemini_client
from app.config import settings


class SampleGreetingSchema(BaseModel):
    message: str = Field(description="Greeting message")
    number: int = Field(description="An integer between 1 and 100")
    tags: List[str] = Field(description="List of 2 relevant keywords")


@pytest.mark.asyncio
async def test_live_gemini_structured_json():
    """Verify live Gemini API call generates valid structured JSON conforming to schema."""
    if not settings.GEMINI_API_KEY:
        pytest.skip("GEMINI_API_KEY is not set. Skipping live Gemini test.")

    prompt = "Generate a welcome greeting with a lucky number and two tags related to computer science."
    
    result, model_used, latency = await gemini_client.generate_structured_json(
        prompt=prompt,
        response_model=SampleGreetingSchema,
        system_instruction="You are a JSON generator."
    )

    assert isinstance(result, SampleGreetingSchema)
    assert result.message
    assert isinstance(result.number, int)
    assert len(result.tags) > 0
    assert model_used
    assert latency > 0
    print(f"\n[Gemini Test] Used model: {model_used} | Latency: {latency}ms")
    print(f"[Gemini Output] {result.model_dump()}")


def test_markdown_json_cleaning():
    """Verify that JSON wrapped in markdown code fences is cleaned and parsed properly."""
    raw = """```json
    {
        "message": "Hello from markdown",
        "number": 42,
        "tags": ["python", "ai"]
    }
    ```"""
    parsed = gemini_client._parse_and_validate(raw, SampleGreetingSchema)
    assert parsed.message == "Hello from markdown"
    assert parsed.number == 42
    assert parsed.tags == ["python", "ai"]
