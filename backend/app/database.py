import logging
import time
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger("interviewiq.database")

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

db_manager = Database()


async def connect_to_mongo():
    """Establish async connection to MongoDB Atlas and ensure indexes exist."""
    if not settings.MONGODB_URI:
        logger.warning("[Database] MONGODB_URI is not set. Skipping DB connection.")
        return

    try:
        logger.info("[Database] Connecting to MongoDB Atlas...")
        db_manager.client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=5000,
        )
        db_manager.db = db_manager.client[settings.MONGODB_DB_NAME]

        # Verify connectivity via ping
        await db_manager.client.admin.command("ping")
        logger.info(f"[Database] Successfully connected to database: '{settings.MONGODB_DB_NAME}'")

        # Initialize collections & indexes
        await init_db_indexes()
    except Exception as e:
        logger.error(f"[Database] Failed to connect to MongoDB Atlas: {str(e)}")
        raise e


async def close_mongo_connection():
    """Close the MongoDB connection pool."""
    if db_manager.client:
        logger.info("[Database] Closing MongoDB connection pool...")
        db_manager.client.close()
        db_manager.client = None
        db_manager.db = None
        logger.info("[Database] MongoDB connection closed.")


async def init_db_indexes():
    """Create optimal indexes for all 5 core collections."""
    if db_manager.db is None:
        return

    logger.info("[Database] Creating database indexes...")

    # 1. users collection: unique firebase_uid, index on email
    await db_manager.db.users.create_index("firebase_uid", unique=True)
    await db_manager.db.users.create_index("email")

    # 2. resumes collection: index on user_id, index on created_at
    await db_manager.db.resumes.create_index("user_id")
    await db_manager.db.resumes.create_index([("created_at", -1)])

    # 3. sessions collection: unique session_id, index on user_id
    await db_manager.db.sessions.create_index("session_id", unique=True)
    await db_manager.db.sessions.create_index("user_id")
    await db_manager.db.sessions.create_index([("created_at", -1)])

    # 4. answers collection: index on session_id, compound on (session_id, question_index)
    await db_manager.db.answers.create_index("session_id")
    await db_manager.db.answers.create_index([("session_id", 1), ("question_index", 1)], unique=True)

    # 5. reports collection: unique session_id, index on user_id
    await db_manager.db.reports.create_index("session_id", unique=True)
    await db_manager.db.reports.create_index("user_id")
    await db_manager.db.reports.create_index([("created_at", -1)])

    # 6. resume_versions collection: unique id, compound on (user_id, created_at)
    await db_manager.db.resume_versions.create_index("id", unique=True)
    await db_manager.db.resume_versions.create_index([("user_id", 1), ("created_at", -1)])

    logger.info("[Database] Database indexes created successfully.")


async def check_db_health() -> Dict[str, Any]:
    """Check database health and measure roundtrip ping latency."""
    if not settings.MONGODB_URI:
        return {"status": "unconfigured", "latency_ms": None}

    if db_manager.client is None:
        return {"status": "disconnected", "latency_ms": None}

    try:
        start = time.perf_counter()
        await db_manager.client.admin.command("ping")
        latency = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "healthy", "latency_ms": latency}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e), "latency_ms": None}


def get_db() -> AsyncIOMotorDatabase:
    """Dependency helper to get active database instance."""
    if db_manager.db is None:
        raise RuntimeError("Database is not connected.")
    return db_manager.db
