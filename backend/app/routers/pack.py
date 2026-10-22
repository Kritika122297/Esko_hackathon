"""Talk to the Pack: inspect one element of the artwork, audit it against its rules, and fix it.

The AI never decides alone:
* an audit may only cite clauses that govern the field (from the rule packs); its quote must be words that are
  really in the clause, and a code finding on the field outranks an AI 'compliant';
* when no clause governs the field, the answer says so and the AI is not asked;
* a suggested fix comes from code (a calculated answer to an open question) when one exists; an AI fix may only
  use numbers already in the brief, and is previewed on a copy before anything changes;
* applying a fix is a separate, explicit request, logged with the old and new value.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.brief import BriefState, SourceRef
from app.routers.chat_actions import _preview
from app.routers.common import SessionView, apply_edit, load, locked, require_draft, save_and_view
from app.services.ai_summary import _grounded
from app.services.chat import ActionImpact
from app.services.guidelines import Clause, canonical_clause, load_standards, requirements
from app.services.llm import chain
from app.services.values import norm_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["Talk to the Pack"])
BY = "AI via Talk to the Pack"


class ClauseRef(BaseModel):
    id: str
    standard: str
    text: str


class FieldIssue(BaseModel):
    id: str
    title: str
    severity: str
    description: str
    clauses: List[ClauseRef] = Field(default_factory=list)


class Inspection(BaseModel):
    key: str
    label: str
    value: Optional[str]
    status: str
    sources: List[SourceRef]
    candidates: List[SourceRef]
    issues: List[FieldIssue]
    clauses: List[ClauseRef]


class Quote(BaseModel):
    clause_id: str
    standard: str
    text: str
    exact: bool = Field(..., description="True when the AI's quote was found word for word in the clause")


class AuditResult(BaseModel):
    key: str
    label: str
    value: Optional[str]
    verdict: Literal["compliant", "issue", "unclear", "no_rule"]
    answer: str
    quotes: List[Quote] = Field(default_factory=list)
    open_issues: List[str] = Field(default_factory=list)
    ai: bool = False
    model: Optional[str] = None


class FixSuggestion(BaseModel):
    key: str
    label: str
    current: Optional[str]
    suggested: Optional[str] = None
    source: Optional[Literal["code", "ai"]] = None
    reason: Optional[str] = None
    clause_id: Optional[str] = None
    impact: Optional[ActionImpact] = None
    message: Optional[str] = None
    model: Optional[str] = None


class ApplyFix(BaseModel):
    value: str = Field(..., min_length=1, max_length=2000)
    source: Literal["code", "ai"]
    reason: Optional[str] = Field(None, max_length=400)


# ---------------------------------------------------------------- what governs a field


def _clause_index(state: BriefState) -> Dict[str, Clause]:
    idx = {c.id: c for s in load_standards().values() for c in s.clauses}
    idx.update({c.id: c for c in state.company_clauses})
    return idx


def _ref(c: Clause) -> ClauseRef:
    return ClauseRef(id=c.id, standard=c.standard_name or c.standard, text=c.text)


def _governing(state: BriefState, key: str) -> List[Clause]:
    """Clauses that require the field for this market and category, then any cited by its open findings."""
    reqs = requirements(state.market, state.category, state.standards or None, state.company_clauses)
    out = [c for c, _ in reqs.get(key, []) if c.standard != "base"] or [c for c, _ in reqs.get(key, [])]
    idx = _clause_index(state)
    for i in _issues(state, key):
        for cid in i.clauses:
            c = idx.get(canonical_clause(cid))
            if c and c not in out:
                out.append(c)
    return out


def _issues(state: BriefState, key: str):
    return [i for i in state.issues if i.state == "open" and key in i.fields]


def _field(state: BriefState, key: str):
    f = state.field(key)
    if f is None:
        raise HTTPException(status_code=404, detail=f"Unknown field '{key}'.")
    return f


@router.get("/{sid}/fields/{key}/inspect", response_model=Inspection)
def inspect(sid: str, key: str) -> Inspection:
    state, _, _ = load(sid)
    f = _field(state, key)
    idx = _clause_index(state)
    issues = [FieldIssue(id=i.id, title=i.title, severity=i.severity, description=i.description,
                         clauses=[_ref(idx[canonical_clause(c)]) for c in i.clauses if canonical_clause(c) in idx])
              for i in _issues(state, key)]
    return Inspection(key=f.key, label=f.label, value=f.value, status=f.status, sources=f.sources,
                      candidates=[c.source.model_copy(update={"snippet": c.value}) for c in f.candidates],
                      issues=issues, clauses=[_ref(c) for c in _governing(state, key)])


# ---------------------------------------------------------------- audit


AUDIT_PROMPT = (
    "You audit ONE element of a packaging label for the {market} market ({category}). Use ONLY the RULES below. "
    "Say whether the VALUE meets them and why, in 1 to 3 plain sentences. Quote the words of the rule you rely on, "
    "copied exactly. If the rules do not decide it, say so (verdict 'unclear'). Never cite a rule that is not "
    "listed, never invent rules, values or numbers.\n"
    'Return JSON only: {{"verdict":"compliant"|"issue"|"unclear","answer":"...","clause_id":"<id from RULES or null>",'
    '"quote":"<exact words from that rule>"}}\n\n'
)


def _quote_ok(quote: str, clause: Clause) -> bool:
    q = norm_text(quote)
    return len(q) >= 8 and q in norm_text(clause.text)


@router.post("/{sid}/fields/{key}/audit", response_model=AuditResult)
def audit(sid: str, key: str) -> AuditResult:
    state, _, _ = load(sid)
    f = _field(state, key)
    clauses = _governing(state, key)
    open_ = [i.title for i in _issues(state, key) if i.severity in ("blocking", "warning")]
    base = dict(key=key, label=f.label, value=f.value, open_issues=open_)
    if not clauses:
        return AuditResult(**base, verdict="no_rule", answer=(
            f"No rule in the loaded {state.market} rule packs governs {f.label.lower()} for this category, so there is "
            "nothing to audit it against." + (f" The code checks still report: {'; '.join(open_)}." if open_ else "")))
    by_id = {c.id: c for c in clauses}
    context = json.dumps({"element": f.label, "value": f.value, "rules": {c.id: c.text for c in clauses},
                          "findings_by_code": open_}, ensure_ascii=False)
    for model in chain("chat"):
        try:
            data = model.json(AUDIT_PROMPT.format(market=state.market, category=state.category) + "INPUT:\n" + context,
                              temperature=0.1)
        except Exception as err:
            logger.warning("Pack audit via %s failed: %s", model.model, str(err)[:160])
            continue
        if not isinstance(data, dict) or not str(data.get("answer") or "").strip():
            continue
        verdict = data.get("verdict") if data.get("verdict") in ("compliant", "issue", "unclear") else "unclear"
        cid = canonical_clause(str(data.get("clause_id") or ""))
        answer = " ".join(s for s in re.split(r"(?<=[.!?])\s+", str(data["answer"]).strip()) if _grounded(s, context))
        quotes = []
        if cid in by_id:
            exact = _quote_ok(str(data.get("quote") or ""), by_id[cid])
            quotes.append(Quote(clause_id=cid, standard=by_id[cid].standard_name or by_id[cid].standard, exact=exact,
                                text=str(data["quote"]).strip() if exact else by_id[cid].text))
        if verdict == "compliant" and open_:  # code beats AI on anything it has checked
            verdict, answer = "issue", (answer + f" However, the code checks still report: {'; '.join(open_)}.").strip()
        return AuditResult(**base, verdict=verdict, answer=answer[:900] or "The AI gave no usable answer.",
                           quotes=quotes or [Quote(clause_id=c.id, standard=c.standard_name or c.standard, text=c.text,
                                                   exact=False) for c in clauses[:1]], ai=True, model=model.model)
    # Without the AI: what code knows, with the governing rule quoted in full.
    first = clauses[0]
    return AuditResult(**base, verdict="issue" if open_ else "unclear", answer=(
        (f"The code checks report: {'; '.join(open_)}." if open_ else
         "The code checks raise nothing on this field, but whether the wording meets the rule needs a person or the AI.")
        + f" Rule {first.id} applies."),
        quotes=[Quote(clause_id=c.id, standard=c.standard_name or c.standard, text=c.text, exact=False) for c in clauses[:2]])


# ---------------------------------------------------------------- suggest and apply a fix


FIX_PROMPT = (
    "You fix ONE element of a packaging label for the {market} market. Propose replacement wording for VALUE that "
    "meets the RULES and resolves the FINDINGS. Keep the facts of the value. Do not add facts, claims or numbers "
    "that are not in VALUE, FINDINGS or FACTS. If you cannot fix it safely, return an empty suggested.\n"
    'Return JSON only: {{"suggested":"...","reason":"<one sentence>","clause_id":"<id from RULES or null>"}}\n\n'
)


def _code_fix(state: BriefState, key: str) -> Optional[tuple]:
    """A suggested answer computed by code for an open question about this field (e.g. the net weight in oz)."""
    for q in state.questions:
        for o in q.options:
            if o.recommended and key in o.updates and o.updates[key] != (state.value(key) or ""):
                return o.updates[key], f"{q.question} Suggested answer: {o.label}"
    return None


@router.post("/{sid}/fields/{key}/suggest-fix", response_model=FixSuggestion)
def suggest_fix(sid: str, key: str) -> FixSuggestion:
    state, ctx, _ = load(sid)
    f = _field(state, key)
    base = dict(key=key, label=f.label, current=f.value)
    issues = [i for i in _issues(state, key) if i.severity in ("blocking", "warning")]
    clauses = _governing(state, key)
    if state.status == "finalized":
        return FixSuggestion(**base, message="The brief is finalized; reopen it before changing it.")
    code = _code_fix(state, key)
    if code:
        value, reason = code
        return FixSuggestion(**base, suggested=value, source="code", reason=reason,
                             clause_id=next((canonical_clause(c) for i in issues for c in i.clauses), None),
                             impact=_preview(state, ctx, "edit_field", {"field": key, "value": value}))
    if not f.value:
        return FixSuggestion(**base, message="There is no value to fix. Enter it in the workbench or answer its question.")
    if not issues:
        return FixSuggestion(**base, message="The code checks raise nothing on this field, so there is nothing to fix.")
    facts = {x.key: x.value for x in state.fields if x.value and x.key != key}
    context = json.dumps({"element": f.label, "value": f.value, "rules": {c.id: c.text for c in clauses},
                          "findings": [{"title": i.title, "detail": i.description, "fix": i.suggestion} for i in issues],
                          "facts": facts}, ensure_ascii=False)
    for model in chain("chat"):
        try:
            data = model.json(FIX_PROMPT.format(market=state.market) + "INPUT:\n" + context, temperature=0.2)
        except Exception as err:
            logger.warning("Pack fix via %s failed: %s", model.model, str(err)[:160])
            continue
        if not isinstance(data, dict):
            continue
        value = " ".join(str(data.get("suggested") or "").split())[:1000]
        if not value or value == f.value or not _grounded(value, context):
            continue  # nothing, no change, or a number the brief does not have
        cid = canonical_clause(str(data.get("clause_id") or ""))
        return FixSuggestion(**base, suggested=value, source="ai", reason=str(data.get("reason") or "")[:300] or None,
                             clause_id=cid if cid in {c.id for c in clauses} else None, model=model.model,
                             impact=_preview(state, ctx, "edit_field", {"field": key, "value": value}))
    return FixSuggestion(**base, message="No fix could be suggested that passes the checks. Edit it in the workbench.")


@router.post("/{sid}/fields/{key}/apply-fix", response_model=SessionView)
@locked
def apply_fix(sid: str, key: str, req: ApplyFix) -> SessionView:
    """Applies a fix the person accepted. Logged as 'AI via Talk to the Pack' with the old and new value."""
    state, ctx, ex = load(sid)
    require_draft(state)
    _field(state, key)
    how = "calculated by code" if req.source == "code" else "suggested by the AI"
    apply_edit(state, key, req.value, BY, f"Fix {how}, accepted by the reviewer" + (f": {req.reason}" if req.reason else ""),
               action="edit", origin="rule" if req.source == "code" else "ai")
    return save_and_view(state, ctx, ex)
