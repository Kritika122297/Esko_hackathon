"""READ -> UNDERSTAND -> FILL -> CHECK -> ASK. Re-run CHECK/ASK after every human change."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

from app.models.brief import BriefState, ChangeLogEntry, Readiness
from app.models.extraction import Extraction
from app.services.checks import CheckContext, run_checks
from app.services.extract_fields import read_artwork, read_sheets
from app.services.file_parser import merge_extractions, parse_file
from app.services.guidelines import requirements
from app.services.merge import build_fields, group_candidates
from app.services.ai_questions import apply_rewrites
from app.services.questions import build_questions
from app.services.values import plural

logger = logging.getLogger(__name__)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_files(paths: List[Tuple[Path, str]], session_dir: Path) -> Extraction:
    parts = []
    for i, (path, name) in enumerate(paths, start=1):
        try:
            parts.append(parse_file(path, name, session_dir, i))
        except Exception as err:  # a broken file must not stop the others
            logger.exception("Failed to read %s", name)
            ex = Extraction()
            ex.notes.append(f"{name}: could not be read ({err}).")
            parts.append(ex)
    return merge_extractions(parts)


def analyze(state: BriefState, ex: Extraction) -> CheckContext:
    sheet_cands, sheet = read_sheets(ex)
    art_cands, art = read_artwork(ex)
    fields, column = build_fields(sheet_cands, sheet, art_cands, art)
    state.fields = fields
    state.extraction_notes = list(ex.notes)
    if column:
        state.extraction_notes.append(f"Nutrition values taken from content-sheet column '{column}' "
                                      "(the column that matches the artwork).")
    if art.has_artwork and not art.front_panel_id:
        state.extraction_notes.append("Front panel (PDP) could not be identified; placement checks were skipped.")
    market = state.value("market")
    if market and state.market == "US" and market.lower() not in ("us", "usa", "united states"):
        state.extraction_notes.append(f"Content sheet names the market '{market}'; the selected market is US.")
    state.change_log.append(ChangeLogEntry(at=now(), by="system", action="analyze",
                                           note=f"Read {len(state.files)} files, filled {sum(1 for f in fields if f.value)} fields."))
    return CheckContext(artwork=art, sheet=sheet, nutrition_column=column)


def recompute(state: BriefState, saved: CheckContext) -> BriefState:
    required = requirements(state.market, state.category, state.standards or None, state.company_clauses)
    for f in state.fields:
        f.mandatory = f.key in required
    art = saved.artwork.has_artwork
    for f in state.fields:
        if f.value:
            f.absence = None
        elif f.not_applicable:
            f.absence = "not_applicable"
        else:  # nobody provided it; with artwork present we also looked for it there and did not find it
            f.absence = "not_detected" if art and f.on_artwork else "not_provided"
    issues, passed = run_checks(state, saved)
    state.issues = issues
    state.passed_checks = passed

    open_by_field = {}
    for i in issues:
        if i.state == "open" and i.severity in ("blocking", "warning"):
            for k in i.fields:
                open_by_field.setdefault(k, []).append(i)

    for f in state.fields:
        conflicting = len(group_candidates(f.key, f.candidates)) > 1 and f.key != "claims"
        flagged = any(s.flagged for s in f.sources)
        agreeing = len({(s.kind, s.file) for s in f.sources})
        if not f.value and f.not_applicable:
            f.status, f.confidence = "confirmed", 1.0  # a reviewer decided it does not apply
        elif not f.value:
            f.status, f.confidence = "missing", 0.0
        elif f.key in open_by_field:
            f.status = "needs_review"
            f.confidence = 0.4 if conflicting else 0.6
        elif f.user_confirmed:
            f.status, f.confidence = "confirmed", 1.0
        elif conflicting or flagged:
            f.status, f.confidence = "needs_review", 0.5
        else:
            f.status = "confirmed"
            f.confidence = 0.95 if agreeing >= 2 else 0.8

    name = state.value("product_name") or state.value("statement_of_identity")
    brand = state.value("brand")
    if name:
        state.product_name = f"{brand} {name}" if brand and brand.lower() not in name.lower() else name

    state.questions = build_questions(state, saved)
    apply_rewrites(state.questions, saved)
    state.readiness = readiness(state)
    state.updated_at = now()
    return state


def readiness(state: BriefState) -> Readiness:
    relevant = [f for f in state.fields if f.mandatory or f.value]
    confirmed = sum(1 for f in relevant if f.status == "confirmed")
    review = sum(1 for f in relevant if f.status == "needs_review")
    missing = sum(1 for f in relevant if f.status == "missing")
    blocking = [i for i in state.issues if i.state == "open" and i.severity == "blocking" and i.resolution == "data"]
    warnings = [i for i in state.issues if i.state == "open" and i.severity == "warning" and i.resolution == "data"]
    acknowledged = sum(1 for i in state.issues if i.state == "acknowledged")
    questions_open = sum(1 for q in state.questions if q.priority == "must_answer")
    field_score = confirmed / max(len(relevant), 1)
    score = round(100 * field_score * (0.5 if blocking else 1.0) * (0.9 if warnings else 1.0))
    ready = not blocking
    if ready:
        design = sum(1 for i in state.issues if i.resolution == "design")
        headline = (f"Ready for designer handoff. {plural(acknowledged, 'item')} {'goes' if acknowledged == 1 else 'go'} to the agency as open questions"
                    f" and {plural(design, 'design task')}.")
    else:
        headline = f"Not ready: {plural(len(blocking), 'blocking decision')} still open."
    return Readiness(score=score, ready=ready, fields_total=len(relevant), fields_confirmed=confirmed,
                     fields_needs_review=review, fields_missing=missing, blocking_open=len(blocking),
                     warnings_open=len(warnings), acknowledged=acknowledged, questions_open=questions_open,
                     headline=headline)
