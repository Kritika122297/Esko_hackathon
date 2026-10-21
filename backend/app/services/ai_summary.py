"""AI overview for the exported brief: a short summary and a few notes for the designer.

The AI only words what the brief already says. Code then checks it: a sentence with a number that does not
appear in the brief is dropped, so a figure in the export always traces back to the files or a decision.
Results are cached per brief version, so repeated downloads cost no extra tokens.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Dict, List, Optional, Tuple

from app.services.designer import BriefSummary, DesignerBrief
from app.services.llm import chain

logger = logging.getLogger(__name__)

_cache: Dict[Tuple[str, str], Optional[BriefSummary]] = {}
_NUM = re.compile(r"\d+(?:[.,]\d+)?")


def _context(b: DesignerBrief) -> str:
    todo = [{"action": i.action, "item": i.item, "do": i.instruction[:140], "now": (i.current or "")[:80],
             "new": (i.new or "")[:80]} for i in b.items if i.action != "keep"]
    return json.dumps({
        "product": b.product, "market": b.market, "adapted_from_market": b.source_market, "case": b.case,
        "status": b.status,
        "readiness": {"score": b.readiness.score, "ready": b.readiness.ready, "headline": b.readiness.headline} if b.readiness else None,
        "keep_count": sum(1 for i in b.items if i.action == "keep"),
        "to_do": todo[:25],
        "open_questions": [{"q": q.question, "owner": q.owner} for q in b.open_questions][:15],
        "decisions": [{"q": d.question[:100], "a": d.answer[:100]} for d in b.decisions][-10:],
        "copy": {c.label: (c.value or "not provided")[:100] for c in b.final_copy},
    }, ensure_ascii=False, separators=(",", ":"))


PROMPT = (
    "You write the opening overview of a packaging design brief that goes to a design agency and the brand team. "
    "Use ONLY the BRIEF JSON below. Do not add values, claims, rules or numbers that are not in it.\n"
    "Write:\n"
    "1. summary: 3 to 4 plain sentences. What the job is, how ready the brief is, the most important changes, "
    "and what is still waiting on whom.\n"
    "2. designer_notes: 2 or 3 short practical notes for the designer (one sentence each), e.g. what to lay out "
    "first, where to leave space for copy still to come, what must not be changed. Only notes the brief supports.\n"
    "Friendly, clear, no jargon, no markdown.\n"
    'Return JSON only: {"summary": "...", "designer_notes": ["...", "..."]}\n\nBRIEF:\n'
)


def _sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def _grounded(text: str, context: str) -> bool:
    """Every number the AI wrote must appear in the brief."""
    known = {n.replace(",", ".") for n in _NUM.findall(context)}
    return all(n.replace(",", ".") in known for n in _NUM.findall(text))


def check(data, context: str) -> Optional[Tuple[str, List[str]]]:
    if not isinstance(data, dict):
        return None
    summary = " ".join(s for s in _sentences(str(data.get("summary") or "")) if _grounded(s, context))
    notes = [str(n).strip() for n in (data.get("designer_notes") or []) if isinstance(n, str)]
    notes = [n for n in notes if n and _grounded(n, context)][:3]
    return (summary[:900], [n[:240] for n in notes]) if summary else None


def summarize(sid: str, version: str, brief: DesignerBrief) -> Optional[BriefSummary]:
    key = (sid, version)
    if key in _cache:
        return _cache[key]
    context = _context(brief)
    result: Optional[BriefSummary] = None
    for model in chain("chat"):
        try:
            checked = check(model.json(PROMPT + context, temperature=0.3), context)
        except Exception as err:  # the export must work without the provider
            logger.warning("Brief summary via %s/%s failed: %s", model.provider, model.model, str(err)[:160])
            continue
        if checked:
            result = BriefSummary(summary=checked[0], designer_notes=checked[1], model=model.model)
            break
    if result is not None:  # a failure is not cached, so the next download tries again
        _cache[key] = result
    return result
