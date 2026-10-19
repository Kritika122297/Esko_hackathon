"""BriefForge FastAPI Application.

AI packaging brief assistant transforming messy product specs,
artwork dielines, and formulations into structured design briefs.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import (
    upload_router,
    analyze_router,
    questions_router,
    review_router,
    export_router,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("briefforge")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown tasks."""
    logger.info("Initializing BriefForge storage directories...")
    settings.ensure_directories()
    logger.info(f"Upload directory: {settings.UPLOAD_DIR}")
    logger.info(f"Export directory: {settings.EXPORT_DIR}")
    logger.info("BriefForge backend successfully initialized.")
    yield
    logger.info("BriefForge backend shutting down.")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api
app.include_router(upload_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")
app.include_router(questions_router, prefix="/api")
app.include_router(review_router, prefix="/api")
app.include_router(export_router, prefix="/api")


@app.get("/", tags=["Health"])
async def root() -> JSONResponse:
    """Root landing endpoint with system status."""
    return JSONResponse(
        content={
            "app": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "online",
            "docs_url": "/api/docs",
        }
    )


@app.get("/api/health", tags=["Health"])
async def health_check() -> JSONResponse:
    """Health check endpoint verifying API and storage status."""
    return JSONResponse(
        content={
            "status": "healthy",
            "gemini_api_configured": bool(settings.GEMINI_API_KEY),
            "upload_dir_exists": settings.UPLOAD_DIR.exists(),
            "export_dir_exists": settings.EXPORT_DIR.exists(),
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
