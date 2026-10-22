"""Agency Simulator: would a packaging studio accept this brief as it is?

Deterministic first, AI second:
1. Ten code checks look at the brief as a prepress operator would (copy on panels, net quantity, information panel,
   barcode, allergens, type sizes, open decisions, serving units, language, print spec).
2. The score and status come only from those checks, by code.
3. An AI "prepress operator" then lists what it still cannot tell from the brief. Its answer is checked against a
   schema, anything that repeats a code check is dropped, and numbers in its summary must appear in the brief.
   If the AI is unavailable the report is returned without it, flagged llm_unavailable.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Callable, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field

from app.models.brief import BriefState
from app.models.extraction import Extraction
from app.services.ai_summary import _grounded
from app.services.blueprint import Blueprint, build_blueprint, symbology
from app.services.checks.market import upc_check_digit_ok
from app.services.designer import DesignerBrief, build_designer_brief
from app.services.llm import chain
from app.services.market_gap import _profile
from app.services.values import amounts

logger = logging.getLogger(__name__)

Severity = Literal["blocking", "warning", "info"]
Status = Literal["READY_FOR_STUDIO", "CHANGES_REQUIRED", "BLOCKED"]
WEIGHT = {"blocking": 3, "warning": 2, "info": 0}  # info = not applicable here; it does not count


class Check(BaseModel):
    id: str
    name: str
    passed: bool
    severity: Severity
    detail: str
    suggestion: Optional[str] = None
    clause_id: Optional[str] = None


class Ambiguity(BaseModel):
    topic: str
    question: str
    panel: Optional[str] = None


class SimulatorReport(BaseModel):
    product: str
    market: str
    category: str
    score: int
    status: Status
    checks: List[Check]
    ambiguities: List[Ambiguity] = Field(default_factory=list)
    designer_summary: str
    llm_unavailable: bool = False
    model: Optional[str] = None


# ---------------------------------------------------------------- language (code, not AI)

STOPWORDS = {
    "en": {"the", "and", "of", "with", "for", "contains", "may", "store", "in", "a", "ingredients", "made", "from"},
    "fr": {"et", "de", "la", "le", "les", "avec", "pour", "contient", "peut", "ingrédients", "des", "du", "au"},
    "de": {"und", "der", "die", "das", "mit", "für", "enthält", "kann", "zutaten", "aus", "von"},
    "es": {"y", "el", "los", "las", "con", "para", "contiene", "puede", "ingredientes", "del"},
    "it": {"e", "il", "di", "con", "per", "contiene", "può", "ingredienti", "della", "dei"},
    "nl": {"en", "van", "het", "met", "voor", "bevat", "kan", "ingrediënten", "een"},
}
NAMES = {"en": "English", "fr": "French", "de": "German", "es": "Spanish", "it": "Italian", "nl": "Dutch", "hi": "Hindi"}


def detect_language(text: str) -> Optional[str]:
    """The language most of the copy is in, from common words. None when the copy is too short to tell."""
    if re.search(r"[ऀ-ॿ]", text or ""):
        return "hi"
    words = re.findall(r"[a-zà-ÿ]+", (text or "").lower())
    scores = {lang: sum(1 for w in words if w in stop) for lang, stop in STOPWORDS.items()}
    best = max(scores, key=scores.get)
    ranked = sorted(scores.values(), reverse=True)
    return best if ranked[0] >= 3 and ranked[0] >= 1.5 * max(ranked[1], 1) else None


# ---------------------------------------------------------------- the checks


def _open(state: BriefState, *prefixes: str) -> List[str]:
    return [i.title for i in state.issues if i.state == "open" and i.resolution == "data"
            and any(i.check.startswith(p) for p in prefixes)]


def _na(cid: str, name: str, why: str) -> Check:
    return Check(id=cid, name=name, passed=True, severity="info", detail=why)


def check_copy_on_panels(state: BriefState, brief: DesignerBrief, bp: Blueprint) -> Check:
    name = "Copy assigned to panels"
    if bp.generic:
        return Check(id="copy_on_panels", name=name, passed=False, severity="warning",
                     detail="No dieline was read, so copy sits on a generic layout.",
                     suggestion="Add the dieline (artwork PDF) or tell the agency which panel carries each copy block.")
    # Kept items are already on the pack (often as a logo); only new or changed copy needs a place.
    loose = [i.item for i in brief.items if i.action in ("change", "add") and not i.panel]
    return Check(id="copy_on_panels", name=name, passed=not loose, severity="warning",
                 detail="Every new or changed copy block has a panel." if not loose else "No panel for: " + ", ".join(loose[:6]) +
                        (f" and {len(loose) - 6} more" if len(loose) > 6 else "") + ".",
                 suggestion=None if not loose else "Say on which panel each of these goes.")


def check_net_quantity(state: BriefState, brief, bp) -> Check:
    name, value, m = "Net quantity: units and placement", state.value("net_weight"), state.market.upper()
    cid = {"US": "US-FDA/21CFR101.7", "IN": "IN-LM/declarations"}.get(m, "EU-1169/Art23" if m in {"EU", "FR", "DE", "ES", "IT", "NL"} else None)
    if not value:
        return Check(id="net_quantity", name=name, passed=False, severity="blocking", detail="No net quantity in the brief.",
                     suggestion="Provide the net quantity.", clause_id=cid)
    units = {u for _, u in amounts(value)}
    problems = []
    if m == "US" and not units & {"oz", "lb", "fl oz"}:
        problems.append("US packs need ounces (or fl oz) as well as metric")
    if not units & {"g", "kg", "ml", "l"}:
        problems.append("no metric unit")
    zone = next((o for o in bp.overlays if o.kind == "zone"), None)
    where = (f" Place it in the {zone.text.lower()} ({zone.citation})." if zone and not zone.exempt else "")
    return Check(id="net_quantity", name=name, passed=not problems, severity="blocking", clause_id=cid,
                 detail=f"'{value}'" + (": " + "; ".join(problems) + "." if problems else " has the units this market needs.")
                        + where,
                 suggestion="Correct the net quantity statement and keep it in the bottom 30% of the front panel."
                 if problems and m == "US" else ("Correct the net quantity statement." if problems else None))


def check_info_panel(state: BriefState, brief, bp: Blueprint) -> Check:
    name = "Information panel grouping"
    group = next((o for o in bp.overlays if o.kind == "group"), None)
    if group is None:
        return _na("info_panel", name, f"No information-panel rule is loaded for {state.category} in {state.market}.")
    if group.ok is None:
        return Check(id="info_panel", name=name, passed=False, severity="warning", detail="Panel positions are not known.",
                     suggestion="Place nutrition, ingredients, allergens and the address together on one panel.",
                     clause_id=group.clause_id)
    return Check(id="info_panel", name=name, passed=bool(group.ok), severity="blocking", clause_id=group.clause_id,
                 detail=("Nutrition, ingredients, allergens and address are on one panel." if group.ok else
                         f"They are split across panels ({group.citation} wants them together, nothing in between)."),
                 suggestion=None if group.ok else "Move them onto the information panel, next to each other.")


def check_barcode(state: BriefState, brief, bp: Blueprint) -> Check:
    name, code = "Barcode symbology and quiet zone", state.value("barcode")
    if not code:
        return Check(id="barcode", name=name, passed=False, severity="warning", detail="No barcode number in the brief.",
                     suggestion="Supply Chain to provide the registered GTIN.")
    problems = []
    if upc_check_digit_ok(code) is not True:
        problems.append("the number is not a valid GTIN")
    sym = symbology(state)
    if not sym:
        problems.append("the symbology (UPC-A, EAN-13) is not stated")
    qz = next((o for o in bp.overlays if o.kind == "quiet_zone"), None)
    if not (qz and qz.ok):
        problems.append("the quiet zone is not specified")
    return Check(id="barcode", name=name, passed=not problems, severity="warning",
                 detail=(f"{sym}, {qz.text}." if not problems else "Barcode: " + "; ".join(problems) + "."),
                 suggestion=None if not problems else "Add the symbology and size under 'Barcode symbology and size'.")


def check_allergens(state: BriefState, brief, bp: Blueprint) -> Check:
    name = f"Allergen formatting for {state.market}"
    if state.category not in ("food", "pet_food"):
        return _na("allergens", name, "Allergen labelling rules apply to food.")
    open_ = _open(state, "allergen.")
    if open_:
        return Check(id="allergens", name=name, passed=False, severity="blocking", detail="Open: " + "; ".join(open_[:3]) + ".",
                     suggestion="Answer the allergen questions first.")
    emph = next((o for o in bp.overlays if o.kind == "emphasis"), None)
    if emph:
        return Check(id="allergens", name=name, passed=True, severity="blocking", clause_id=emph.clause_id,
                     detail="Allergen copy is settled. In artwork: " + emph.text)
    if not state.value("allergen_statement") and state.market.upper() == "US":
        return Check(id="allergens", name=name, passed=False, severity="blocking", detail="No allergen statement.",
                     suggestion="Add the 'Contains:' statement.", clause_id="US-FDA/FALCPA-403w")
    return Check(id="allergens", name=name, passed=True, severity="blocking", detail="Allergen copy is settled.")


def check_type_sizes(state: BriefState, brief, bp: Blueprint) -> Check:
    name = "Type sizes can be worked out"
    area_rules = [s for s in bp.type_specs if "PDP" in s.basis or "Dimensions needed" in s.basis or "Largest surface" in s.basis
                  or "Panel size needed" in s.basis]
    if not area_rules:
        return _na("type_sizes", name, "No type-size rule based on panel size is loaded for this market and category.")
    if bp.dimensions and bp.dimensions.source == "brief":
        return Check(id="type_sizes", name=name, passed=True, severity="warning",
                     detail=f"Front panel {bp.dimensions.area_sq_in} sq in from the brief; minimum heights are set.")
    detail = ("Dimensions needed: the front panel size is only estimated from the dieline "
              f"({bp.dimensions.area_sq_in} sq in at 100% scale)." if bp.dimensions else "Dimensions needed: no front panel size.")
    return Check(id="type_sizes", name=name, passed=False, severity="warning", detail=detail,
                 suggestion="Enter 'Front panel (PDP) size' in the workbench, for example 190 x 280 mm.")


def check_open_blocking(state: BriefState, brief, bp) -> Check:
    n = state.readiness.blocking_open if state.readiness else 0
    return Check(id="no_open_blocking", name="No open blocking questions", passed=n == 0, severity="blocking",
                 detail="Every blocking decision is made." if n == 0 else f"{n} blocking decision{'s' if n != 1 else ''} still open.",
                 suggestion=None if n == 0 else "Answer them on the Questions page, or pass them to the agency.")


def check_serving(state: BriefState, brief, bp) -> Check:
    name = "Serving size and units agree"
    if state.category != "food":
        return _na("serving", name, "Serving sizes apply to food.")
    open_ = _open(state, "math.servings", "us.serving_size_format", "math.mass")
    ss = state.value("serving_size")
    if not open_ and ss and not {u for _, u in amounts(ss)} & {"g", "ml"}:
        open_ = [f"serving size '{ss}' has no metric amount"]
    return Check(id="serving", name=name, passed=not open_, severity="warning",
                 detail="Serving size, servings and net quantity agree." if not open_ else "; ".join(open_[:3]) + ".",
                 suggestion=None if not open_ else "Settle the serving size question.")


def check_language(state: BriefState, brief, bp) -> Check:
    name = f"Label language matches {state.market}"
    prof = _profile(state.market.upper(), "language", state.category)
    if not prof or not prof.get("codes"):
        return _na("language", name, f"No language rule is loaded for {state.market}.")
    text = " ".join(state.value(k) or "" for k in ("statement_of_identity", "ingredients", "marketing_copy", "dietary_info",
                                                   "storage", "allergen_statement"))
    lang = detect_language(text)
    if lang is None:
        return Check(id="language", name=name, passed=False, severity="warning",
                     detail="The copy is too short to tell which language it is in.",
                     suggestion=f"Confirm the copy is in {prof['text']}.")
    ok = lang in prof["codes"]
    return Check(id="language", name=name, passed=ok, severity="blocking",
                 detail=f"The copy reads as {NAMES[lang]}; {state.market} needs {prof['text']}.",
                 suggestion=None if ok else f"Translate the copy into {prof['text']}.")


def check_print(state: BriefState, brief, bp) -> Check:
    spec = state.value("print_spec")
    return Check(id="print_spec", name="Colours and print process stated", passed=bool(spec), severity="warning",
                 detail=f"'{spec}'." if spec else "The brief does not say how the pack is printed.",
                 suggestion=None if spec else "Enter 'Print process and colours', for example: Flexo, CMYK + 1 Pantone, on white board.")


CHECKS: List[Callable[[BriefState, DesignerBrief, Blueprint], Check]] = [
    check_copy_on_panels, check_net_quantity, check_info_panel, check_barcode, check_allergens, check_type_sizes,
    check_open_blocking, check_serving, check_language, check_print,
]


def run_checks(state: BriefState, ex: Extraction) -> Tuple[List[Check], DesignerBrief, Blueprint]:
    brief = build_designer_brief(state, ex)
    bp = build_blueprint(state, ex, brief)
    return [c(state, brief, bp) for c in CHECKS], brief, bp


def score_and_status(checks: List[Check]) -> Tuple[int, Status]:
    """By code only: weighted share of passed checks; any failed blocking check blocks."""
    total = sum(WEIGHT[c.severity] for c in checks)
    passed = sum(WEIGHT[c.severity] for c in checks if c.passed)
    score = round(100 * passed / total) if total else 100
    if any(not c.passed and c.severity == "blocking" for c in checks):
        return score, "BLOCKED"
    if any(not c.passed for c in checks):
        return score, "CHANGES_REQUIRED"
    return score, "READY_FOR_STUDIO"


# ---------------------------------------------------------------- the AI pass

KEYWORDS = {  # an ambiguity about one of these is already covered by a code check
    "copy_on_panels": {"panel", "placement", "position"}, "net_quantity": {"net", "quantity", "weight", "ounce"},
    "info_panel": {"information", "contiguous"}, "barcode": {"barcode", "gtin", "upc", "ean", "quiet"},
    "allergens": {"allergen", "allergens"}, "type_sizes": {"dimension", "dimensions", "size", "height", "area"},
    "no_open_blocking": {"blocking", "unresolved"}, "serving": {"serving", "servings"},
    "language": {"language", "translation", "translate"}, "print_spec": {"print", "colour", "color", "pantone", "cmyk", "ink"},
}

PROMPT = (
    "You are a prepress operator at a packaging design studio. A brand sends you the design brief below. The code "
    "checks listed under CHECKS were already done; do not repeat them. List up to 6 things you still CANNOT tell from "
    "this brief and would have to ask before starting artwork (for example: which finish, which dieline version, "
    "logo files, image rights, proof process). Each must be a concrete question about this pack. Do not invent "
    "values or rules. Then write designer_summary: 2 or 3 plain sentences on whether the studio can start and what "
    "is missing. Use only numbers that appear below.\n"
    'Return JSON only: {"ambiguities":[{"topic":"<2-5 words>","question":"<one question>","panel":"<panel id or null>"}],'
    '"designer_summary":"..."}\n\n'
)


def _context(state: BriefState, brief: DesignerBrief, bp: Blueprint, checks: List[Check], score: int, status: str) -> str:
    return json.dumps({
        "product": state.product_name, "market": state.market, "category": state.category, "score": score, "status": status,
        "panels": [{"id": p.id, "role": p.role, "copy": p.items[:8]} for p in bp.panels if p.items],
        "to_do": [{"action": i.action, "item": i.item, "panel": i.panel} for i in brief.items if i.action != "keep"][:20],
        "specs": {"front_panel": bp.dimensions.text if bp.dimensions else None, "print": state.value("print_spec"),
                  "barcode": state.value("barcode_spec") or bp.symbology},
        "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in checks if c.severity != "info"],
    }, ensure_ascii=False, separators=(",", ":"))


def _words(t: str) -> set:
    return set(re.findall(r"[a-z]+", (t or "").lower()))


def validate_ambiguities(data, checks: List[Check], panels: set) -> List[Ambiguity]:
    items = data.get("ambiguities") if isinstance(data, dict) else None
    out: List[Ambiguity] = []
    for a in (items or [])[:10]:
        if not isinstance(a, dict) or not isinstance(a.get("question"), str) or not a["question"].strip():
            continue
        topic, question = str(a.get("topic") or "Open point")[:60].strip(), a["question"].strip()[:240]
        words = _words(topic + " " + question)
        if any(words & KEYWORDS.get(c.id, set()) for c in checks):
            continue  # a code check already covers it
        if any(q.question.lower() == question.lower() for q in out):
            continue
        panel = a.get("panel") if isinstance(a.get("panel"), str) and a.get("panel") in panels else None
        out.append(Ambiguity(topic=topic, question=question, panel=panel))
        if len(out) == 6:
            break
    return out


def _fallback_summary(score: int, status: str, checks: List[Check]) -> str:
    failed = [c.name.lower() for c in checks if not c.passed]
    if not failed:
        return "Ready for studio: every check passed."
    return (f"Score {score}. The studio would ask about: " + "; ".join(failed[:4]) +
            (f" and {len(failed) - 4} more" if len(failed) > 4 else "") + ".")


_cache: Dict[Tuple[str, str], Tuple[List[Ambiguity], str, str]] = {}


def simulate(sid: str, state: BriefState, ex: Extraction) -> SimulatorReport:
    checks, brief, bp = run_checks(state, ex)
    score, status = score_and_status(checks)
    base = dict(product=state.product_name, market=state.market, category=state.category, score=score, status=status,
                checks=checks)
    key = (sid, state.updated_at)
    if key in _cache:
        amb, summary, model = _cache[key]
        return SimulatorReport(**base, ambiguities=amb, designer_summary=summary, model=model)
    context = _context(state, brief, bp, checks, score, status)
    for model in chain("chat"):
        try:
            data = model.json(PROMPT + "BRIEF:\n" + context, temperature=0.2)
        except Exception as err:  # the report must work without the AI
            logger.warning("Agency simulator via %s/%s failed: %s", model.provider, model.model, str(err)[:160])
            continue
        if not isinstance(data, dict):
            continue
        amb = validate_ambiguities(data, checks, {p.id for p in bp.panels})
        raw = str(data.get("designer_summary") or "")
        summary = " ".join(s for s in re.split(r"(?<=[.!?])\s+", raw) if s and _grounded(s, context))[:600]
        summary = summary or _fallback_summary(score, status, checks)
        _cache[key] = (amb, summary, model.model)
        return SimulatorReport(**base, ambiguities=amb, designer_summary=summary, model=model.model)
    return SimulatorReport(**base, designer_summary=_fallback_summary(score, status, checks), llm_unavailable=True)
