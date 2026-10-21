"""Turns raw fragments into candidate field values, each with its proof.

Rules here are deliberately simple and explainable. Anything they cannot read is left
empty (never guessed) and reported as an extraction limit.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from app.config import settings
from app.models.brief import Candidate, SourceRef
from app.models.extraction import ExcelRow, Extraction, Fragment
from app.services.catalog import NUTRIENTS, dv_key, match_label, match_nutrient

EMPTY_VALUES = {"", "n/a", "na", "none", "-", "—", "–", "tbd", "tbc", "unknown", "missing"}
UNCERTAIN_WORDS = ("assumed", "confirm", "verify", "not clearly", "legible", "derived", "reconstructed",
                   "estimate", "placeholder", "tbd", "check", "unclear", "pending")

CLAIM_PATTERNS: List[Tuple[str, str]] = [
    ("No Added Sugar", r"\bno\s+added\s+sugars?\b"),
    ("Sugar Free", r"\bsugar[\s-]+free\b"),
    ("Oven Baked", r"\boven[\s-]+baked\b"),
    ("GMO Free", r"\b(gmo[\s-]+free|non[\s-]+gmo)\b"),
    ("High-Grain", r"\bhigh[\s-]+grain\b"),
    ("Organic", r"\b(certified\s+)?organic\b"),
    ("USDA Organic", r"\busda\s+organic\b"),
    ("Vegan", r"\bvegans?\b"),
    ("Vegetarian", r"\bvegetarians?\b"),
    ("Gluten Free", r"\bgluten[\s-]+free\b"),
    ("High Protein", r"\bhigh[\s-]+protein\b"),
    ("High Fiber", r"\bhigh[\s-]+fib(er|re)\b"),
    ("Low Fat", r"\blow[\s-]+fat\b"),
    ("Kosher", r"\bkosher\b"),
    ("Recyclable", r"\brecyclable\b"),
]

BLOCK_HEADERS = ("INGREDIENTS", "ALLERGEN", "DIETARY", "CONTAINS", "STORAGE", "PRODUCED BY",
                 "MANUFACTURED BY", "DISTRIBUTED BY", "MADE BY", "PACKED BY")


def is_empty_value(v: Optional[str]) -> bool:
    if v is None:
        return True
    n = v.strip().lower()
    return n in EMPTY_VALUES or n.startswith("not clearly legible") or n.startswith("not printed")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\n", " ")).strip()


def strip_prefix(text: str, *prefixes: str) -> str:
    t = _clean(text)
    for p in prefixes:
        m = re.match(rf"^\s*{p}\s*:?\s*", t, re.IGNORECASE)
        if m:
            return t[m.end():].strip()
    return t


def union_bbox(frags: List[Fragment]) -> Optional[List[float]]:
    boxes = [f.bbox for f in frags if f.bbox]
    if not boxes:
        return None
    return [round(min(b[0] for b in boxes), 1), round(min(b[1] for b in boxes), 1),
            round(max(b[2] for b in boxes), 1), round(max(b[3] for b in boxes), 1)]


def pdf_source(frags: List[Fragment], snippet: Optional[str] = None) -> SourceRef:
    f0 = frags[0]
    ocr = [f for f in frags if f.ocr]
    shaky = ocr and (any(f.ocr_conf is not None and f.ocr_conf < settings.OCR_MIN_CONFIDENCE for f in ocr)
                     or any(f.bbox is None for f in ocr))  # a model-read line has no box: a human must look
    return SourceRef(file=f0.file, kind="pdf", page=f0.page, panel=f0.panel, bbox=union_bbox(frags),
                     snippet=_clean(snippet if snippet is not None else " ".join(f.text for f in frags)),
                     note=f"Read by OCR ({ocr[0].ocr})" if ocr else None, flagged=bool(shaky))


# --------------------------------------------------------------------------- PDF layout helpers


@dataclass
class Line:
    frags: List[Fragment]

    @property
    def text(self) -> str:
        return _clean(" ".join(f.text for f in self.frags))

    @property
    def bbox(self) -> List[float]:
        return union_bbox(self.frags) or [0, 0, 0, 0]

    @property
    def size(self) -> float:
        return max((f.size or 0) for f in self.frags)

    @property
    def height(self) -> float:
        b = self.bbox
        return b[3] - b[1]


@dataclass
class Block:
    lines: List[Line] = field(default_factory=list)

    @property
    def frags(self) -> List[Fragment]:
        return [f for ln in self.lines for f in ln.frags]

    @property
    def text(self) -> str:
        return _clean(" ".join(ln.text for ln in self.lines))

    @property
    def bbox(self) -> List[float]:
        return union_bbox(self.frags) or [0, 0, 0, 0]


def visible(ex: Extraction) -> List[Fragment]:
    return [f for f in ex.fragments if f.kind == "pdf" and not f.is_guide and not f.is_hidden]


def build_lines(frags: List[Fragment]) -> List[Line]:
    frags = sorted((f for f in frags if f.bbox), key=lambda f: ((f.bbox[1] + f.bbox[3]) / 2, f.bbox[0]))
    lines: List[Line] = []
    for f in frags:
        fy0, fy1 = f.bbox[1], f.bbox[3]
        placed = False
        for ln in lines:
            if ln.frags[0].panel != f.panel or ln.frags[0].page != f.page:
                continue
            ly0, ly1 = ln.bbox[1], ln.bbox[3]
            overlap = min(fy1, ly1) - max(fy0, ly0)
            if overlap < 0.5 * min(fy1 - fy0, ly1 - ly0):
                continue
            if abs((f.size or 0) - ln.frags[-1].size) > 0.6:
                continue
            gap = min(abs(f.bbox[0] - ln.bbox[2]), abs(ln.bbox[0] - f.bbox[2]))
            if f.bbox[0] > ln.bbox[2] and gap > max(6 * (f.size or 6), 40):
                continue
            if f.bbox[2] < ln.bbox[0] and gap > max(6 * (f.size or 6), 40):
                continue
            ln.frags.append(f)
            ln.frags.sort(key=lambda x: x.bbox[0])
            placed = True
            break
        if not placed:
            lines.append(Line([f]))
    lines.sort(key=lambda ln: (ln.bbox[1], ln.bbox[0]))
    return lines


def build_blocks(lines: List[Line]) -> List[Block]:
    blocks: List[Block] = []
    for ln in lines:
        starts_header = any(ln.text.upper().startswith(h) for h in BLOCK_HEADERS)
        target = None
        if not starts_header:
            for b in reversed(blocks):
                last = b.lines[-1]
                if last.frags[0].panel != ln.frags[0].panel:
                    continue
                gap = ln.bbox[1] - last.bbox[3]
                same_size = abs(last.size - ln.size) <= 0.8 or (len(b.lines) == 1 and last.text.endswith(":"))
                x_overlap = min(ln.bbox[2], last.bbox[2]) - max(ln.bbox[0], last.bbox[0])
                min_gap = -0.4 * min(last.height, ln.height)
                if min_gap <= gap <= max(last.height, ln.height) * 0.9 and same_size and x_overlap > 0:
                    target = b
                    break
        if target is None:
            blocks.append(Block([ln]))
        else:
            target.lines.append(ln)
    return blocks


def panel_blocks(ex: Extraction) -> List[Block]:
    return build_blocks(build_lines(visible(ex)))


# --------------------------------------------------------------------------- PDF readers


NUM_UNIT = r"(\d+(?:\.\d+)?)\s*(mcg|µg|mg|g|kcal|kj)"


def _nutrition_facts_lines(ex: Extraction) -> Tuple[List[Line], Optional[str]]:
    vis = visible(ex)
    header = next((f for f in vis if re.fullmatch(r"nutrition\s+facts", f.text.strip(), re.IGNORECASE)), None)
    if header is None:
        return [], None
    region = [f for f in vis if f.panel == header.panel and f.page == header.page and f.bbox
              and f.bbox[1] >= header.bbox[1] - 2 and f.bbox[0] >= header.bbox[0] - 15
              and f.bbox[2] <= header.bbox[0] + (header.bbox[2] - header.bbox[0]) * 1.4 + 20]
    return build_lines(region), header.panel


def read_nutrition_facts(ex: Extraction) -> Dict[str, List[Candidate]]:
    out: Dict[str, List[Candidate]] = {}
    lines, _ = _nutrition_facts_lines(ex)
    if not lines:
        return out

    def add(key: str, value: str, ln: Line):
        out.setdefault(key, []).append(Candidate(value=value, source=pdf_source(ln.frags, ln.text)))

    footnote: List[Line] = []
    ordered = sorted(NUTRIENTS, key=lambda n: -max(len(s) for s in n.synonyms))
    for ln in lines:
        t = ln.text
        low = t.lower()
        m = re.search(r"(about\s+)?(\d+(?:\.\d+)?)\s+servings?\s+per\s+(container|package|pack)", low)
        if m:
            add("servings_per_package", m.group(2), ln)
            continue
        if low.startswith("serving size"):
            rest = t[len("serving size"):].strip()
            if rest:
                add("serving_size", rest, ln)
            continue
        m = re.match(r"^calories\s+(\d+)", low)
        if m:
            add("calories", m.group(1), ln)
            continue
        if footnote:
            prev = footnote[-1]
            if ln.bbox[1] - prev.bbox[3] <= prev.height and abs(ln.size - prev.size) <= 1:
                footnote.append(ln)
            continue
        if t.startswith("*"):
            footnote.append(ln)
            continue
        m = re.match(r"^incl(?:udes)?\.?\s*(\d+(?:\.\d+)?\s*g)\s+added\s+sugars?\s*(\d+(?:\.\d+)?\s*%)?", low)
        if m:
            add("added_sugars", m.group(1).replace(" ", ""), ln)
            if m.group(2):
                add(dv_key("added_sugars"), m.group(2).replace(" ", ""), ln)
            continue
        for n in ordered:
            hit = next((s for s in sorted(n.synonyms, key=len, reverse=True) if low.startswith(s)), None)
            if not hit:
                continue
            rest = low[len(hit):]
            m = re.match(rf"\s*{NUM_UNIT}\s*(\d+(?:\.\d+)?\s*%)?", rest)
            if m:
                add(n.key, f"{m.group(1)}{m.group(2)}", ln)
                if m.group(3) and n.has_dv_line:
                    add(dv_key(n.key), m.group(3).replace(" ", ""), ln)
            break
    if footnote:
        frags = [f for ln in footnote for f in ln.frags]
        out.setdefault("nutrition_footnote", []).append(
            Candidate(value=_clean(" ".join(ln.text for ln in footnote)).lstrip("* "), source=pdf_source(frags)))
    return out


def _inside(frags: List[Fragment], box: Optional[List[float]]) -> bool:
    if not box:
        return False
    b = union_bbox(frags)
    if not b:
        return False
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    return box[0] - 2 <= cx <= box[2] + 2 and box[1] - 2 <= cy <= box[3] + 2


def _block_starting(blocks: List[Block], header: str, exclude_box: Optional[List[float]] = None) -> Optional[Block]:
    for b in blocks:
        if _inside(b.frags, exclude_box):
            continue
        if re.match(rf"^{header}\b", b.text, re.IGNORECASE):
            return b
    return None


class ArtworkFacts(BaseModel):
    """Observations about the artwork that checks need (beyond field values)."""

    claims: Dict[str, List[SourceRef]] = Field(default_factory=dict)
    net_weight_panels: List[str] = Field(default_factory=list)
    net_weight_sources: List[SourceRef] = Field(default_factory=list)
    hidden_blocks: List[SourceRef] = Field(default_factory=list)
    reference_intakes: Optional[SourceRef] = None
    dietary_statements: List[SourceRef] = Field(default_factory=list)
    front_panel_id: Optional[str] = None
    has_artwork: bool = False
    barcode_text_found: bool = False


def read_artwork(ex: Extraction) -> Tuple[Dict[str, List[Candidate]], ArtworkFacts]:
    out: Dict[str, List[Candidate]] = {}
    facts = ArtworkFacts()
    vis = visible(ex)
    if not vis:
        return out, facts
    facts.has_artwork = True
    front = next((p for p in ex.panels if p.is_main), None)
    facts.front_panel_id = front.id if front else None

    def add(key: str, value: str, frags: List[Fragment], snippet: Optional[str] = None):
        out.setdefault(key, []).append(Candidate(value=_clean(value), source=pdf_source(frags, snippet)))

    for k, cands in read_nutrition_facts(ex).items():
        out.setdefault(k, []).extend(cands)

    nf_lines, _ = _nutrition_facts_lines(ex)
    nf_box = union_bbox([f for ln in nf_lines for f in ln.frags])
    blocks = panel_blocks(ex)

    ing = _block_starting(blocks, "INGREDIENTS", nf_box)
    if ing:
        add("ingredients", strip_prefix(ing.text, "ingredients"), ing.frags)
    alg = _block_starting(blocks, "ALLERGEN", nf_box) or _block_starting(blocks, "CONTAINS", nf_box)
    if alg:
        add("allergen_statement", strip_prefix(alg.text, "allergen information", "allergens", "allergy advice"), alg.frags)
    diet = _block_starting(blocks, "DIETARY INFORMATION", nf_box)
    if diet:
        add("dietary_info", strip_prefix(diet.text, "dietary information"), diet.frags)
    prod = next((b for b in blocks if re.match(r"^(produced|manufactured|distributed|made|packed)\s+(by|for)\b", b.text, re.I)), None)
    if prod:
        add("producer", prod.text, prod.frags)

    # Statement of identity and variant: the largest text on the principal display panel.
    if front:
        front_lines = sorted((ln for ln in build_lines([f for f in vis if f.panel == front.id])), key=lambda ln: -ln.size)
        if front_lines:
            ident = front_lines[0]
            variant = next((ln for ln in front_lines[1:] if len(ln.text.split()) <= 4 and ln.text.isupper()
                            and "with" not in ln.text.lower()), None)
            if variant:
                add("variant", variant.text, variant.frags)
                add("statement_of_identity", f"{ident.text} — {variant.text}", ident.frags + variant.frags,
                    snippet=f"{ident.text} … {variant.text}")
            else:
                add("statement_of_identity", ident.text, ident.frags)

    # Net quantity: short standalone weight statements outside the nutrition panel.
    for b in blocks:
        if _inside(b.frags, nf_box):
            continue
        t = b.text
        m = re.fullmatch(r"(net\s*wt\.?\s*)?(\d+(?:\.\d+)?\s?(g|kg|oz|lb|ml|l))(\s*\(.*\))?", t.strip(), re.IGNORECASE)
        if m and len(t) <= 40:
            add("net_weight", t, b.frags)
            facts.net_weight_panels.append(b.frags[0].panel or "")
            facts.net_weight_sources.append(pdf_source(b.frags))

    # Claims: per panel, so multi-line badges ("NO / ADDED / SUGAR") are found.
    by_panel: Dict[str, List[Fragment]] = {}
    for f in vis:
        if not _inside([f], nf_box):
            by_panel.setdefault(f.panel or "?", []).append(f)
    for panel, frs in by_panel.items():
        frs = sorted(frs, key=lambda f: (f.bbox[1], f.bbox[0]))
        text = " ".join(f.text for f in frs)
        for claim, pat in CLAIM_PATTERNS:
            for m in re.finditer(pat, text, re.IGNORECASE):
                # map character span back to fragments
                pos, hit = 0, []
                for f in frs:
                    start, end = pos, pos + len(f.text)
                    if end > m.start() and start < m.end():
                        hit.append(f)
                    pos = end + 1
                if hit:
                    facts.claims.setdefault(claim, []).append(pdf_source(hit, m.group(0)))
    if facts.claims:
        add("claims", "; ".join(sorted(facts.claims)), [f for f in vis if not _inside([f], nf_box)][:1],
            snippet="Claims read from artwork text: " + ", ".join(sorted(facts.claims)))
        out["claims"][-1].source.bbox = None
        out["claims"][-1].source.panel = None

    for b in blocks:
        if re.search(r"\bvegans?\b|\bvegetarians?\b", b.text, re.I):
            facts.dietary_statements.append(pdf_source(b.frags))

    # Hidden content (present in file, covered in print)
    hidden = [f for f in ex.fragments if f.kind == "pdf" and f.is_hidden and not f.is_guide]
    hidden_by_panel: Dict[str, List[Fragment]] = {}
    for f in hidden:
        hidden_by_panel.setdefault(f"{f.page}:{f.panel}", []).append(f)
    for frs in hidden_by_panel.values():
        lines = build_lines(frs)
        facts.hidden_blocks.append(pdf_source([f for ln in lines for f in ln.frags], " / ".join(ln.text for ln in lines)))

    # EU-style front-of-pack reference-intake icons ("Fat 3.8g 4%") outside the nutrition panel
    ri_words = {"calories", "energy", "fat", "saturates", "sugars", "salt"}
    for panel, frs in by_panel.items():
        labels = [f for f in frs if f.text.strip().lower() in ri_words]
        if len({f.text.strip().lower() for f in labels}) >= 3:
            x0 = min(f.bbox[0] for f in labels) - 6
            x1 = max(f.bbox[2] for f in labels) + 30
            y0 = min(f.bbox[1] for f in labels) - 4
            y1 = max(f.bbox[3] for f in labels) + 20
            group = [f for f in frs if f.bbox[0] >= x0 and f.bbox[2] <= x1 and f.bbox[1] >= y0 and f.bbox[3] <= y1]
            facts.reference_intakes = pdf_source(group, " ".join(f.text for f in group))
            break

    # Locate content-sheet copy on the artwork (marketing copy, storage) by text similarity.
    out["_blocks"] = [Candidate(value=b.text, source=pdf_source(b.frags)) for b in blocks]

    facts.barcode_text_found = any(re.search(r"\b\d[\d ]{10,16}\d\b", f.text) for f in vis)
    return out, facts


# --------------------------------------------------------------------------- Excel readers


def excel_source(row: ExcelRow, file_name: str) -> SourceRef:
    return SourceRef(file=file_name, kind="excel", sheet=row.sheet, cell=row.value_cell,
                     snippet=_clean(row.value or ""), note=row.note,
                     flagged=bool(row.highlighted or (row.note and any(w in row.note.lower() for w in UNCERTAIN_WORDS))))


class SheetFacts(BaseModel):
    notes: Dict[str, List[SourceRef]] = Field(default_factory=dict)
    flagged: Dict[str, SourceRef] = Field(default_factory=dict)
    empty_with_note: Dict[str, SourceRef] = Field(default_factory=dict)
    nutrition_columns: Dict[str, Dict[str, Candidate]] = Field(default_factory=dict)
    table_header_cells: Dict[str, str] = Field(default_factory=dict)
    file: Optional[str] = None


def read_sheets(ex: Extraction) -> Tuple[Dict[str, List[Candidate]], SheetFacts]:
    out: Dict[str, List[Candidate]] = {}
    facts = SheetFacts()
    file_of_sheet: Dict[str, str] = {}
    for f in ex.fragments:
        if f.sheet:
            file_of_sheet.setdefault(f.sheet, f.file)
    for row in ex.excel_rows:
        key = match_label(row.label)
        if key is None:
            continue
        file_name = file_of_sheet.get(row.sheet, row.sheet)
        facts.file = facts.file or file_name
        src = excel_source(row, file_name)
        if row.note:
            facts.notes.setdefault(key, []).append(src)
        if is_empty_value(row.value):
            facts.empty_with_note[key] = src
            continue
        value = row.value or ""
        if key == "ingredients":
            value = strip_prefix(value, "ingredients")
        elif key == "allergen_statement":
            value = strip_prefix(value, "allergen information", "allergens")
        if src.flagged:
            facts.flagged[key] = src
        out.setdefault(key, []).append(Candidate(value=_clean(value), source=src))

    for t in ex.excel_tables:
        file_name = file_of_sheet.get(t.sheet, t.sheet)
        for col in t.columns:
            colmap: Dict[str, Candidate] = {}
            for rec, cells in zip(t.rows, t.cells):
                nkey = match_nutrient(rec.get("label") or "")
                if not nkey:
                    continue
                amount = rec.get(col)
                if not is_empty_value(amount):
                    colmap[nkey] = Candidate(value=_clean(str(amount)), source=SourceRef(
                        file=file_name, kind="excel", sheet=t.sheet, cell=cells.get(col),
                        snippet=f"{rec.get('label')}: {amount}", note=f"Column '{col}' of '{t.title}'"))
                dv = rec.get(f"{col} %DV")
                if nkey != "calories" and not is_empty_value(dv):
                    clean_dv = dv.replace("*", "").strip()
                    colmap[dv_key(nkey)] = Candidate(value=clean_dv, source=SourceRef(
                        file=file_name, kind="excel", sheet=t.sheet, cell=cells.get(f"{col} %DV"),
                        snippet=f"{rec.get('label')} %DV: {dv}", note=f"Column '{col}' of '{t.title}'"))
            if colmap:
                facts.nutrition_columns[col] = colmap
                facts.table_header_cells[col] = t.header_cell
    return out, facts
