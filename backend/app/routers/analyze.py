"""Analyze router handling AI synthesis, brief generation, and validation checks."""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.session_store import session_store
from app.models.brief import PackagingBrief
from app.models.issues import ValidationResult
from app.services.ai_engine import ai_engine
from app.services.brief_builder import build_brief
from app.services.checker import run_all_checks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyze", tags=["Analyze"])


class AnalyzeResponse(BaseModel):
    session_id: str
    brief: PackagingBrief
    validation: ValidationResult


@router.post("/{session_id}", response_model=AnalyzeResponse)
async def analyze_session(session_id: str) -> AnalyzeResponse:
    """Analyzes the uploaded packaging documents for the given session.

    Synthesizes the data via Gemini, builds the standard 6-section PackagingBrief,
    and executes deterministic math/regulatory compliance checks.
    """
    extracted_data = session_store.get_extracted_data(session_id)
    if not extracted_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found or no files have been uploaded.",
        )

    # 1. Run AI analysis (with heuristic fallback)
    try:
        analysis = ai_engine.analyze_documents(extracted_data)
    except Exception as e:
        logger.error(f"Error during AI analysis for session {session_id}: {e}")
        analysis = ai_engine._heuristic_analysis_fallback(extracted_data)

    # 2. Build initial PackagingBrief
    brief = build_brief(extracted_data, analysis, session_id)

    # 3. Run Deterministic Checks (Checker service)
    validation = run_all_checks(brief, extracted_data)

    # 4. Run AI Regulatory Validation (if configured)
    try:
        ai_issues = ai_engine.validate_with_ai(brief)
        if ai_issues:
            # Deduplicate with deterministic issues
            existing_titles = {i.title for i in validation.issues}
            for ai_iss in ai_issues:
                if ai_iss.title not in existing_titles:
                    validation.issues.append(ai_iss)
                    sev = ai_iss.severity.lower()
                    if sev in validation.summary:
                        validation.summary[sev] += 1

            validation.passed = (validation.summary.get("critical", 0) == 0)
            brief.issues_summary = validation.summary
    except Exception as ai_val_err:
        logger.warning(f"AI validation step failed: {ai_val_err}")

    # Persist in session store
    session_store.set_brief(session_id, brief)
    session_store.set_validation(session_id, validation)

    return AnalyzeResponse(
        session_id=session_id,
        brief=brief,
        validation=validation,
    )
