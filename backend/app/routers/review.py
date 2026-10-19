"""Review router providing endpoints to inspect and edit brief fields."""

import logging
from typing import List, Optional, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.session_store import session_store
from app.models.brief import PackagingBrief
from app.models.issues import ValidationResult
from app.services.checker import run_all_checks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/brief", tags=["Brief Review"])


class FieldUpdateItem(BaseModel):
    field_name: str = Field(..., description="Field key identifier")
    value: Any = Field(..., description="New field value or user override")
    status: Optional[str] = Field("confirmed", description="'confirmed' | 'flagged' | 'missing' | 'conflicting'")


class BriefUpdateRequest(BaseModel):
    product_name: Optional[str] = None
    status: Optional[str] = Field(None, description="'draft' | 'in_review' | 'finalized'")
    fields: Optional[List[FieldUpdateItem]] = None
    full_brief: Optional[PackagingBrief] = None


class BriefResponse(BaseModel):
    session_id: str
    brief: PackagingBrief
    validation: Optional[ValidationResult] = None


@router.get("/{session_id}", response_model=BriefResponse)
async def get_brief(session_id: str) -> BriefResponse:
    """Returns current state of the PackagingBrief and latest validation results."""
    brief = session_store.get_brief(session_id)
    if not brief:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brief for session '{session_id}' not found.",
        )

    validation = session_store.get_validation(session_id)
    return BriefResponse(
        session_id=session_id,
        brief=brief,
        validation=validation,
    )


@router.put("/{session_id}", response_model=BriefResponse)
async def update_brief(session_id: str, payload: BriefUpdateRequest) -> BriefResponse:
    """Accepts field-level edits or full brief updates from the user,

    re-executes validation checks, and persists updated state.
    """
    existing_brief = session_store.get_brief(session_id)
    if not existing_brief:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brief for session '{session_id}' not found.",
        )

    extracted_data = session_store.get_extracted_data(session_id)

    # 1. Full Brief Replacement if provided
    if payload.full_brief:
        brief = payload.full_brief
        brief.session_id = session_id
        brief.updated_at = datetime.now(timezone.utc).isoformat()
    else:
        brief = existing_brief
        if payload.product_name:
            brief.product_name = payload.product_name
        if payload.status:
            brief.status = payload.status

        # 2. Field-level updates
        if payload.fields:
            for item in payload.fields:
                field = brief.get_field(item.field_name)
                if field:
                    field.user_override = item.value
                    if item.status:
                        field.status = item.status
                    field.issues = []  # Clear resolved issues on explicit edit

        brief.updated_at = datetime.now(timezone.utc).isoformat()

    # Re-run deterministic checks
    validation = run_all_checks(brief, extracted_data)
    brief.issues_summary = validation.summary

    # Update session store
    session_store.set_brief(session_id, brief)
    session_store.set_validation(session_id, validation)

    return BriefResponse(
        session_id=session_id,
        brief=brief,
        validation=validation,
    )
