import pytest
from app.database import connect_to_mongo, close_mongo_connection, check_db_health, db_manager, init_db_indexes
from app.config import settings


@pytest.mark.asyncio
async def test_mongo_connection_and_health():
    """Verify MongoDB Atlas connection, ping, and latency metric."""
    if not settings.MONGODB_URI:
        pytest.skip("MONGODB_URI is not set. Skipping live DB test.")

    # Connect
    await connect_to_mongo()
    assert db_manager.client is not None, "MongoDB client was not initialized"
    assert db_manager.db is not None, "MongoDB database was not initialized"

    # Health check
    health = await check_db_health()
    assert health["status"] == "healthy", f"DB health check failed: {health}"
    assert health["latency_ms"] is not None
    assert health["latency_ms"] > 0
    print(f"\n[Test Output] MongoDB Atlas ping latency: {health['latency_ms']} ms")

    # Close connection
    await close_mongo_connection()
    assert db_manager.client is None


@pytest.mark.asyncio
async def test_collections_and_indexes():
    """Verify that all 5 core collections have indexes configured."""
    if not settings.MONGODB_URI:
        pytest.skip("MONGODB_URI is not set. Skipping DB index test.")

    await connect_to_mongo()
    db = db_manager.db
    assert db is not None

    # Re-run index creation
    await init_db_indexes()

    # Check users indexes
    users_indexes = await db.users.index_information()
    assert "firebase_uid_1" in users_indexes, "Missing unique firebase_uid index"
    assert users_indexes["firebase_uid_1"].get("unique") is True
    assert "email_1" in users_indexes, "Missing email index"

    # Check resumes indexes
    resumes_indexes = await db.resumes.index_information()
    assert "user_id_1" in resumes_indexes, "Missing user_id index on resumes"

    # Check sessions indexes
    sessions_indexes = await db.sessions.index_information()
    assert "session_id_1" in sessions_indexes, "Missing session_id index on sessions"
    assert sessions_indexes["session_id_1"].get("unique") is True

    # Check answers indexes
    answers_indexes = await db.answers.index_information()
    assert "session_id_1" in answers_indexes, "Missing session_id index on answers"
    assert "session_id_1_question_index_1" in answers_indexes, "Missing compound index on answers"

    # Check reports indexes
    reports_indexes = await db.reports.index_information()
    assert "session_id_1" in reports_indexes, "Missing session_id index on reports"
    assert reports_indexes["session_id_1"].get("unique") is True

    await close_mongo_connection()
