"""AI rule review: match the brief's facts against the guideline clauses for this market.

Text only. The model sees the facts, the relevant clauses and what code already found.
Code validates every answer before it is used:
* a finding must cite a clause id that was shown to the model;
* it must cite existing brief fields and quote text that really is in them;
* it is always 'needs human check' and never blocking.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from app.models.brief import BriefState, Issue
from app.services.checks import CheckContext
from app.services.guidelines import Clause, canonical_clause, clauses_for
from app.services.llm import get_llm
from app.services.values import norm_text

OWNERS = {"Legal", "R&D", "Brand", "Agency", "Supply Chain"}
MAX_FINDINGS = 6
MIN_CONFIDENCE = 0.85  # a doubtful point is a false alarm waiting to happen; drop it


def _words(text: str) -> set:
    return {w for w in re.findall(r"[a-z]{4,}", text.lower())}


def relevant_clauses(state: BriefState, limit: int = 12) -> List[Clause]:
    """Keyword match between the clause and the brief text; no vector database needed."""
    clauses = clauses_for(state.market, state.category, state.standards or None) + list(state.company_clauses)
    corpus = " ".join((f.value or "") for f in state.fields).lower()
    scored = []
    for c in clauses:
        hits = sum(1 for k in c.keywords if k.lower() in corpus)
        scored.append((hits, c))
    scored.sort(key=lambda t: -t[0])
    return [c for _, c in scored[:limit]]


def build_prompt(state: BriefState, clauses: List[Clause]) -> str:
    facts = "\n".join(f"- {f.key}: {f.value}" for f in state.fields if f.value)
    rules = "\n".join(f"- [{c.id}] {c.text}" for c in clauses)
    known = "\n".join(f"- {i.title}" for i in state.issues) or "- none"
    return (
        f"You review a packaging brief for the {state.market} market against the label rules below.\n"
        "List up to 6 ADDITIONAL problems or open questions that are not already found. Only use the rules given; "
        "do not invent rules. Do not do arithmetic (code handles math). Report only a concrete problem you can see in "
        "the facts; never report that something 'could not be verified' or 'may' be wrong. Barcode digits, unit "
        "conversion and numeric checks are done by code, so skip them. Fewer, certain items beat many doubtful ones. "
        "Each item must cite one rule id, the field "
        "keys involved and quote the exact text from the facts it is about.\n"
        'Return JSON only: {"findings":[{"clause":"<rule id>","title":"<5-9 word title>",'
        '"description":"<one sentence: what is wrong and why>","fields":["<key>"],'
        '"quote":"<text copied exactly from a fact value, without the key name>",'
        '"question":"<one plain question for the owner>","confidence":<0.0-1.0, how sure this is a real violation>,"owner":"Legal|R&D|Brand|Agency|Supply Chain"}]}\n\n'
        f"RULES:\n{rules}\n\nFACTS:\n{facts}\n\nALREADY FOUND BY CODE:\n{known}"
    )


def quote_found(quote: str, keys: List[str], values: Dict[str, str]) -> bool:
    """The quote must really be in the cited fields. Models often write 'key: value'; the key names are removed
    and every remaining piece must still be found in one of the cited values."""
    pattern = r"(?:^|[;\n])\s*(?:" + "|".join(re.escape(k) for k in values) + r")\s*:\s*"
    pieces = [p.strip(" ;\n\"'") for p in re.split(pattern, quote) if p.strip(" ;\n\"'")]
    if not pieces:
        return False
    return all(any(norm_text(p) in norm_text(values[k]) for k in keys) for p in pieces)


def validate_findings(data: Any, state: BriefState, clauses: List[Clause]) -> List[Issue]:
    """Keep only findings that cite a shown clause and fields, and quote text really in those fields."""
    by_id: Dict[str, Clause] = {c.id: c for c in clauses}
    values = {f.key: f.value for f in state.fields if f.value}
    out: List[Issue] = []
    items = data.get("findings") if isinstance(data, dict) else None
    for c in (items or [])[:MAX_FINDINGS]:
        if not isinstance(c, dict):
            continue
        try:
            confidence = float(c.get("confidence") if c.get("confidence") is not None else 1.0)
        except (TypeError, ValueError):
            confidence = 0.0
        if confidence < MIN_CONFIDENCE:
            continue
        cid, quote = canonical_clause(str(c.get("clause") or "")), str(c.get("quote") or "")
        keys = [k for k in c.get("fields") or [] if k in values]
        if cid not in by_id or not keys or not quote:
            continue
        if not quote_found(quote, keys, values):
            continue
        label = state.field(keys[0]).label
        asked = str(c.get("question") or "").strip()
        title = str(c.get("title") or "").strip()[:120] or asked[:100] or f"{label}: check against {cid}"
        slug = re.sub(r"[^a-z0-9]+", "-", f"{cid}-{keys[0]}-{title}".lower()).strip("-")[:70]
        question = str(c.get("question") or "").strip()[:200]
        out.append(Issue(
            id=f"ai:rule:{slug}", check="ai.rules", severity="warning", kind="needs_human", category="ai_review",
            title=title,
            description=((str(c.get("description") or "").strip() or asked)[:500] + f" (Rule {cid}: {by_id[cid].text}) "
                         f"(Quoted: '{quote[:120]}')").strip(),
            suggestion=question or None,
            fields=keys, evidence=[s for k in keys for s in state.field(k).sources[:1]],
            owner=c.get("owner") if c.get("owner") in OWNERS else by_id[cid].requires[0].owner
            if by_id[cid].requires else "Legal",
            detected_by="ai", clauses=[cid],
        ))
    return out


def rule_review(state: BriefState, saved: CheckContext) -> int:
    clauses = relevant_clauses(state)
    if not clauses:
        return 0
    model = get_llm("rules")
    if not model.enabled:
        return 0
    found = validate_findings(model.json(build_prompt(state, clauses)), state, clauses)
    saved.ai_issues.extend(found)
    return len(found)
