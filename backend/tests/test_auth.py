import pytest
from unittest.mock import patch
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import connect_to_mongo, close_mongo_connection, db_manager
from app.config import settings


@pytest.mark.asyncio
async def test_protected_endpoint_rejects_missing_token():
    """Verify that requests without Authorization header are rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/auth/protected-test")
        assert response.status_code == 401
        assert "Missing Authorization header" in response.json()["detail"]


@pytest.mark.asyncio
async def test_protected_endpoint_rejects_invalid_token():
    """Verify that requests with an invalid Bearer token are rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/auth/protected-test",
            headers={"Authorization": "Bearer totally_fake_and_invalid_token_xyz"}
        )
        assert response.status_code == 401
        assert "Invalid authentication token" in response.json()["detail"] or "Unable to verify" in response.json()["detail"]


@pytest.mark.asyncio
async def test_protected_endpoint_accepts_valid_token_and_syncs_db():
    """Verify that a valid verified token is accepted and syncs candidate into MongoDB Atlas."""
    if not settings.MONGODB_URI:
        pytest.skip("MONGODB_URI not set. Skipping DB sync test.")

    await connect_to_mongo()

    fake_decoded_token = {
        "uid": "test_vtu_candidate_12345",
        "email": "shreya.test@vtu.ac.in",
        "name": "Shreya Test",
        "picture": "https://example.com/avatar.png"
    }

    # Patch firebase_admin.auth.verify_id_token
    with patch("firebase_admin.auth.verify_id_token", return_value=fake_decoded_token):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer mock_valid_token"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["user"]["firebase_uid"] == "test_vtu_candidate_12345"
            assert data["user"]["email"] == "shreya.test@vtu.ac.in"
            assert data["user"]["display_name"] == "Shreya Test"

            # Check that user exists in MongoDB Atlas
            db = db_manager.db
            assert db is not None
            user_doc = await db.users.find_one({"firebase_uid": "test_vtu_candidate_12345"})
            assert user_doc is not None
            assert user_doc["email"] == "shreya.test@vtu.ac.in"

            # Clean up test user
            await db.users.delete_one({"firebase_uid": "test_vtu_candidate_12345"})

    await close_mongo_connection()


@pytest.mark.asyncio
async def test_user_profile_endpoint():
    """Verify /api/v1/auth/profile returns user profile details and session count."""
    fake_decoded_token = {
        "uid": "test_profile_user_999",
        "email": "profile.candidate@vtu.ac.in",
        "name": "Candidate Profile Test",
        "picture": "https://example.com/photo.jpg",
    }
    with patch("firebase_admin.auth.verify_id_token", return_value=fake_decoded_token):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/auth/profile",
                headers={"Authorization": "Bearer mock_valid_token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["firebase_uid"] == "test_profile_user_999"
            assert data["email"] == "profile.candidate@vtu.ac.in"
            assert "total_sessions" in data

