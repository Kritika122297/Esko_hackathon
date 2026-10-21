"""Designer brief preview and file exports."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.config import settings
from app.routers.common import load
from app.services.ai_summary import summarize
from app.services.brief_exporter import export_docx, export_pdf
from app.services.designer import DesignerBrief, build_designer_brief

router = APIRouter(prefix="/sessions", tags=["Export"])

MEDIA = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
}


@router.get("/{sid}/designer-brief", response_model=DesignerBrief)
def designer_brief(sid: str) -> DesignerBrief:
    state, _, ex = load(sid)
    return build_designer_brief(state, ex)


@router.get("/{sid}/export/{fmt}")
def export(sid: str, fmt: Literal["docx", "pdf"]) -> FileResponse:
    state, _, ex = load(sid)
    brief = build_designer_brief(state, ex)
    brief.ai = summarize(sid, state.updated_at, brief)  # None without a provider; the export works either way
    safe = re.sub(r"[^A-Za-z0-9]+", "_", state.product_name).strip("_") or "Packaging"
    suffix = "" if state.status == "finalized" else "_DRAFT"
    name = f"{safe}_Design_Brief{suffix}.{fmt}"
    path = settings.EXPORT_DIR / f"{sid}_{name}"
    (export_docx if fmt == "docx" else export_pdf)(brief, path)
    return FileResponse(path, media_type=MEDIA[fmt], filename=name)
