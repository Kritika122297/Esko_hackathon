"""The designer-facing brief: what to keep, change, add, remove, and what is still unknown."""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.brief import BriefField, BriefState, ChangeLogEntry, Readiness
from app.models.extraction import Extraction
from app.services.catalog import NUTRIENTS, dv_key
from app.services.checks.base import src_label
from app.services.values import comparable, norm_text, plural

CASE_LABELS = {"update": "Refresh of an existing pack", "new_market": "Adapt an existing pack for a new market",
               "new_product": "New product (no existing artwork)"}
MANDATORY_COPY = ("statement_of_identity", "net_weight", "ingredients", "allergen_statement", "dietary_info",
                  "producer", "storage", "barcode", "claims", "marketing_copy")
# Copy that other categories print (cosmetics, medicines, devices, household, pet food). Shown when the
# category's rules require it or a file provides it, in this order, after the copy above.
CATEGORY_COPY = ("signal_word", "hazard_statements", "precautionary_statements", "hazard_pictograms", "first_aid",
                 "warnings", "directions", "inci_ingredients", "active_ingredients", "excipients", "strength",
                 "dosage_form", "target_species", "feed_type", "guaranteed_analysis", "feeding_guidelines",
                 "nutritional_adequacy", "responsible_person", "country_of_origin", "licence_number", "mrp", "veg_logo",
                 "ce_marking", "udi", "batch_lot", "manufacture_date", "expiry_date", "pao_symbol")
# The food Nutrition Facts panel; other categories never get it unless their rules ask for these fields.
NF_EXTRA = ("nutrition_format", "nutrition_footnote")


class DesignItem(BaseModel):
    item: str
    action: str
    instruction: str
    panel: Optional[str] = None
    current: Optional[str] = None
    new: Optional[str] = None
    owner: Optional[str] = None
    fields: List[str] = Field(default_factory=list)
    issue_ids: List[str] = Field(default_factory=list)


class PanelContent(BaseModel):
    panel: str
    label: str
    bbox: Optional[List[float]] = None
    items: List[DesignItem] = Field(default_factory=list)


class OpenQuestion(BaseModel):
    question: str
    owner: str
    detail: str
    issue_id: str
    status: str = Field("open", description="open, agency (passed on as an open question) or check (verify on the pack)")


class ProofRow(BaseModel):
    field: str
    label: str
    value: Optional[str]
    status: str
    sources: List[str]


EU_MARKETS = {"EU", "FR", "DE", "ES", "IT", "NL"}


def nutrition_format(market: str) -> str:
    """How the nutrition panel is laid out in a market (the checks follow the market's rule pack)."""
    m = (market or "").upper()
    if m == "US":
        return "US FDA Nutrition Facts, vertical format"
    if m in EU_MARKETS:
        return "EU nutrition declaration: energy in kJ and kcal, values per 100 g"
    if m == "IN":
        return "FSSAI nutrition information: per 100 g or 100 ml, with energy in kcal"
    return f"the nutrition format required in {m}"


class Decision(BaseModel):
    question: str
    answer: str
    owner: str
    kind: str
    by: str
    at: str


class BriefSummary(BaseModel):
    """AI-written overview of the brief. Numbers in it are checked by code against the brief."""

    summary: str
    designer_notes: List[str] = Field(default_factory=list)
    model: str = ""


class DesignerBrief(BaseModel):
    product: str
    market: str
    source_market: Optional[str] = None
    case: str
    status: str
    updated_at: str
    readiness: Optional[Readiness]
    summary: List[str]
    items: List[DesignItem]
    panels: List[PanelContent]
    final_copy: List[ProofRow]
    nutrition: List[Dict[str, Optional[str]]]
    open_questions: List[OpenQuestion]
    proof: List[ProofRow]
    change_log: List[ChangeLogEntry]
    decisions: List[Decision] = Field(default_factory=list, description="Questions answered during review")
    ai: Optional[BriefSummary] = Field(None, description="AI overview, added for file exports")


def _proof(f: BriefField) -> ProofRow:
    srcs = []
    for s in f.sources:
        label = src_label(s)
        if s.kind == "excel" and s.note:
            label += f" (note: {s.note[:80]})"
        srcs.append(f"{label}: '{s.snippet[:90]}'")
    if f.user_confirmed:
        last = f.history[-1] if f.history else None
        srcs.insert(0, f"Confirmed by reviewer" + (f" ({last.reason})" if last and last.reason else ""))
    return ProofRow(field=f.key, label=f.label, value=f.value, status=f.status, sources=srcs)


