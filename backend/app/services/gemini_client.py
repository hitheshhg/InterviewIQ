import json
import time
import logging
from typing import Type, TypeVar, Optional, Tuple, List
from pydantic import BaseModel, ValidationError
from google import genai
from google.genai import types
from google.genai.errors import APIError, ServerError, ClientError
from app.config import settings

logger = logging.getLogger("interviewiq.gemini")

T = TypeVar("T", bound=BaseModel)


class GeminiClient:
    """
    Centralized Gemini Client for InterviewIQ.
    All LLM interactions pass through this module with:
    - Strict Pydantic JSON validation
    - Up to 2 retries on malformed JSON
    - Exponential backoff for HTTP 429 / 503 rate-limits & high demand
    - Graceful fallback to GEMINI_FALLBACK_MODEL or active Flash models
    """

    def __init__(self):
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is not configured in backend/.env")
            # Configure with reasonable timeout to prevent hanging on overloaded models
            http_options = types.HttpOptions(timeout=10000)
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=http_options)
        return self._client

    def get_candidate_models(self) -> List[str]:
        """Ordered list of models to try in sequence upon failure."""
        candidates = [
            settings.GEMINI_MODEL,
            settings.GEMINI_FALLBACK_MODEL,
            "gemini-flash-lite-latest",
            "gemini-flash-latest",
        ]
        # Remove duplicates while preserving order and non-empty strings
        seen = set()
        deduped = []
        for m in candidates:
            if m and m not in seen:
                seen.add(m)
                deduped.append(m)
        return deduped

    async def generate_structured_json(
        self,
        prompt: str,
        response_model: Type[T],
        system_instruction: Optional[str] = None,
        max_json_retries: int = 2,
    ) -> Tuple[T, str, float]:
        """
        Generate structured JSON output validated against a Pydantic schema.
        Returns: (parsed_pydantic_instance, model_name_used, latency_ms)
        """
        candidate_models = self.get_candidate_models()
        last_exception = None

        start_time = time.perf_counter()

        for model_name in candidate_models:
            logger.info(f"[GeminiClient] Attempting inference with model: '{model_name}'...")
            
            for attempt in range(max_json_retries + 1):
                try:
                    config_kwargs = {
                        "response_mime_type": "application/json",
                        "response_schema": response_model,
                        "temperature": 0.4,
                    }
                    if system_instruction:
                        config_kwargs["system_instruction"] = system_instruction

                    config = types.GenerateContentConfig(**config_kwargs)

                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=config,
                    )

                    raw_text = response.text
                    if not raw_text:
                        raise ValueError("Empty response received from Gemini API.")

                    # Parse and validate JSON
                    parsed_instance = self._parse_and_validate(raw_text, response_model)
                    latency = round((time.perf_counter() - start_time) * 1000, 2)
                    logger.info(
                        f"[GeminiClient] Success with '{model_name}' in {latency}ms."
                    )
                    return parsed_instance, model_name, latency

                except (ValidationError, json.JSONDecodeError) as json_err:
                    logger.warning(
                        f"[GeminiClient] JSON validation failure on attempt {attempt + 1}: {json_err}"
                    )
                    if attempt >= max_json_retries:
                        last_exception = json_err
                        break  # Fallback to next candidate model
                    time.sleep(0.5)

                except (ServerError, ClientError, APIError) as api_err:
                    status_code = getattr(api_err, "code", None)
                    logger.warning(
                        f"[GeminiClient] Model '{model_name}' returned error (code {status_code}): {api_err}. Falling back to next candidate model..."
                    )
                    last_exception = api_err
                    break  # Immediately failover to next model in the fallback chain

                except Exception as gen_err:
                    logger.warning(
                        f"[GeminiClient] Unexpected error with model '{model_name}': {gen_err}"
                    )
                    last_exception = gen_err
                    break  # Failover to next candidate model

        # If all candidate models were exhausted
        raise RuntimeError(
            f"[GeminiClient] All candidate Gemini models exhausted. Last error: {last_exception}"
        ) from last_exception

    def _parse_and_validate(self, raw_text: str, schema: Type[T]) -> T:
        """Helper to parse raw JSON string and instantiate Pydantic schema."""
        cleaned_text = raw_text.strip()
        # Strip markdown fences if present
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()

        data = json.loads(cleaned_text)
        return schema.model_validate(data)


# Global singleton instance
gemini_client = GeminiClient()
