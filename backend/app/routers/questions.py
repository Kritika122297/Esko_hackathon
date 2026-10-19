"""Questions router generating smart follow-ups and accepting user resolutions."""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.session_store import session_store
from app.models.brief import PackagingBrief
from app.models.issues import ValidationResult
from app.services.ai_engine import ai_engine
from app.services.checker import run_all_checks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/questions", tags=["Questions"])


class QuestionItem(BaseModel):
    id: str
    field_name: str
    priority: str
    question: str
    context: str
    suggested_options: List[Dict[str, str]]
    default_value: Optional[str] = None


class AnswerSubmission(BaseModel):
    field_name: str = Field(..., description="Target field key, e.g. 'net_weight'")
    answer_value: Any = Field(..., description="Chosen option or custom user override value")
    question_id: Optional[str] = Field(None, description="Corresponding question ID")


class SubmitAnswersRequest(BaseModel):
    answers: List[AnswerSubmission] = Field(..., description="List of submitted answers")


class QuestionsResponse(BaseModel):
    session_id: str
    questions: List[Dict[str, Any]]


class UpdateBriefResponse(BaseModel):
    session_id: str
    message: str
    brief: PackagingBrief
    validation: ValidationResult


@router.get("/{session_id}", response_model=QuestionsResponse)
async def get_questions(session_id: str) -> QuestionsResponse:
    """Generates smart follow-up questions targeting missing or conflicting fields."""
    brief = session_store.get_brief(session_id)
    if not brief:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brief for session '{session_id}' not found. Run analysis first.",
        )

    questions = ai_engine.generate_questions(brief)
    return QuestionsResponse(
        session_id=session_id,
        questions=questions,
    )


@router.post("/{session_id}", response_model=UpdateBriefResponse)
async def submit_answers(session_id: str, payload: SubmitAnswersRequest) -> UpdateBriefResponse:
    """Accepts user answers, applies field overrides, clears corresponding issues,

    and re-runs validation checks.
    """
    brief = session_store.get_brief(session_id)
    if not brief:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brief for session '{session_id}' not found.",
        )

    extracted_data = session_store.get_extracted_data(session_id)

    # Apply answers to fields
    for ans in payload.answers:
        field = brief.get_field(ans.field_name)
        if field:
            field.user_override = ans.answer_value
            field.status = "confirmed"
            # Clear resolved issues from this field
            field.issues = []

    # Update modification timestamp
    brief.updated_at = datetime.now(timezone.utc).isoformat()

    # Re-run deterministic checks
    validation = run_all_checks(brief, extracted_data)
    brief.issues_summary = validation.summary

    # Save to session store
    session_store.set_brief(session_id, brief)
    session_store.set_validation(session_id, validation)

    return UpdateBriefResponse(
        session_id=session_id,
        message="Answers applied and brief re-validated successfully.",
        brief=brief,
        validation=validation,
    )
