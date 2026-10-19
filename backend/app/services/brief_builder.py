"""Brief builder service for BriefForge.

Assembles extracted data, AI analysis, and source metadata into a structured PackagingBrief.
"""

from datetime import datetime, timezone
import logging
from typing import Dict, Any, Optional

from app.models.brief import PackagingBrief, BriefSection, BriefField
from app.models.extraction import ExtractedData
from app.services.ai_engine import ai_engine
from app.services.checker import run_all_checks

logger = logging.getLogger(__name__)


def build_brief(
    extracted_data: ExtractedData,
    ai_analysis: Dict[str, Any],
    session_id: str,
) -> PackagingBrief:
    """Builds a structured PackagingBrief from extracted document data and AI analysis.

    Populates standard sections, performs initial conflict detection,
    and runs initial validation checks.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    product_name = ai_analysis.get("product_name") or "Untitled Packaging Project"

    # Generate the 6 standard brief sections from the analysis
    sections = ai_engine.generate_brief_fields(ai_analysis)

    brief = PackagingBrief(
        session_id=session_id,
        product_name=product_name,
        created_at=now_iso,
        updated_at=now_iso,
        status="draft",
        sections=sections,
        open_questions=[],
        issues_summary={"critical": 0, "warning": 0, "info": 0},
    )

    # Cross-reference sources to check for conflicts (e.g. Net weight 480g vs 500g)
    # Check if we have both PDF and Excel sources
    sources = [t.source_file.lower() for t in extracted_data.texts]
    has_pdf = any(s.endswith(".pdf") for s in sources)
    has_excel = any(s.endswith(".xlsx") or s.endswith(".xls") for s in sources)

    if has_pdf and has_excel:
        # Check net weight across texts
        net_weight_field = brief.get_field("net_weight")
        if net_weight_field:
            # Check if Excel notes mention weight differences or different fill weight
            excel_notes = ai_analysis.get("excel_notes_detected", [])
            for note in excel_notes:
                if "weight" in note.lower() or "500g" in note.lower() or "480g" in note.lower():
                    net_weight_field.status = "conflicting"
                    net_weight_field.issues.append(
                        f"Discrepancy detected with Excel specification: {note}"
                    )

    # Run deterministic checks
    validation = run_all_checks(brief, extracted_data)
    brief.issues_summary = validation.summary

    # Associate detected issues with specific brief fields
    for issue in validation.issues:
        if issue.field_name:
            field = brief.get_field(issue.field_name)
            if field:
                if issue.description not in field.issues:
                    field.issues.append(issue.description)
                if issue.severity == "critical":
                    field.status = "flagged" if field.status != "conflicting" else "conflicting"

    # Populate open questions
    generated_q = ai_engine.generate_questions(brief)
    brief.open_questions = [
        f"[{q.get('priority', 'info').upper()}] {q.get('question')} ({q.get('context', '')})"
        for q in generated_q
    ]

    return brief
