"""Changes the assistant prepares: validated by code, previewed on a copy, applied only when a person confirms.

The AI (or the command parser) only proposes. Each proposal must name a real field, question, option or finding;
anything else is dropped and the user is told why. A valid proposal is previewed on a deep copy of the brief, so
the card shows what it would resolve or introduce. Applying it calls the same route as the button on screen, so
it is checked again, logged in the change log and can be undone.
"""

from __future__ import annotations

import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import HTTPException

from app.models.brief import BriefState, Question
from app.routers import review
from app.routers.common import SessionView, apply_edit
from app.services.chat import ActionImpact, ChatAction
from app.services.checks import CheckContext
from app.services.pipeline import recompute

ASKED = "Requested in the assistant"


def _q(state: BriefState, qid: str) -> Optional[Question]:
    return next((q for q in state.questions if q.id == qid), None)


def _short(text: Optional[str], n: int = 90) -> str:
    t = " ".join((text or "").split())
    return t if len(t) <= n else t[: n - 1] + "…"


def _answer_request(p: Dict[str, Any]) -> review.AnswerRequest:
    kind = p.get("kind") if p.get("kind") in ("unknown", "not_applicable") else None
    return review.AnswerRequest(kind=kind, option_id=p.get("option") or None, custom_value=p.get("value") or None,
                                note=p.get("reason") or p.get("note") or None)


def _validate(state: BriefState, p: Dict[str, Any]) -> Tuple[str, Dict[str, str], str, Optional[str]]:
    """(type, params, label, detail) for a proposal, or ValueError with the reason it cannot be done."""
    kind = p.get("type")
    if kind in ("edit_field", "not_applicable", "undo"):
        f = state.field(str(p.get("field") or ""))
        if f is None:
            raise ValueError(f"there is no field '{p.get('field')}'")
        if kind == "edit_field":
            value = str(p.get("value") or "").strip()
            if not value:
                raise ValueError(f"no new value was given for {f.label.lower()}")
            if value == (f.value or ""):
                raise ValueError(f"{f.label} is already '{_short(value, 40)}'")
            return kind, {"field": f.key, "value": value[:2000]}, f"Set {f.label.lower()} to “{_short(value)}”", \
                f"Now: {'“' + _short(f.value) + '”' if f.value else 'empty'}"
        if kind == "not_applicable":
            reason = str(p.get("reason") or "").strip()
            if f.value:
                raise ValueError(f"{f.label.lower()} has a value, so it applies; clear it first")
            if f.not_applicable:
                raise ValueError(f"{f.label.lower()} is already marked not applicable")
            if not reason:
                raise ValueError(f"a reason is needed to mark {f.label.lower()} not applicable")
            return kind, {"field": f.key, "reason": reason[:300]}, f"Mark {f.label.lower()} as not applicable", \
                f"Reason: {_short(reason)}"
        if not f.history:
            raise ValueError(f"{f.label.lower()} has no change to undo")
        last = f.history[-1]
        back = "not applicable undone" if (last.reason or "").startswith(review.NA_PREFIX) else \
            ("“" + _short(last.old) + "”" if last.old else "empty")
        return kind, {"field": f.key}, f"Undo the last change to {f.label.lower()}", f"Back to: {back}"

    if kind == "answer_question":
        q = _q(state, str(p.get("question") or ""))
        if q is None:
            raise ValueError("that question is not open (it may already be answered)")
        req = _answer_request(p)
        try:
            review._check_answer(q, req)
        except HTTPException as err:
            raise ValueError(str(err.detail).rstrip(".").lower())
        if req.kind == "unknown":
            what = "I don't know: pass it to the agency"
        elif req.kind == "not_applicable":
            what = f"Not applicable ({_short(req.note, 60)})"
        elif req.custom_value:
            what = f"“{_short(req.custom_value, 70)}”"
        else:
            what = next(o.label for o in q.options if o.id == req.option_id)
        params = {"question": q.id, **{k: v for k, v in (("option", req.option_id), ("value", req.custom_value),
                                                          ("kind", req.kind), ("reason", req.note)) if v}}
        return kind, params, f"Answer: {_short(q.question, 80)}", f"Answer: {_short(what, 120)}"

    if kind == "pass_to_agency":
        iid = str(p.get("finding") or "")
        issue = next((i for i in state.issues if i.id == iid), None)
        if issue is None or issue.state != "open":
            raise ValueError("that finding is not open")
        if issue.resolution != "data":
            raise ValueError("that finding is already a designer task")
        note = str(p.get("note") or "").strip() or "Passed to the agency as an open question."
        return kind, {"finding": iid, "note": note[:300]}, f"Pass to the agency: {_short(issue.title, 80)}", \
            f"Note: {_short(note)}"
    raise ValueError(f"'{kind}' is not something the assistant can do")


