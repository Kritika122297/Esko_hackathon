"""Brief chat: a conversational assistant that knows one brief.

With an AI provider it talks naturally and answers general questions too (packaging, labelling,
how to use the tool, small talk), but anything it says about this product must come from the brief,
and every citation is checked by code against the brief. Without a provider, or when every provider
fails, a deterministic answerer covers the common brief questions and says plainly what it cannot do.

The assistant can also prepare changes ("set the net weight to ...", "accept the suggested answers"). It only
proposes them: code validates each one against the brief and previews its impact, and nothing changes until a
person presses Apply (see app/routers/chat_actions.py).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.brief import BriefField, BriefState, Issue
from app.services.catalog import FIELD_BY_KEY, FIELDS
from app.services.checks.base import src_label
from app.services.llm import LLM, LLMError, chain
from app.services.values import plural

logger = logging.getLogger(__name__)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class Citation(BaseModel):
    kind: Literal["field", "issue"]
    key: str
    label: str


Scope = Literal["brief", "general", "both"]
ActionType = Literal["edit_field", "answer_question", "not_applicable", "pass_to_agency", "undo"]


class ActionImpact(BaseModel):
    """What applying the action would do, computed by code on a copy of the brief."""

    resolved: List[str] = Field(default_factory=list)
    introduced: List[str] = Field(default_factory=list)
    readiness_before: int = 0
    readiness_after: int = 0
    blocking_before: int = 0
    blocking_after: int = 0


class ChatAction(BaseModel):
    """A change the assistant prepared. It runs only when a person applies it."""

    id: str
    type: ActionType
    params: Dict[str, str] = Field(default_factory=dict)
    label: str
    detail: Optional[str] = None
    impact: Optional[ActionImpact] = None
    status: Literal["proposed", "applied", "cancelled", "failed"] = "proposed"
    result: Optional[str] = None


class ChatAnswer(BaseModel):
    answer: str
    scope: Scope = Field("brief", description="brief: from this brief's data; general: general knowledge; both: a mix")
    citations: List[Citation] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    actions: List[ChatAction] = Field(default_factory=list)
    # Raw proposals from the AI or the command parser; validated into `actions` by the router, never sent out.
    proposals: List[Dict[str, Any]] = Field(default_factory=list, exclude=True)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str
    at: str
    scope: Scope = "brief"
    citations: List[Citation] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    actions: List[ChatAction] = Field(default_factory=list)


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

    # Small talk
    if re.fullmatch(r"\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|thanks|thank you|cheers|ok|okay)[\s!.,?]*(there|you)?[\s!.,?]*", q):
        thanks = q.strip().startswith(("thank", "cheers"))
        return ChatAnswer(answer="You're welcome." if thanks else "Hello. What would you like to know about this brief?",
                          suggestions=[] if thanks else SUGGESTIONS[:3])

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
    if ranked and overlap(ranked[0]) >= 2:  # one shared word is too weak a match to answer with
        top = [i for i in ranked[:2] if overlap(i) == overlap(ranked[0])]
        parts = []
        for i in top:
            text = f"{i.title}. {i.description}"
            if i.suggestion:
                text += f" Suggested fix: {i.suggestion}"
            parts.append(text)
        return ChatAnswer(answer=" ".join(parts), citations=[_issue_cite(i) for i in top])

    return ChatAnswer(answer="The AI assistant is not available right now, so I can only answer questions about this brief's own "
                             "data: field values and where they came from, open findings, missing information and who needs "
                             "to decide. Try one of these, or ask again in a minute.",
                      suggestions=SUGGESTIONS)


def _field_words() -> set[str]:
    out: set[str] = set()
    for fd in FIELDS:
        out |= _words(fd.label + " " + " ".join(fd.synonyms))
    return out - {"information", "list", "statement", "name", "type", "panel"}


def _context(state: BriefState) -> str:
    """The brief, compact enough to send with every message (free-tier providers limit tokens per minute)."""
    fields = []
    for f in state.fields:
        if not (f.value or f.mandatory):
            continue
        row = {"key": f.key, "value": (f.value or "")[:120] or None, "status": f.status}
        if f.sources:
            row["from"] = src_label(f.sources[0])
        if f.status == "needs_review":
            row["other_values"] = sorted({f"{src_label(c.source)}: {c.value[:80]}" for c in f.candidates if c.value != f.value})[:2]
        if f.not_applicable:
            row["not_applicable"] = True
        fields.append(row)
    issues = []
    for i in state.issues:
        if i.state == "open" and i.resolution == "data" and i.severity == "blocking":
            issues.append({"id": i.id, "title": i.title, "severity": i.severity, "owner": i.owner,
                           "detail": i.description[:140], "fix": (i.suggestion or "")[:80]})
        elif i.state == "open" and i.resolution == "data":
            issues.append({"id": i.id, "title": i.title, "severity": i.severity, "owner": i.owner})
        else:
            issues.append({"id": i.id, "title": i.title, "state": i.state, "resolution": i.resolution})
    answered = [{"q": a.question[:120], "a": a.answer[:120]} for a in state.answered_questions[-10:]]
    return json.dumps({"product": state.product_name, "market": state.market, "category": state.category,
                       "status": state.status, "readiness": state.readiness.headline if state.readiness else None,
                       "fields": fields, "findings": issues, "open_questions": [q.question for q in state.questions][:12],
                       "answered_questions": answered}, ensure_ascii=False, separators=(",", ":"))


PROMPT = (
    "You are the assistant built into BriefForge, a tool that turns packaging artwork and content sheets into "
    "design briefs. You are talking with someone on a packaging team (brand, R&D, legal, supply chain or the "
    "design agency).\n"
    "Talk naturally, like a knowledgeable, friendly colleague. Answer whatever they ask: small talk, general "
    "questions, packaging and label design, print production, food labelling rules in general, how to use "
    "BriefForge, or anything else. Use your general knowledge for those, and do not steer every reply back to "
    "the product.\n"
    "One firm rule: anything you say about THIS product (its values, claims, ingredients, findings, decisions, "
    "readiness) must come from the BRIEF JSON below. Never guess or invent a value for this product; if the "
    "brief does not contain it, say so. When you give general regulatory information, present it as general "
    "guidance and suggest confirming it against the current rules or with Legal.\n"
    "Keep replies conversational and short: usually one to four sentences, up to about 180 words when "
    "explaining something. Plain text; a short list with '- ' is fine when it helps. In a list give at most five "
    "items, most important first, then say how many more there are. Never repeat a point. No headings, no "
    "markdown bold.\n"
    'Return JSON only: {"answer": "...", "scope": "brief" | "general" | "both", "fields": ["<field key>"], '
    '"findings": ["<finding id>"]}. Use scope "general" when the answer does not use the brief. List field keys '
    "and finding ids only when your answer relies on them."
)


ACTION_WORDS = re.compile(
    r"\b(set|change|update|make|correct|fix|replace|edit|fill|answer|accept|apply|use|choose|pick|confirm|mark|"
    r"pass|send|hand|undo|revert|remove|clear|resolve)\b", re.I)


def wants_action(text: str) -> bool:
    """Whether the message asks for a change (so the action instructions and question options are sent)."""
    return bool(ACTION_WORDS.search(text or ""))


ACTION_PROMPT = (
    "\nThe user may ask you to CHANGE the brief. You cannot change it yourself: you PROPOSE actions and the "
    "user applies them with a button. Propose only what they asked for, at most 8 actions, using only these "
    "types and only field keys, question ids, option ids and finding ids from the brief and the OPEN QUESTIONS "
    "below:\n"
    '- {"type":"edit_field","field":"<field key>","value":"<new value, written exactly as it should print>"}\n'
    '- {"type":"answer_question","question":"<question id>","option":"<option id>"} or with "value":"<typed '
    'answer>" instead of "option", or "kind":"unknown" (pass it on), or "kind":"not_applicable" with "reason"\n'
    '- {"type":"not_applicable","field":"<field key>","reason":"<why it does not apply>"} (only for an empty field)\n'
    '- {"type":"pass_to_agency","finding":"<finding id>","note":"<optional note>"}\n'
    '- {"type":"undo","field":"<field key>"}\n'
    "Never invent a value for a regulated field (nutrition, ingredients, allergens, net weight, claims): use the "
    "value the user gave, an option listed for the question, or ask them. If the request is unclear, ask a short "
    "question and propose nothing. In \"answer\", say in one or two sentences what you prepared and that it "
    "changes nothing until they press Apply. Add \"actions\": [ ... ] to the JSON.\n"
)


def _action_context(state: BriefState) -> str:
    qs = [{"id": q.id, "owner": q.owner, "question": q.question[:110],
           "options": {o.id: o.label[:70] for o in q.options}, "typed_answer_field": q.custom_field}
          for q in state.questions[:20]]
    return json.dumps(qs, ensure_ascii=False, separators=(",", ":"))


def _norm(t: str) -> str:
    return " ".join(re.findall(r"[a-z0-9%]+", (t or "").lower()))


def find_field(state: BriefState, name: str) -> Optional[BriefField]:
    """A field named by its label, key or a synonym ('net weight', 'net_weight', 'serving size')."""
    n = _norm(name).removeprefix("the ")
    if not n:
        return None
    for f in state.fields:
        fd = FIELD_BY_KEY.get(f.key)
        names = {_norm(f.label), _norm(f.key.replace("_", " "))} | {_norm(x) for x in (fd.synonyms if fd else ())}
        if n in names:
            return f
    # Every word of a label present, longest label first ('total fat %dv' before 'total fat').
    words = set(n.split())
    hits = [f for f in state.fields if set(_norm(f.label).split()) <= words]
    return max(hits, key=lambda f: len(f.label)) if hits else None


OWNER_NAMES = {"r&d": "R&D", "rnd": "R&D", "r and d": "R&D", "research": "R&D", "legal": "Legal", "brand": "Brand",
               "agency": "Agency", "supply chain": "Supply Chain", "supply": "Supply Chain"}


def _owner_in(text: str) -> Optional[str]:
    low = text.lower()
    return next((v for k, v in OWNER_NAMES.items() if re.search(rf"\b{re.escape(k)}\b", low)), None)


def propose_deterministic(state: BriefState, text: str) -> Optional[ChatAnswer]:
    """Common change requests without the AI. Returns None when the message is not one of them."""
    t = text.strip().rstrip(".!")
    low = t.lower()
    nothing = "Nothing changes until you press Apply."

    m = re.match(r"^(?:please\s+)?(?:mark|set|make)\s+(?:the\s+)?(.+?)\s+(?:as\s+)?(?:not\s+applicable|n/?a)"
                 r"(?:\s*(?:because|as|since|:|-)\s*(.+))?$", t, re.I)
    if m:
        f = find_field(state, m.group(1))
        if f is None:
            return ChatAnswer(answer=f"I could not find a field called '{m.group(1)}'.")
        if not m.group(2):
            return ChatAnswer(answer=f"Why does {f.label.lower()} not apply? Say, for example: mark {f.label.lower()} as "
                                     "not applicable because the product is unsweetened.")
        return ChatAnswer(answer=f"I prepared this. {nothing}",
                          proposals=[{"type": "not_applicable", "field": f.key, "reason": m.group(2).strip()}])

    m = re.match(r"^(?:please\s+)?(?:set|change|update|make|correct|fix|replace)\s+(?:the\s+)?(.+?)\s+(?:to|=|with)\s+"
                 r"[\"'“]?(.+?)[\"'”]?$", t, re.I)
    if m:
        f = find_field(state, m.group(1))
        if f is None:
            return ChatAnswer(answer=f"I could not find a field called '{m.group(1)}'. Name it as it appears in the workbench.")
        return ChatAnswer(answer=f"I prepared this change. {nothing}",
                          proposals=[{"type": "edit_field", "field": f.key, "value": m.group(2).strip()}])

    m = re.match(r"^(?:please\s+)?(?:undo|revert)\s+(?:the\s+)?(?:last\s+)?(?:change\s+(?:to|on|of)\s+)?(?:the\s+)?(.+)$", t, re.I)
    if m:
        f = find_field(state, m.group(1))
        if f is None:
            return ChatAnswer(answer=f"I could not find a field called '{m.group(1)}'.")
        return ChatAnswer(answer=f"I prepared the undo. {nothing}", proposals=[{"type": "undo", "field": f.key}])

    if re.search(r"\b(pass|send|hand)\b.*\bagency\b", low):
        owner = _owner_in(low.split("agency")[0])
        qs = [q for q in state.questions if owner is None or q.owner == owner]
        if not qs:
            return ChatAnswer(answer=f"There are no open questions{f' for {owner}' if owner else ''} to pass on.")
        props = [{"type": "answer_question", "question": q.id, "kind": "unknown"} for q in qs[:8]]
        more = f" The first 8 of {len(qs)} are prepared; ask again for the rest." if len(qs) > 8 else ""
        return ChatAnswer(answer=f"I prepared {plural(len(props), 'question')} to pass to the agency as open "
                                 f"questions.{more} {nothing}", proposals=props)

    if re.search(r"\b(accept|apply|use|take)\b.*\bsuggest", low):
        owner = _owner_in(low)
        qs = [q for q in state.questions if (owner is None or q.owner == owner) and any(o.recommended for o in q.options)]
        if not qs:
            return ChatAnswer(answer="No open question has a suggested answer" + (f" for {owner}." if owner else "."))
        props = [{"type": "answer_question", "question": q.id, "option": next(o.id for o in q.options if o.recommended)}
                 for q in qs[:8]]
        return ChatAnswer(answer=f"I prepared the suggested answer for {plural(len(props), 'question')}. Each one was "
                                 f"calculated by code from your files. {nothing}", proposals=props)
    return None


def _models() -> List[LLM]:
    """The chat model first, then every other configured connection as a fallback."""
    return chain("chat")


def answer(state: BriefState, question: str, history: List[ChatTurn]) -> ChatAnswer:
    acting = wants_action(question)
    if acting:
        # A plain command is handled by code: faster, free, and exact. The AI handles everything else.
        direct = propose_deterministic(state, question)
        if direct is not None and direct.proposals:
            return direct
    models = _models()
    if models:
        convo = "\n".join(f"{t.role.upper()}: {t.text[:500]}" for t in history[-8:]) or "(none)"
        extra = f"{ACTION_PROMPT}\nOPEN QUESTIONS:\n{_action_context(state)}" if acting else ""
        prompt = (f"{PROMPT}{extra}\n\nBRIEF:\n{_context(state)}\n\nCONVERSATION SO FAR:\n{convo}\n\n"
                  f"USER: {question}")
        for model in models:
            try:
                data = model.json(prompt, temperature=0.5)
            except (LLMError, Exception) as err:  # the brief must stay answerable without the provider
                logger.warning("Chat provider %s/%s failed: %s", model.provider, model.model, str(err)[:160])
                continue
            text = str((data or {}).get("answer") or "").strip() if isinstance(data, dict) else ""
            if not text:
                continue
            fkeys = {f.key: f for f in state.fields}
            ikeys = {i.id: i for i in state.issues}
            cites = [_field_cite(fkeys[k]) for k in (data.get("fields") or []) if isinstance(k, str) and k in fkeys][:6]
            cites += [_issue_cite(ikeys[k]) for k in (data.get("findings") or []) if isinstance(k, str) and k in ikeys][:6]
            scope = data.get("scope") if data.get("scope") in ("brief", "general", "both") else ("both" if cites else "general")
            if cites and scope == "general":
                scope = "both"
            props = [a for a in (data.get("actions") or []) if isinstance(a, dict)][:8] if acting else []
            return ChatAnswer(answer=text[:2000], scope="brief" if props else scope, citations=cites, proposals=props)
        logger.warning("Every chat provider failed; using the deterministic answer.")
    if acting:
        direct = propose_deterministic(state, question)
        if direct is not None:
            return direct
    return answer_deterministic(state, question)
