"""Upload router handling multipart file uploads, parsing, and session creation."""

from pathlib import Path
import uuid
import shutil
import logging
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.session_store import session_store
from app.models.extraction import ExtractedData
from app.services.file_parser import parse_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["Upload"])


class UploadResponse(BaseModel):
    session_id: str = Field(..., description="Unique session ID for this document package")
    files_uploaded: List[str] = Field(..., description="Names of uploaded files")
    extraction_summary: dict = Field(..., description="Summary of parsed content (blocks, tables, images)")


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_files(
    files: List[UploadFile] = File(..., description="Packaging files (PDF dielines, Excel specs, Word briefs, images)"),
    session_id: Optional[str] = Form(None, description="Existing session ID if appending to an active session"),
) -> UploadResponse:
    """Accepts multiple packaging files, saves them, parses each using PyMuPDF / openpyxl / docx,

    and aggregates the extracted data into the session store.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file must be uploaded.",
        )

    # Resolve or create session ID
    curr_session_id = session_id or uuid.uuid4().hex[:12]
    session_dir = settings.UPLOAD_DIR / curr_session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    # Retrieve existing or initialize new ExtractedData
    extracted = session_store.get_extracted_data(curr_session_id) or ExtractedData(session_id=curr_session_id)

    uploaded_filenames: List[str] = []

    for file in files:
        filename = file.filename or "unknown_file"
        ext = Path(filename).suffix.lower().lstrip(".")

        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '.{ext}' for file '{filename}' is not permitted. "
                f"Allowed formats: {', '.join(sorted(settings.ALLOWED_EXTENSIONS))}",
            )

        # Save to disk
        file_save_path = session_dir / filename
        try:
            with open(file_save_path, "wb") as f_out:
                shutil.copyfileobj(file.file, f_out)
        except Exception as e:
            logger.error(f"Failed to write uploaded file {filename}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not save file '{filename}'.",
            )
        finally:
            await file.close()

        # Parse file
        parsed_data = parse_file(file_save_path, filename, curr_session_id, settings.UPLOAD_DIR)

        # Aggregate texts, images, tables
        extracted.texts.extend(parsed_data.texts)
        extracted.images.extend(parsed_data.images)
        extracted.tables.extend(parsed_data.tables)

        # Update metadata
        file_info = {
            "filename": filename,
            "path": str(file_save_path),
            "size": file_save_path.stat().st_size,
            "extension": ext,
            "page_count": parsed_data.metadata.get("page_count", 1),
        }
        extracted.metadata[filename] = file_info
        session_store.add_uploaded_file(curr_session_id, file_info)
        uploaded_filenames.append(filename)

    # Persist in session store
    session_store.set_extracted_data(curr_session_id, extracted)

    return UploadResponse(
        session_id=curr_session_id,
        files_uploaded=uploaded_filenames,
        extraction_summary={
            "text_blocks_count": len(extracted.texts),
            "images_count": len(extracted.images),
            "tables_count": len(extracted.tables),
            "files_count": len(uploaded_filenames),
        },
    )
