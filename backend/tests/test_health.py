import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_check_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["app_name"] == "InterviewIQ API"
        assert "timestamp" in data
        assert data["services"]["api"] == "healthy"
        assert "database" in data["services"]


@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "InterviewIQ API" in data["message"]
        assert data["health"] == "/health"


@pytest.mark.asyncio
async def test_custom_rate_limit_handler_format():
    """Verify that rate limit exceeded returns friendly user-facing error message."""
    from slowapi.errors import RateLimitExceeded
    from app.middleware.rate_limit import rate_limit_exceeded_handler
    from starlette.requests import Request
    import json

    scope = {"type": "http", "method": "GET", "path": "/api/v1/interview/start", "headers": []}
    req = Request(scope)
    mock_limit = type("MockLimit", (), {"error_message": None, "limit": "10/minute"})()
    exc = RateLimitExceeded(mock_limit)
    res = await rate_limit_exceeded_handler(req, exc)
    assert res.status_code == 429
    body = json.loads(res.body.decode())
    assert "AI usage limit reached" in body["detail"]
    assert body["error"] == "rate_limit_exceeded"

