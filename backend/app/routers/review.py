"""Human-in-the-loop actions: edit, confirm, answer, acknowledge, preview impact, finalize."""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.brief import ChangeLogEntry, FieldChange, Issue, SourceRef
from app.routers.common import SessionView, apply_edit, load, require_draft, save_and_view
from app.services.catalog import FIELD_BY_KEY
from app.services.pipeline import now, recompute
from app.services.values import norm_text, plural

router = APIRouter(prefix="/sessions", tags=["Review"])
REVIEWER = "Reviewer"


class EditRequest(BaseModel):
    value: str
    reason: Optional[str] = None


class ConfirmRequest(BaseModel):
    reason: Optional[str] = None


class AnswerRequest(BaseModel):
    option_id: Optional[str] = None
    custom_value: Optional[str] = None
    note: Optional[str] = None


class AckRequest(BaseModel):
    note: str = "Passed to the agency as an open question."


@router.put("/{sid}/fields/{key}", response_model=SessionView)
def edit_field(sid: str, key: str, req: EditRequest) -> SessionView:
    state, ctx, ex = load(sid)
    require_draft(state)
    apply_edit(state, key, req.value, REVIEWER, req.reason or "Edited in review")
    return save_and_view(state, ctx, ex)


@router.post("/{sid}/fields/{key}/confirm", response_model=SessionView)
def confirm_field(sid: str, key: str, req: ConfirmRequest) -> SessionView:
    state, ctx, ex = load(sid)
    require_draft(state)
    f = state.field(key)
    if f is None or not f.value:
        raise HTTPException(status_code=400, detail="Only a field with a value can be confirmed.")
    apply_edit(state, key, f.value, REVIEWER, req.reason or "Confirmed as correct", action="confirm")
    return save_and_view(state, ctx, ex)


class NARequest(BaseModel):
    reason: str


@router.post("/{sid}/fields/{key}/undo", response_model=SessionView)
def undo_field(sid: str, key: str) -> SessionView:
    """Reverses the latest change to a field. Undoing again re-applies it."""
    state, ctx, ex = load(sid)
    require_draft(state)
    f = state.field(key)
    if f is None or not f.history:
        raise HTTPException(status_code=400, detail="Nothing to undo for this field.")
    last = f.history[-1]
    apply_edit(state, key, last.old or "", REVIEWER, f"Undo of: {last.reason or 'earlier change'}", action="undo")
    f.user_confirmed = False
    return save_and_view(state, ctx, ex)


@router.post("/{sid}/fields/{key}/not-applicable", response_model=SessionView)
def mark_not_applicable(sid: str, key: str, req: NARequest) -> SessionView:
    state, ctx, ex = load(sid)
    require_draft(state)
    f = state.field(key)
    if f is None:
        raise HTTPException(status_code=404, detail=f"Unknown field '{key}'.")
    if f.value:
        raise HTTPException(status_code=400, detail="Clear the value first; a field with a value applies.")
    if not req.reason.strip():
        raise HTTPException(status_code=400, detail="Say why this field does not apply.")
    f.not_applicable = True
    f.history.append(FieldChange(at=now(), by=REVIEWER, old=None, new=None, reason=f"Not applicable: {req.reason}"))
    state.change_log.append(ChangeLogEntry(at=now(), by=REVIEWER, action="not_applicable", field=key, note=req.reason))
    return save_and_view(state, ctx, ex)


@router.post("/{sid}/questions/{qid}/answer", response_model=SessionView)
def answer_question(sid: str, qid: str, req: AnswerRequest) -> SessionView:
    state, ctx, ex = load(sid)
    require_draft(state)
    q = next((q for q in state.questions if q.id == qid), None)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found (it may already be resolved).")
    reason = f"Answer to: {q.question}"
    if req.custom_value and req.custom_value.strip():
        if not q.custom_field:
            raise HTTPException(status_code=400, detail="This question takes one of the listed answers only.")
        apply_edit(state, q.custom_field, req.custom_value, REVIEWER, reason, action="answer")
    else:
        opt = next((o for o in q.options if o.id == req.option_id), None)
        if opt is None:
            raise HTTPException(status_code=400, detail="Choose an option or enter a value.")
        for key, value in opt.updates.items():
            apply_edit(state, key, value, REVIEWER, f"{reason} → {opt.label}", action="answer")
        if opt.acknowledge:
            for iid in q.issue_ids:
                _acknowledge(state, iid, req.note or opt.label)
    return save_and_view(state, ctx, ex)


def _acknowledge(state, iid: str, note: str) -> None:
    state.acknowledgements[iid] = note
    state.change_log.append(ChangeLogEntry(at=now(), by=REVIEWER, action="acknowledge", issue=iid, note=note))


@router.post("/{sid}/issues/{iid}/acknowledge", response_model=SessionView)
def acknowledge_issue(sid: str, iid: str, req: AckRequest) -> SessionView:
    state, ctx, ex = load(sid)
    require_draft(state)
    if not any(i.id == iid for i in state.issues):
        raise HTTPException(status_code=404, detail="Issue not found.")
    _acknowledge(state, iid, req.note)
    return save_and_view(state, ctx, ex)


