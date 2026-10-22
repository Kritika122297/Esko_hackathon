"""Designer blueprint: the flat plan of the pack with the layout rules that apply to it.

Panels come from the dieline read from the artwork; without one, a clearly labelled generic carton is used.
Every number shown (zones, minimum type heights, quiet zones) comes from guidelines/layout_rules.json with its
citation, never from code or the AI. The front panel size comes from the brief ('Front panel (PDP) size'); a
size measured from the dieline is only an estimate, because the PDF may not be at 100% scale.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from functools import lru_cache
from typing import Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field

from app.models.brief import BriefState
from app.models.extraction import Extraction
from app.services.catalog import NUTRIENTS
from app.services.guidelines import GUIDELINE_DIR
from app.services.values import amount_in

GENERAL_ONLY = {"retail", "industrial"}
SQ_IN_TO_CM2 = 6.4516
INFO_FIELDS = {"nutrition": "Nutrition panel", "ingredients": "Ingredient list", "allergen_statement": "Allergen statement",
               "producer": "Name and address"}
NUTRITION_KEYS = ["calories"] + [n.key for n in NUTRIENTS]

Role = Literal["pdp", "info", "back", "side", "flap", "barcode", "other"]


class PanelPlan(BaseModel):
    id: str
    label: str
    role: Role
    bbox: List[float]
    items: List[str] = Field(default_factory=list, description="Copy blocks placed on this panel")


class Dimensions(BaseModel):
    width_in: float
    height_in: float
    area_sq_in: float
    area_cm2: float
    source: Literal["brief", "dieline"]
    text: str


class TypeSpec(BaseModel):
    element: str
    min_height: Optional[str] = None
    basis: str
    citation: str
    clause_id: Optional[str] = None
    verified: bool = False
    note: Optional[str] = None


class Overlay(BaseModel):
    kind: Literal["zone", "group", "quiet_zone", "emphasis"]
    panel: Optional[str] = None
    label: str
    text: str
    citation: str
    clause_id: Optional[str] = None
    verified: bool = False
    fraction: Optional[float] = None
    exempt: bool = False
    ok: Optional[bool] = Field(None, description="Whether the brief already meets it, when code can tell")


class CopyBlock(BaseModel):
    key: str
    label: str
    text: str


class Blueprint(BaseModel):
    generic: bool
    page_width: float
    page_height: float
    panels: List[PanelPlan]
    pdp_panel: Optional[str] = None
    info_panel: Optional[str] = None
    barcode_panel: Optional[str] = None
    dimensions: Optional[Dimensions] = None
    dimensions_needed: bool = True
    symbology: Optional[str] = None
    type_specs: List[TypeSpec] = Field(default_factory=list)
    overlays: List[Overlay] = Field(default_factory=list)
    copy_blocks: List[CopyBlock] = Field(default_factory=list)
    general_only: bool = False
    layout_rules: bool = False
    notes: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------- rules data


@lru_cache(maxsize=1)
def _rules() -> List[dict]:
    return json.loads((GUIDELINE_DIR / "layout_rules.json").read_text(encoding="utf-8"))["rules"]


def layout_rules(market: str, category: str) -> List[dict]:
    """Layout rules for a market and category. General-only categories get only the cross-category ones."""
    m, c = (market or "").upper(), (category or "food").lower()
    out = []
    for r in _rules():
        if "*" not in r["markets"] and m not in r["markets"]:
            continue
        if "*" in r["categories"]:
            out.append(r)
        elif c in r["categories"] and c not in GENERAL_ONLY:
            out.append(r)
    return out


# ---------------------------------------------------------------- measurements


_DIMS = re.compile(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|in|inch|inches|\")?\s*(?:x|×|by|\*)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|in|inch|inches|\")?", re.I)
TO_IN = {"mm": 1 / 25.4, "cm": 1 / 2.54, "in": 1.0, "inch": 1.0, "inches": 1.0, '"': 1.0}


def parse_dimensions(text: Optional[str]) -> Optional[Tuple[float, float, str]]:
    """'190 x 280 mm' -> (7.48, 11.02, 'mm'). Without a unit, sizes over 20 are read as mm, others as inches."""
    m = _DIMS.search(text or "")
    if not m:
        return None
    a, b = float(m.group(1).replace(",", ".")), float(m.group(3).replace(",", "."))
    unit = (m.group(4) or m.group(2) or ("mm" if max(a, b) > 20 else "in")).lower()
    f = TO_IN.get(unit, 1.0)
    return a * f, b * f, unit


def _dims(state: BriefState, pdp: Optional[PanelPlan], generic: bool) -> Optional[Dimensions]:
    text = state.value("pdp_dimensions")
    parsed = parse_dimensions(text)
    if parsed:
        w, h, _ = parsed
        return Dimensions(width_in=round(w, 2), height_in=round(h, 2), area_sq_in=round(w * h, 1),
                          area_cm2=round(w * h * SQ_IN_TO_CM2, 1), source="brief", text=text or "")
    if pdp and not generic:  # PDF points at 100% scale; an estimate until someone enters the real size
        w, h = (pdp.bbox[2] - pdp.bbox[0]) / 72, (pdp.bbox[3] - pdp.bbox[1]) / 72
        return Dimensions(width_in=round(w, 2), height_in=round(h, 2), area_sq_in=round(w * h, 1),
                          area_cm2=round(w * h * SQ_IN_TO_CM2, 1), source="dieline",
                          text=f"{w:.2f} x {h:.2f} in, measured from the dieline at 100% scale")
    return None


def symbology(state: BriefState) -> Optional[str]:
    """From 'Barcode symbology and size' if given, else from the number of digits (a GS1 fact, not a guess)."""
    spec = (state.value("barcode_spec") or "").upper().replace(" ", "")
    for name in ("UPC-A", "EAN-13", "EAN-8"):
        if name.replace("-", "") in spec.replace("-", ""):
            return name
    digits = re.sub(r"\D", "", state.value("barcode") or "")
    return {12: "UPC-A", 13: "EAN-13", 8: "EAN-8"}.get(len(digits))


def _row(table: List[dict], value: float, key: str) -> dict:
    return next(r for r in table if r[key] is None or value <= r[key])


# ---------------------------------------------------------------- panels


GENERIC = [  # a plain tuck carton, used when no dieline was read; coordinates are arbitrary
    ("back", "Back panel", "back", [0, 120, 300, 520]), ("left", "Side panel (left)", "side", [300, 120, 420, 520]),
    ("front", "Front panel (PDP)", "pdp", [420, 120, 720, 520]), ("right", "Side panel (right)", "info", [720, 120, 840, 520]),
    ("bottom", "Base flap (barcode)", "barcode", [420, 520, 720, 640]),
]
GENERIC_ITEMS = {"pdp": {"statement_of_identity", "net_weight", "brand", "product_name", "claims", "flavour"},
                 "info": {"ingredients", "allergen_statement", "producer", *NUTRITION_KEYS},
                 "back": {"marketing_copy", "storage", "directions", "warnings", "dietary_info"},
                 "barcode": {"barcode"}}


def _art_panel(state: BriefState, key: str) -> Optional[str]:
    f = state.field(key)
    return next((c.source.panel for c in (f.candidates if f else []) if c.source.kind == "pdf" and c.source.panel), None)


def _info_panel(state: BriefState) -> Optional[str]:
    seen = [p for p in (_art_panel(state, k) for k in ["ingredients", "allergen_statement", "producer", *NUTRITION_KEYS]) if p]
    return Counter(seen).most_common(1)[0][0] if seen else None


def build_blueprint(state: BriefState, ex: Extraction, brief) -> Blueprint:
    market, category = state.market, state.category
    has_dieline = bool(ex.panels) and state.case != "new_product"
    notes: List[str] = []
    if has_dieline:
        page = next((p for p in ex.pages if p.file == ex.panels[0].file and p.page == ex.panels[0].page), None)
        pw, ph = (page.width, page.height) if page else (max(p.bbox[2] for p in ex.panels), max(p.bbox[3] for p in ex.panels))
        main = [p for p in ex.panels if p.file == ex.panels[0].file and p.page == ex.panels[0].page]
        info = _info_panel(state)
        barcode = _art_panel(state, "barcode")
        panels = []
        for p in main:
            role: Role = "pdp" if p.is_main else "info" if p.id == info else "barcode" if p.id == barcode else (
                "flap" if any(w in p.id for w in ("tuck", "top", "bottom", "flap")) else "side" if p.id in ("left", "right") else
                "back" if p.id == "back" else "other")
            panels.append(PanelPlan(id=p.id, label=p.label, role=role, bbox=p.bbox))
    else:
        pw, ph = 840.0, 640.0
        panels = [PanelPlan(id=i, label=lbl, role=r, bbox=b) for i, lbl, r, b in GENERIC]
        notes.append("Generic layout: no dieline was read from the files, so panel positions are a standard tuck "
                     "carton, not this pack's.")
    by_id = {p.id: p for p in panels}
    pdp = next((p for p in panels if p.role == "pdp"), None)
    info = next((p for p in panels if p.role == "info"), None) or (by_id.get(_info_panel(state) or "") if has_dieline else None)
    bc = next((p for p in panels if p.role == "barcode"), None)

    # Copy blocks per panel: the designer brief's placements, or the generic plan.
    if has_dieline:
        for item in brief.items:
            if item.panel in by_id and item.action != "remove":
                by_id[item.panel].items.append(item.item)
    else:
        for item in brief.items:
            role = next((r for r, keys in GENERIC_ITEMS.items() if set(item.fields) & keys), None)
            target = next((p for p in panels if p.role == role), None)
            if target and item.action != "remove":
                target.items.append(item.item)

    dims = _dims(state, pdp, not has_dieline)
    rules = layout_rules(market, category)
    general_only = category in GENERAL_ONLY
    if general_only:
        notes.append("General checks only for this category: no category-specific layout rules apply.")
    elif not [r for r in rules if r["kind"] != "quiet_zone"]:
        notes.append(f"No layout rules are loaded for {category} in {market}; only general production checks apply.")

    specs: List[TypeSpec] = []
    overlays: List[Overlay] = []
    sym = symbology(state)
    for r in rules:
        common = dict(citation=r["citation"], clause_id=r.get("clause_id"), verified=bool(r.get("verified")))
        if r["kind"] == "type_table" and r.get("area_unit"):
            if dims:
                row = _row(r["table"], dims.area_sq_in, "max_area")
                specs.append(TypeSpec(element="Net quantity (figures and words)", min_height=row["label"],
                                      basis=f"PDP {dims.area_sq_in} sq in ({'from the brief' if dims.source == 'brief' else 'estimated from the dieline'})",
                                      **common))
            else:
                specs.append(TypeSpec(element="Net quantity (figures and words)", basis="Dimensions needed",
                                      note="Enter the front panel size in the brief to get the minimum height.", **common))
            if r.get("zone_fraction") and pdp:
                exempt = bool(dims and dims.area_sq_in <= r.get("exempt_max_area", 0))
                overlays.append(Overlay(kind="zone", panel=pdp.id, label="Net quantity zone", fraction=r["zone_fraction"],
                                        exempt=exempt, text=f"Bottom {int(r['zone_fraction'] * 100)}% of the PDP", **common))
        elif r["kind"] == "type_table" and r.get("basis") == "nominal quantity":
            grams = amount_in(state.value("net_weight"), "g") or amount_in(state.value("net_weight"), "ml")
            if grams:
                row = _row(r["table"], grams, "max_quantity")
                specs.append(TypeSpec(element="Net quantity figures", min_height=row["label"],
                                      basis=f"Nominal quantity {grams:g} g or ml", **common))
            else:
                specs.append(TypeSpec(element="Net quantity figures", basis="Net quantity needed", **common))
        elif r["kind"] == "placement_zone" and pdp:
            exempt = bool(dims and dims.area_sq_in <= r.get("exempt_max_area", 0))
            overlays.append(Overlay(kind="zone", panel=pdp.id, label="Net quantity zone", fraction=r["value"], exempt=exempt,
                                    text=("Exempt: " + r["exemption"]) if exempt else f"Bottom {int(r['value'] * 100)}% of the PDP",
                                    **common))
        elif r["kind"] == "contiguity":
            places = {k: (_art_panel(state, "calories") or _art_panel(state, "total_fat")) if k == "nutrition" else _art_panel(state, k)
                      for k in r["fields"]}
            known = {p for p in places.values() if p}
            ok = (len(known) == 1 and None not in places.values()) if has_dieline else None
            overlays.append(Overlay(kind="group", panel=info.id if info else None, label="Information panel group",
                                    text="Keep together, nothing in between: " + ", ".join(INFO_FIELDS[k] for k in r["fields"]),
                                    ok=ok, **common))
        elif r["kind"] == "type_min":
            specs.append(TypeSpec(element="Information panel text", min_height=r["label"], basis="Any panel size", **common))
        elif r["kind"] == "x_height":
            small = bool(dims and dims.area_cm2 < r["small_max_area"])
            specs.append(TypeSpec(element="Mandatory particulars (x-height)",
                                  min_height=f"{r['small_value'] if small else r['value']} mm",
                                  basis=(f"Largest surface {dims.area_cm2} cm2" if dims else "Panel size needed for the 80 cm2 test"),
                                  note=r.get("small_note"), **common))
        elif r["kind"] == "emphasis":
            overlays.append(Overlay(kind="emphasis", panel=info.id if info else None, label="Allergen emphasis",
                                    text=r["note"], **common))
        elif r["kind"] == "quiet_zone":
            q = r["symbologies"].get(sym or "")
            text = (f"{sym}: {q['left']}X left, {q['right']}X right (X = module width; {r['nominal_x']} {r['nominal_x_unit']} at 100%)"
                    if q else "Quiet zone: not specified (barcode symbology unknown)")
            overlays.append(Overlay(kind="quiet_zone", panel=bc.id if bc else None, label="Barcode quiet zone", text=text,
                                    ok=bool(q), **common))
    if not bc:
        notes.append("The barcode position was not found on the artwork; agree it with the agency.")
    if dims and dims.source == "dieline":
        notes.append("Front panel size is estimated from the dieline at 100% scale. Enter the real size in the brief "
                     "('Front panel (PDP) size') to confirm the type sizes.")

    return Blueprint(generic=not has_dieline, page_width=pw, page_height=ph, panels=panels, pdp_panel=pdp.id if pdp else None,
                     info_panel=info.id if info else None, barcode_panel=bc.id if bc else None, dimensions=dims,
                     dimensions_needed=not (dims and dims.source == "brief"), symbology=sym, type_specs=specs,
                     overlays=overlays, copy_blocks=copy_blocks(state), general_only=general_only,
                     layout_rules=bool([r for r in rules if r["kind"] != "quiet_zone"]), notes=notes)


# ---------------------------------------------------------------- copy for the studio


def clean_ingredients(text: Optional[str]) -> str:
    t = re.sub(r"^\s*ingredients?\s*[:\-–]\s*", "", text or "", flags=re.I)
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s+([,.;)])", r"\1", t)
    t = re.sub(r"([,;])(?=\S)", r"\1 ", t)
    t = re.sub(r"\(\s+", "(", t).strip()
    return f"Ingredients: {t}" if t else ""


def copy_blocks(state: BriefState) -> List[CopyBlock]:
    v = state.value
    out: List[CopyBlock] = []
    if v("ingredients"):
        out.append(CopyBlock(key="ingredients", label="Ingredients (cleaned)", text=clean_ingredients(v("ingredients"))))
    if v("net_weight"):
        out.append(CopyBlock(key="net_weight", label="Net quantity", text=" ".join(v("net_weight").split())))
    if v("producer"):
        lines = [p.strip() for p in re.split(r",\s*|\n", v("producer")) if p.strip()]
        out.append(CopyBlock(key="producer", label="Address block", text="\n".join(lines)))
    disclaimers = [v(k) for k in ("allergen_statement", "warnings", "precautionary_statements", "first_aid",
                                  "nutrition_footnote") if v(k)]
    if disclaimers:
        out.append(CopyBlock(key="disclaimers", label="Mandatory statements", text="\n\n".join(" ".join(d.split()) for d in disclaimers)))
    return out
