"""Ask-the-brief chat: answers questions about one brief from its own data, with citations.

Answers only ever come from the brief (fields, sources, findings, questions). With an AI provider
the wording is generated, but every citation is checked by code against the brief; without one,
or when the provider fails, a deterministic answerer covers the common questions.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.brief import BriefField, BriefState, Issue
from app.services.catalog import FIELD_BY_KEY, FIELDS
from app.services.checks.base import src_label
from app.services.llm import LLMError, get_llm
from app.services.values import plural

logger = logging.getLogger(__name__)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class Citation(BaseModel):
    kind: Literal["field", "issue"]
    key: str
    label: str


class ChatAnswer(BaseModel):
    answer: str
    citations: List[Citation] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str
    at: str
    citations: List[Citation] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


SUGGESTIONS = [
    "What is still blocking the brief?",
    "Summarize this brief",
    "What does R&D need to answer?",
    "Which values differ between the files?",
]

STOP = {"the", "a", "an", "is", "are", "what", "which", "who", "how", "why", "of", "for", "on", "in", "to", "and",
        "does", "do", "this", "that", "it", "we", "our", "be", "can", "should", "there", "any", "me", "tell",
        "about", "with", "brief", "pack", "value", "say", "says"}


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9%]+", text.lower()) if w not in STOP and len(w) > 1}


def _field_cite(f: BriefField) -> Citation:
    return Citation(kind="field", key=f.key, label=f.label)


def _issue_cite(i: Issue) -> Citation:
    return Citation(kind="issue", key=i.id, label=i.title)


def _open(state: BriefState) -> List[Issue]:
    return [i for i in state.issues if i.state == "open" and i.resolution == "data"]


def _describe_field(state: BriefState, f: BriefField) -> str:
    status = {"confirmed": "confirmed", "needs_review": "needs review", "missing": "missing"}[f.status]
    if not f.value:
        line = f"{f.label} is missing: no file provides it."
    else:
        srcs = ", ".join(dict.fromkeys(src_label(s) for s in f.sources)) or "no source"
        line = f"{f.label} is “{f.value}” ({status}; from {srcs})."
    alts = [c for c in f.candidates if f.value and c.value.strip().lower() != f.value.strip().lower()]
    seen: set[str] = set()
    for c in alts:
        if c.value.lower() in seen:
            continue
        seen.add(c.value.lower())
        line += f" {src_label(c.source)} says “{c.value[:120]}”."
    related = [i for i in _open(state) if f.key in i.fields]
    if related:
        line += " Open: " + "; ".join(i.title for i in related[:3]) + "."
    return line


def answer_deterministic(state: BriefState, question: str) -> ChatAnswer:
    q = question.lower()
    words = _words(question)
    open_issues = _open(state)
    blocking = [i for i in open_issues if i.severity == "blocking"]
    r = state.readiness

    # Intent: summary / status
    if re.search(r"summar|overview|status|where are we|how ready|readiness|ready", q):
        lines = [f"{state.product_name}, {state.market} market: {r.headline if r else ''}"]
        if r:
            lines.append(f"{r.fields_confirmed} of {r.fields_total} fields are confirmed, {r.fields_needs_review} need review and "
                         f"{r.fields_missing} required fields are missing.")
        if blocking:
            lines.append("Main blockers: " + "; ".join(i.title for i in blocking[:4]) + ".")
        owners = sorted({q.owner for q in state.questions})
        if owners:
            lines.append(f"{plural(len(state.questions), 'question')} are waiting on {', '.join(owners)}.")
        return ChatAnswer(answer=" ".join(lines), citations=[_issue_cite(i) for i in blocking[:4]])

    # Intent: blockers / what is left / finalize
    if re.search(r"block|left|remaining|finali|open|outstanding|to do|todo", q) and not words & _field_words():
        if not blocking:
            return ChatAnswer(answer="Nothing blocks the brief. It can be finalized; open warnings do not block.")
        items = "; ".join(f"{i.title} ({i.owner})" for i in blocking[:8])
        more = f" and {len(blocking) - 8} more" if len(blocking) > 8 else ""
        return ChatAnswer(answer=f"{plural(len(blocking), 'blocking decision')} remain: {items}{more}. Each must be answered "
                                 "or passed to the agency as an open question before finalizing.",
                          citations=[_issue_cite(i) for i in blocking[:8]])

    # Intent: missing
    if "missing" in q:
        missing = [f for f in state.fields if f.mandatory and not f.value]
        if not missing:
            return ChatAnswer(answer="No required field is missing.")
        return ChatAnswer(answer="Missing required fields: " + ", ".join(f.label for f in missing) + ".",
                          citations=[_field_cite(f) for f in missing[:8]])

    # Intent: conflicts between files
    if re.search(r"differ|conflict|disagree|mismatch|inconsisten", q):
        conflicts = [i for i in state.issues if i.check == "conflict"]
        if not conflicts:
            return ChatAnswer(answer="The files agree on every field they both contain.")
        return ChatAnswer(answer="The files disagree on: " + "; ".join(i.title.replace("Files disagree: ", "") for i in conflicts) +
                                 ". The content-sheet value is shown until someone decides.",
                          citations=[_issue_cite(i) for i in conflicts[:8]])

    # Intent: owner (R&D, Legal, ...)
    for owner in ("R&D", "Legal", "Supply Chain", "Brand", "Agency"):
        if owner.lower() in q or (owner == "R&D" and re.search(r"\br ?& ?d\b|\brnd\b|research", q)):
            qs = [x for x in state.questions if x.owner == owner]
            if not qs:
                return ChatAnswer(answer=f"Nothing is waiting on {owner}.")
            return ChatAnswer(answer=f"{owner} has {plural(len(qs), 'question')}: " + "; ".join(x.question for x in qs[:6]) + ".",
                              citations=[Citation(kind="issue", key=x.issue_ids[0], label=x.question) for x in qs[:6] if x.issue_ids])

    # Field lookup: best overlap with label + synonyms
    best: Optional[BriefField] = None
    score = 0
    for f in state.fields:
        fd = FIELD_BY_KEY.get(f.key)
        terms = _words(f.label + " " + " ".join(fd.synonyms if fd else ()))
        s = len(words & terms)
        if s > score:
            best, score = f, s
    if best is not None and score > 0:
        return ChatAnswer(answer=_describe_field(state, best), citations=[_field_cite(best)])

    # Issue lookup by keyword overlap
    overlap = lambda i: len(words & _words(i.title + " " + i.description))  # noqa: E731
    ranked = sorted(state.issues, key=lambda i: -overlap(i))
    if ranked and overlap(ranked[0]):
        top = [i for i in ranked[:2] if overlap(i) == overlap(ranked[0])]
        parts = []
        for i in top:
            text = f"{i.title}. {i.description}"
            if i.suggestion:
                text += f" Suggested fix: {i.suggestion}"
            parts.append(text)
        return ChatAnswer(answer=" ".join(parts), citations=[_issue_cite(i) for i in top])

    return ChatAnswer(answer="I can answer from this brief's own data: field values and where they came from, open findings, "
                             "missing information and who needs to decide. Try one of these.",
                      suggestions=SUGGESTIONS)


def _field_words() -> set[str]:
    out: set[str] = set()
    for fd in FIELDS:
        out |= _words(fd.label + " " + " ".join(fd.synonyms))
    return out - {"information", "list", "statement", "name", "type", "panel"}


def _context(state: BriefState) -> str:
    fields = [
        {"key": f.key, "label": f.label, "value": f.value, "status": f.status,
         "sources": [src_label(s) for s in f.sources][:3],
         "other_values": sorted({f"{src_label(c.source)}: {c.value[:100]}" for c in f.candidates if c.value != f.value})[:3]}
        for f in state.fields if f.value or f.mandatory
    ]
    issues = [{"id": i.id, "title": i.title, "severity": i.severity, "kind": i.kind, "owner": i.owner,
               "state": i.state, "fields": i.fields, "detail": i.description[:300], "fix": (i.suggestion or "")[:200]}
              for i in state.issues]
    return json.dumps({"product": state.product_name, "market": state.market, "status": state.status,
                       "readiness": state.readiness.headline if state.readiness else None,
                       "fields": fields, "findings": issues}, ensure_ascii=False)


def answer(state: BriefState, question: str, history: List[ChatTurn]) -> ChatAnswer:
    model = get_llm("chat")
    if model.enabled:
        try:
            convo = "\n".join(f"{t.role.upper()}: {t.text[:600]}" for t in history[-6:])
            prompt = (
                "You help a brand manager with one packaging design brief. Answer ONLY from the BRIEF JSON below; "
                "if the brief does not contain the answer, say so plainly. Never invent values, regulations or sources. "
                "Be concise (at most 120 words), plain English, no markdown headings.\n"
                'Return JSON only: {"answer": "...", "fields": ["<field key>"], "findings": ["<finding id>"]}\n\n'
                f"BRIEF:\n{_context(state)}\n\nCONVERSATION SO FAR:\n{convo}\n\nQUESTION: {question}"
            )
            data = model.json(prompt)
            text = str((data or {}).get("answer") or "").strip()
            if text:
                fkeys = {f.key: f for f in state.fields}
                ikeys = {i.id: i for i in state.issues}
                cites = [_field_cite(fkeys[k]) for k in (data.get("fields") or []) if k in fkeys][:6]
                cites += [_issue_cite(ikeys[k]) for k in (data.get("findings") or []) if k in ikeys][:6]
                return ChatAnswer(answer=text[:1200], citations=cites)
        except (LLMError, Exception) as err:  # the brief must stay answerable without the provider
            logger.warning("Chat provider failed, using deterministic answer: %s", err)
    return answer_deterministic(state, question)
