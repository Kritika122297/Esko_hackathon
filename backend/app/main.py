"""BriefForge API: AI reads and suggests. Code checks. Humans decide."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chat_router, export_router, pack_router, review_router, sessions_router, standards_router
from app.services.ocr import ocr_status
from app.services.llm import ROLES, get_llm, llm

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for r in (standards_router, sessions_router, review_router, export_router, chat_router, pack_router):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["Health"])
def health() -> dict:
    return {
        "status": "ok",
        "version": settings.VERSION,
        "ai": {"provider": llm.provider, "model": llm.model or None, "enabled": llm.enabled,
               "roles": {r: {"provider": get_llm(r).provider, "model": get_llm(r).model or None,
                             "enabled": get_llm(r).enabled} for r in ROLES}},
        "ocr": ocr_status(),
    }
