import logging
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

logger = logging.getLogger("interviewiq.rate_limit")


def get_client_identifier(request: Request) -> str:
    """
    Extract rate limiting key: prefers user ID from auth header,
    falls back to real client IP (handling reverse proxies like Cloudflare/Vercel).
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use token slice as identifier for authenticated users
        return auth_header[-16:]

    # Fallback to forwarded IP headers
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    return get_remote_address(request) or "127.0.0.1"


# Initialize central limiter with sensible defaults
limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=["120/minute"],
    headers_enabled=False,
)
