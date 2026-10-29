import logging
from fastapi import Request
from starlette.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger("interviewiq.rate_limit")


def get_client_identifier(request: Request) -> str:
    """
    Extract rate limiting key: prefers user ID from auth header,
    falls back to real client IP (handling reverse proxies like Cloudflare/Vercel).
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use token slice as identifier for authenticated users
        return f"user:{auth_header[-24:]}"

    # Fallback to forwarded IP headers
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"

    return f"ip:{get_remote_address(request) or '127.0.0.1'}"


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Friendly user-facing response when per-user AI rate limits are exceeded.
    """
    logger.warning(f"[RateLimit] AI quota exceeded for request to {request.url.path}")
    return JSONResponse(
        status_code=429,
        content={
            "detail": "AI usage limit reached. Please wait a moment before trying again.",
            "error": "rate_limit_exceeded",
        },
    )


# Initialize central limiter with sensible defaults
limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=["120/minute"],
    headers_enabled=False,
)

