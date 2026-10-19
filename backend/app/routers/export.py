"""Export router generating downloadable DOCX / PDF briefs and JSON preview."""

from pathlib import Path
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.session_store import session_store
from app.services.brief_exporter import export_to_docx, export_to_pdf
from app.models.brief import PackagingBrief

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["Export"])


class ExportRequest(BaseModel):
    format: str = Field("docx", description="'docx' | 'pdf'")


@router.get("/{session_id}/preview", response_model=PackagingBrief)
async def preview_brief(session_id: str) -> PackagingBrief:
    """Returns the finalized PackagingBrief as structured JSON for client-side preview."""
    brief = session_store.get_brief(session_id)
    if not brief:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brief for session '{session_id}' not found.",
        )
    return brief


@router.post("/{session_id}")
async def export_brief_file(
    session_id: str,
    format: str = Query("docx", description="'docx' or 'pdf'"),
    payload: Optional[ExportRequest] = None,
):
    """Generates and downloads the final formatted Packaging Brief as either DOCX or PDF."""
    brief = session_store.get_brief(session_id)
    if not brief:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brief for session '{session_id}' not found.",
        )

    # Determine desired export format
    fmt = (payload.format if payload and payload.format else format).lower().strip()

    safe_name = "".join([c if c.isalnum() or c in ("-", "_") else "_" for c in brief.product_name]).strip("_")
    if not safe_name:
        safe_name = "Packaging_Brief"

    try:
        if fmt == "docx":
            file_path = export_to_docx(brief)
            download_name = f"{safe_name}_Brief.docx"
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif fmt == "pdf":
            file_path = export_to_pdf(brief)
            download_name = f"{safe_name}_Brief.pdf"
            media_type = "application/pdf"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format '{fmt}'. Supported formats are 'docx' and 'pdf'.",
            )

        if not Path(file_path).exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Export file could not be generated.",
            )

        return FileResponse(
            path=file_path,
            filename=download_name,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
        )
    except Exception as e:
        logger.error(f"Failed to generate brief export for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting brief: {str(e)}",
        )