@router.post("/{sid}/issues/{iid}/reopen", response_model=SessionView)
def reopen_issue(sid: str, iid: str) -> SessionView:
    state, ctx, ex = load(sid)
    require_draft(state)
    state.acknowledgements.pop(iid, None)
    state.change_log.append(ChangeLogEntry(at=now(), by=REVIEWER, action="reopen", issue=iid))
    return save_and_view(state, ctx, ex)


@router.post("/{sid}/finalize", response_model=SessionView)
def finalize(sid: str) -> SessionView:
    state, ctx, ex = load(sid)
    recompute(state, ctx)
    blocking = [i for i in state.issues if i.state == "open" and i.severity == "blocking" and i.resolution == "data"]
    if blocking:
        raise HTTPException(status_code=409, detail={
            "message": "Resolve or acknowledge the blocking issues before finalizing.",
            "blocking": [{"id": i.id, "title": i.title} for i in blocking],
        })
    state.status = "finalized"
    state.change_log.append(ChangeLogEntry(at=now(), by=REVIEWER, action="finalize",
                                           note=f"{plural(len(state.acknowledgements), 'item')} passed to the agency."))
    return save_and_view(state, ctx, ex)


@router.post("/{sid}/reopen", response_model=SessionView)
def reopen(sid: str) -> SessionView:
    state, ctx, ex = load(sid)
    state.status = "draft"
    state.change_log.append(ChangeLogEntry(at=now(), by=REVIEWER, action="reopen", note="Brief reopened for edits."))
    return save_and_view(state, ctx, ex)


# ---------------------------------------------------------------- Change impact simulator


class ImpactRequest(BaseModel):
    field: str
    value: str


class IssueDelta(BaseModel):
    id: str
    title: str
    severity: str


class FieldDelta(BaseModel):
    key: str
    label: str
    before: str
    after: str


class ImpactPreview(BaseModel):
    field: str
    old: Optional[str]
    new: str
    resolved: List[IssueDelta]
    introduced: List[IssueDelta]
    status_changes: List[FieldDelta]
    artwork_locations: List[SourceRef]
    sheet_locations: List[SourceRef]
    readiness_before: int
    readiness_after: int
    blocking_before: int
    blocking_after: int
    approvals_needed: List[str]


def _delta(i: Issue) -> IssueDelta:
    return IssueDelta(id=i.id, title=i.title, severity=i.severity)


@router.post("/{sid}/impact", response_model=ImpactPreview)
def impact(sid: str, req: ImpactRequest) -> ImpactPreview:
    """Shows what a change would affect, without applying it."""
    state, ctx, _ = load(sid)
    f = state.field(req.field)
    if f is None:
        raise HTTPException(status_code=404, detail=f"Unknown field '{req.field}'.")
    before = state.model_copy(deep=True)
    after = state.model_copy(deep=True)
    apply_edit(after, req.field, req.value, REVIEWER, "Impact preview")
    recompute(after, ctx.model_copy(deep=True))

    b_ids = {i.id: i for i in before.issues if i.state == "open"}
    a_ids = {i.id: i for i in after.issues if i.state == "open"}
    status_changes = []
    for bf in before.fields:
        af = after.field(bf.key)
        if af and af.status != bf.status:
            status_changes.append(FieldDelta(key=bf.key, label=bf.label, before=bf.status, after=af.status))

    # Everywhere the old value is printed or written, so nothing is left behind.
    old = f.value or ""
    art, sheet = [], []
    if old:
        needle = norm_text(old)
        for other in state.fields:
            for c in other.candidates:
                if needle and needle in norm_text(c.value):
                    (art if c.source.kind == "pdf" else sheet).append(c.source)
    owners = sorted({i.owner for i in a_ids.values() if i.id not in b_ids} | {FIELD_BY_KEY[req.field].owner})
    return ImpactPreview(
        field=req.field, old=f.value, new=req.value,
        resolved=[_delta(i) for k, i in b_ids.items() if k not in a_ids],
        introduced=[_delta(i) for k, i in a_ids.items() if k not in b_ids],
        status_changes=status_changes,
        artwork_locations=_dedupe(art), sheet_locations=_dedupe(sheet),
        readiness_before=before.readiness.score if before.readiness else 0,
        readiness_after=after.readiness.score if after.readiness else 0,
        blocking_before=before.readiness.blocking_open if before.readiness else 0,
        blocking_after=after.readiness.blocking_open if after.readiness else 0,
        approvals_needed=owners,
    )


def _dedupe(srcs: List[SourceRef]) -> List[SourceRef]:
    seen, out = set(), []
    for s in srcs:
        key = (s.file, s.cell, tuple(s.bbox or []))
        if key not in seen:
            seen.add(key)
            out.append(s)
    return out
