from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.routes import health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    print(f"[InterviewIQ] Server starting in {settings.ENVIRONMENT} mode on port {settings.PORT}...")
    yield
    # Shutdown tasks
    print("[InterviewIQ] Server shutting down...")


app = FastAPI(
    title="InterviewIQ API",
    description="Backend API for InterviewIQ - AI Interview Preparation & Resume Analysis Platform",
    version="1.0.0",
    lifespan=lifespan,
)

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


@app.get("/")
async def root():
    return {
        "message": "Welcome to the InterviewIQ API",
        "docs": "/docs",
        "health": "/health"
    }