def _same_print(key: str, printed: str, approved: str) -> bool:
    """Whether the designer can keep what is printed. Same quantity is not enough for the net weight:
    '480g' and 'NET WT 16.9 OZ (480g)' agree on the amount but print differently."""
    if key == "net_weight":
        return re.sub(r"\s+", "", norm_text(printed)) == re.sub(r"\s+", "", norm_text(approved))
    return comparable(key, printed) == comparable(key, approved)


def build_designer_brief(state: BriefState, ex: Extraction) -> DesignerBrief:
    # New product: an uploaded artwork is only a reference, so every item is new copy to place.
    has_art = any(p.file.lower().endswith(".pdf") for p in ex.pages) and state.case != "new_product"
    old_pack = f"{state.source_market} pack" if state.source_market else "existing pack"
    keep_text = (f"Keep as on the {old_pack}; it is also right for {state.market}." if state.case == "new_market"
                 else "Keep as on the current artwork.")
    change_text = (f"Replace the {old_pack} text with the {state.market} copy." if state.case == "new_market"
                   else "Replace the current text with the approved copy.")
    open_on: Dict[str, List[str]] = {}
    for i in state.issues:
        if i.state == "open" and i.resolution == "data" and i.severity in ("blocking", "warning"):
            for k in i.fields:
                open_on.setdefault(k, []).append(i.title)

    nut_keys = ["calories"] + [n.key for n in NUTRIENTS] + [dv_key(n.key) for n in NUTRIENTS if n.daily_value]
    has_nf = state.category == "food" or any(f.mandatory for f in state.fields if f.key in nut_keys)

    items: List[DesignItem] = []
    for f in state.fields:
        if not f.on_artwork or f.key in nut_keys or (f.key in NF_EXTRA and not has_nf):
            continue
        art = next((c for c in f.candidates if c.source.kind == "pdf"), None) if has_art else None
        panel = art.source.panel if art else None
        if f.key in open_on:
            items.append(DesignItem(item=f.label, action="unknown", panel=panel, current=art.value if art else None,
                                    new=f.value, fields=[f.key],
                                    instruction="Waiting for a decision: " + "; ".join(open_on[f.key][:2])))
        elif not f.value and f.not_applicable:
            if art:  # a reviewer ruled it out, but the current pack still prints it
                items.append(DesignItem(item=f.label, action="remove", panel=panel, current=art.value, fields=[f.key],
                                        instruction="Does not apply to this product; remove it from the pack."))
        elif not f.value and art and f.user_confirmed is False and f.history and f.history[-1].new is None:
            items.append(DesignItem(item=f.label, action="remove", panel=panel, current=art.value, fields=[f.key],
                                    instruction="Cleared during review; remove it from the pack."))
        elif not f.value:
            if f.mandatory:
                items.append(DesignItem(item=f.label, action="unknown", fields=[f.key],
                                        instruction="Not provided yet. Leave space; content will follow."))
        elif art and _same_print(f.key, art.value, f.value):
            items.append(DesignItem(item=f.label, action="keep", panel=panel, current=art.value, fields=[f.key],
                                    instruction=keep_text))
        elif art:
            items.append(DesignItem(item=f.label, action="change", panel=panel, current=art.value, new=f.value,
                                    fields=[f.key], instruction=change_text))
        elif not has_art:
            items.append(DesignItem(item=f.label, action="add", new=f.value, fields=[f.key],
                                    instruction="Place this copy on the pack."))
        elif f.history:
            items.append(DesignItem(item=f.label, action="add", new=f.value, fields=[f.key],
                                    instruction="New copy agreed during review; add it to the pack."))
        else:
            items.append(DesignItem(item=f.label, action="keep", new=f.value, fields=[f.key],
                                    instruction="Shown as a logo or image on the current pack; keep it unless "
                                                "listed under Change or Remove."))

    # Nutrition Facts as one designer item (food, or a category whose rules ask for it)
    if has_nf:
        nut_open = [k for k in nut_keys if k in open_on]
        nut_changed = [k for k in nut_keys if state.field(k) and state.field(k).value and any(
            c.source.kind == "pdf" and comparable(k, c.value) != comparable(k, state.field(k).value)
            for c in state.field(k).candidates)]
        nf_panel = next((c.source.panel for c in (state.field("calories").candidates if state.field("calories") else [])
                         if c.source.kind == "pdf"), None)
        if not has_art and not nut_open:
            items.append(DesignItem(item="Nutrition Facts panel", action="add", fields=nut_keys,
                                    instruction="Add the Nutrition Facts panel with the approved values in the table below."))
        elif nut_open:
            items.append(DesignItem(item="Nutrition Facts panel", action="unknown", panel=nf_panel, fields=nut_open,
                                    instruction=f"{len(nut_open)} nutrition values still need a decision; use the table "
                                                "below once confirmed."))
        elif nut_changed:
            items.append(DesignItem(item="Nutrition Facts panel", action="change", panel=nf_panel, fields=nut_changed,
                                    instruction="Update the nutrition panel to the approved values in the table below "
                                                f"({nutrition_format(state.market)})."))
        else:
            items.append(DesignItem(item="Nutrition Facts panel", action="keep", panel=nf_panel,
                                    instruction="Keep the Nutrition Facts as approved."))

    # Design tasks raised by checks (verification notes without an action go to open questions)
    front = next((p.id for p in ex.panels if p.is_main), None)
    for i in state.issues:
        if i.resolution != "design" or not i.design_action:
            continue
        panel = front if i.check == "us.net_weight_pdp" else next((e.panel for e in i.evidence if e.panel), None)
        items.append(DesignItem(item=i.title, action=i.design_action or "change", panel=panel, owner=i.owner,
                                instruction=i.suggestion or i.description, issue_ids=[i.id], fields=i.fields))

    order = {"change": 0, "add": 1, "remove": 2, "unknown": 3, "keep": 4}
    items.sort(key=lambda d: order.get(d.action, 9))

    panels: List[PanelContent] = []
    for p in ex.panels:
        mine = [d for d in items if d.panel == p.id]
        if mine:
            panels.append(PanelContent(panel=p.id, label=p.label, bbox=p.bbox, items=mine))

    nutrition = []
    if has_nf and state.field("calories"):
        nutrition.append({"label": "Calories", "amount": state.value("calories"), "dv": None,
                          "status": state.field("calories").status})
    for n in NUTRIENTS if has_nf else ():
        f = state.field(n.key)
        d = state.field(dv_key(n.key)) if n.daily_value else None
        nutrition.append({"label": n.label, "amount": f.value if f else None, "dv": d.value if d else None,
                          "status": "needs_review" if (f and f.status != "confirmed") or (d and d.status != "confirmed") else "confirmed"})

    questions: List[OpenQuestion] = []
    for i in state.issues:
        if i.state == "acknowledged":
            questions.append(OpenQuestion(question=i.title, owner=i.owner, issue_id=i.id, status="agency",
                                          detail=(i.acknowledgement or "") + " — " + i.description))
        elif i.state == "open" and i.resolution == "data" and i.severity != "info":
            questions.append(OpenQuestion(question=i.title, owner=i.owner, issue_id=i.id, detail=i.description))
        elif i.kind == "needs_human" and i.severity == "info" and i.resolution == "design":
            questions.append(OpenQuestion(question=i.title, owner=i.owner, issue_id=i.id, status="check",
                                          detail=i.suggestion or i.description))

    keep = sum(1 for d in items if d.action == "keep")
    change = sum(1 for d in items if d.action == "change")
    add = sum(1 for d in items if d.action == "add")
    remove = sum(1 for d in items if d.action == "remove")
    unknown = sum(1 for d in items if d.action == "unknown")
    job = {"new_market": f"Adapt the {old_pack} for the {state.market} market.",
           "new_product": f"New product for the {state.market} market: every item is new copy to place on the pack."
           }.get(state.case, f"{CASE_LABELS.get(state.case, state.case)} for the {state.market} market.")
    summary = [
        job,
        f"{plural(change, 'change')}, {plural(add, 'addition')}, {plural(remove, 'removal')}, {plural(keep, 'item')} to keep, {unknown} still unknown.",
        f"{plural(len(questions), 'open question')} for the agency or brand team.",
    ]
    return DesignerBrief(
        product=state.product_name, market=state.market, source_market=state.source_market,
        case=CASE_LABELS.get(state.case, state.case),
        status=state.status, updated_at=state.updated_at, readiness=state.readiness, summary=summary,
        items=items, panels=panels,
        final_copy=[_proof(f) for f in (state.field(k) for k in MANDATORY_COPY + CATEGORY_COPY)
                    if f is not None and (f.value or f.mandatory)],
        nutrition=nutrition, open_questions=questions,
        proof=[_proof(f) for f in state.fields if f.value or f.mandatory],
        change_log=state.change_log,
        decisions=[Decision(question=a.question, answer=a.answer, owner=a.owner, kind=a.kind, by=a.by, at=a.at)
                   for a in state.answered_questions],
    )
