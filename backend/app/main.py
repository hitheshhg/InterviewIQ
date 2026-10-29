import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.dependencies import init_firebase_admin
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.routes import health, auth, gemini_test, resume, interview, report

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("interviewiq")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    logger.info(f"[InterviewIQ] Server starting in {settings.ENVIRONMENT} mode on port {settings.PORT}...")
    try:
        await connect_to_mongo()
    except Exception as e:
        logger.error(f"[InterviewIQ] Database initialization failed on startup: {e}")
    
    try:
        init_firebase_admin()
    except Exception as e:
        logger.error(f"[InterviewIQ] Firebase initialization failed on startup: {e}")

    yield
    
    # Shutdown tasks
    logger.info("[InterviewIQ] Server shutting down...")
    await close_mongo_connection()


app = FastAPI(
    title="InterviewIQ API",
    description="Backend API for InterviewIQ - AI Interview Preparation & Resume Analysis Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate Limiting configuration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(gemini_test.router)
app.include_router(resume.router)
app.include_router(interview.router)
app.include_router(report.router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to the InterviewIQ API",
        "docs": "/docs",
        "health": "/health"
    }
