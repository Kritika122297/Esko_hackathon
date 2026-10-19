"""The designer-facing brief: what to keep, change, add, remove, and what is still unknown."""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.brief import BriefField, BriefState, ChangeLogEntry, Readiness
from app.models.extraction import Extraction
from app.services.catalog import NUTRIENTS, dv_key
from app.services.checks.base import src_label
from app.services.values import comparable, plural

CASE_LABELS = {"update": "Refresh of an existing pack", "new_market": "Adapt an existing pack for a new market",
               "new_product": "New product (no existing artwork)"}
MANDATORY_COPY = ("statement_of_identity", "net_weight", "ingredients", "allergen_statement", "dietary_info",
                  "producer", "storage", "barcode", "claims", "marketing_copy")


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


class ProofRow(BaseModel):
    field: str
    label: str
    value: Optional[str]
    status: str
    sources: List[str]


class DesignerBrief(BaseModel):
    product: str
    market: str
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


def build_designer_brief(state: BriefState, ex: Extraction) -> DesignerBrief:
    has_art = any(p.file.lower().endswith(".pdf") for p in ex.pages)
    open_on: Dict[str, List[str]] = {}
    for i in state.issues:
        if i.state == "open" and i.resolution == "data" and i.severity in ("blocking", "warning"):
            for k in i.fields:
                open_on.setdefault(k, []).append(i.title)

    items: List[DesignItem] = []
    for f in state.fields:
        if not f.on_artwork or f.key.endswith("_dv") or f.key in [n.key for n in NUTRIENTS] or f.key == "calories":
            continue
        art = next((c for c in f.candidates if c.source.kind == "pdf"), None)
        panel = art.source.panel if art else None
        if f.key in open_on:
            items.append(DesignItem(item=f.label, action="unknown", panel=panel, current=art.value if art else None,
                                    new=f.value, fields=[f.key],
                                    instruction="Waiting for a decision: " + "; ".join(open_on[f.key][:2])))
        elif not f.value:
            if f.mandatory:
                items.append(DesignItem(item=f.label, action="unknown", fields=[f.key],
                                        instruction="Not provided yet. Leave space; content will follow."))
        elif art and comparable(f.key, art.value) == comparable(f.key, f.value):
            items.append(DesignItem(item=f.label, action="keep", panel=panel, current=art.value, fields=[f.key],
                                    instruction="Keep as on the current artwork."))
        elif art:
            items.append(DesignItem(item=f.label, action="change", panel=panel, current=art.value, new=f.value,
                                    fields=[f.key], instruction=f"Replace the current text with the approved copy."))
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

    # Nutrition Facts as one designer item
    nut_keys = ["calories"] + [n.key for n in NUTRIENTS] + [dv_key(n.key) for n in NUTRIENTS if n.daily_value]
    nut_open = [k for k in nut_keys if k in open_on]
    nut_changed = [k for k in nut_keys if state.field(k) and state.field(k).value and any(
        c.source.kind == "pdf" and comparable(k, c.value) != comparable(k, state.field(k).value)
        for c in state.field(k).candidates)]
    nf_panel = next((c.source.panel for c in (state.field("calories").candidates if state.field("calories") else [])
                     if c.source.kind == "pdf"), None)
    if nut_open:
        items.append(DesignItem(item="Nutrition Facts panel", action="unknown", panel=nf_panel, fields=nut_open,
                                instruction=f"{len(nut_open)} nutrition values still need a decision; use the table "
                                            "below once confirmed."))
    elif nut_changed:
        items.append(DesignItem(item="Nutrition Facts panel", action="change", panel=nf_panel, fields=nut_changed,
                                instruction="Update the Nutrition Facts to the approved values in the table below "
                                            "(US FDA vertical format)."))
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
    if state.field("calories"):
        nutrition.append({"label": "Calories", "amount": state.value("calories"), "dv": None,
                          "status": state.field("calories").status})
    for n in NUTRIENTS:
        f = state.field(n.key)
        d = state.field(dv_key(n.key)) if n.daily_value else None
        nutrition.append({"label": n.label, "amount": f.value if f else None, "dv": d.value if d else None,
                          "status": "needs_review" if (f and f.status != "confirmed") or (d and d.status != "confirmed") else "confirmed"})

    questions: List[OpenQuestion] = []
    for i in state.issues:
        if i.state == "acknowledged":
            questions.append(OpenQuestion(question=i.title, owner=i.owner, issue_id=i.id,
                                          detail=(i.acknowledgement or "") + " — " + i.description))
        elif i.state == "open" and i.resolution == "data" and i.severity != "info":
            questions.append(OpenQuestion(question=i.title, owner=i.owner, issue_id=i.id, detail=i.description))
        elif i.kind == "needs_human" and i.severity == "info" and i.resolution == "design":
            questions.append(OpenQuestion(question=i.title, owner=i.owner, issue_id=i.id, detail=i.suggestion or i.description))

    keep = sum(1 for d in items if d.action == "keep")
    change = sum(1 for d in items if d.action == "change")
    add = sum(1 for d in items if d.action == "add")
    remove = sum(1 for d in items if d.action == "remove")
    unknown = sum(1 for d in items if d.action == "unknown")
    summary = [
        f"{CASE_LABELS.get(state.case, state.case)} for the {state.market} market.",
        f"{plural(change, 'change')}, {plural(add, 'addition')}, {plural(remove, 'removal')}, {plural(keep, 'item')} to keep, {unknown} still unknown.",
        f"{plural(len(questions), 'open question')} for the agency or brand team.",
    ]
    return DesignerBrief(
        product=state.product_name, market=state.market, case=CASE_LABELS.get(state.case, state.case),
        status=state.status, updated_at=state.updated_at, readiness=state.readiness, summary=summary,
        items=items, panels=panels,
        final_copy=[_proof(state.field(k)) for k in MANDATORY_COPY if state.field(k)],
        nutrition=nutrition, open_questions=questions,
        proof=[_proof(f) for f in state.fields if f.value or f.mandatory],
        change_log=state.change_log,
    )