def _perform(state: BriefState, action_type: str, params: Dict[str, str]) -> None:
    """Applies an action to a state in memory, with the same internals the routes use (for the preview)."""
    if action_type == "edit_field":
        apply_edit(state, params["field"], params["value"], review.REVIEWER, ASKED)
    elif action_type == "not_applicable":
        review._mark_na(state, state.field(params["field"]), params["reason"])
    elif action_type == "undo":
        f = state.field(params["field"])
        last = f.history[-1]
        if (last.reason or "").startswith(review.NA_PREFIX) and f.not_applicable:
            f.not_applicable = False
        else:
            apply_edit(state, f.key, last.old or "", review.REVIEWER, "Undo", action="undo")
    elif action_type == "answer_question":
        review._record(state, review._apply_answer(state, _q(state, params["question"]), _answer_request(params)))
    elif action_type == "pass_to_agency":
        review._acknowledge(state, params["finding"], params["note"])


def _preview(state: BriefState, ctx: CheckContext, action_type: str, params: Dict[str, str]) -> ActionImpact:
    before = {i.id: i.title for i in state.issues if i.state == "open" and i.resolution == "data"}
    trial, trial_ctx = state.model_copy(deep=True), ctx.model_copy(deep=True)
    _perform(trial, action_type, params)
    recompute(trial, trial_ctx)
    after = {i.id: i.title for i in trial.issues if i.state == "open" and i.resolution == "data"}
    rb, ra = state.readiness, trial.readiness
    return ActionImpact(resolved=[t for k, t in before.items() if k not in after][:6],
                        introduced=[t for k, t in after.items() if k not in before][:6],
                        readiness_before=rb.score if rb else 0, readiness_after=ra.score if ra else 0,
                        blocking_before=rb.blocking_open if rb else 0, blocking_after=ra.blocking_open if ra else 0)


def build(state: BriefState, ctx: CheckContext, proposals: List[Dict[str, Any]]) -> Tuple[List[ChatAction], List[str]]:
    """Valid proposals as action cards, and a plain reason for each one that was dropped."""
    if not proposals:
        return [], []
    if state.status == "finalized":
        return [], ["the brief is finalized; reopen it in the workbench before changing it"]
    actions: List[ChatAction] = []
    rejected: List[str] = []
    seen = set()
    trial, trial_ctx = state, ctx
    for p in proposals[:8]:
        try:
            kind, params, label, detail = _validate(trial, p)
        except (ValueError, KeyError, TypeError) as err:
            rejected.append(str(err))
            continue
        key = (kind, tuple(sorted(params.items())))
        if key in seen:
            continue
        seen.add(key)
        try:
            impact = _preview(trial, trial_ctx, kind, params)
        except Exception as err:  # a preview problem must not hide the action
            impact = None
            rejected.append(f"no preview for '{label}' ({err.__class__.__name__})")
        actions.append(ChatAction(id=uuid.uuid4().hex[:10], type=kind, params=params, label=label, detail=detail,
                                  impact=impact))
    return actions, rejected


def execute(sid: str, action: ChatAction) -> SessionView:
    """Runs the action through the same route a button would use (checked again, locked, logged)."""
    p = action.params
    routes: Dict[str, Callable[[], SessionView]] = {
        "edit_field": lambda: review.edit_field(sid=sid, key=p["field"], req=review.EditRequest(value=p["value"], reason=ASKED)),
        "not_applicable": lambda: review.mark_not_applicable(sid=sid, key=p["field"], req=review.NARequest(reason=p["reason"])),
        "undo": lambda: review.undo_field(sid=sid, key=p["field"]),
        "answer_question": lambda: review.answer_question(sid=sid, qid=p["question"], req=_answer_request(p)),
        "pass_to_agency": lambda: review.acknowledge_issue(sid=sid, iid=p["finding"], req=review.AckRequest(note=p["note"])),
    }
    return routes[action.type]()
