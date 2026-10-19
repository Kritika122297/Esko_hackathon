"""Combines candidates from every source into brief fields.

Policy (shown to users in the UI):
* A value is only ever taken from a source. Nothing is filled in by default.
* Sources that agree -> one value with all sources as proof.
* Sources that disagree -> the product spec (content sheet) value is shown provisionally,
  every alternative is kept, and the field needs review until a person decides.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from app.models.brief import BriefField, Candidate
from app.services.catalog import FIELDS
from app.services.extract_fields import ArtworkFacts, SheetFacts
from app.services.values import comparable, similarity

SOURCE_PRECEDENCE = {"user": 0, "excel": 1, "word": 2, "text": 3, "pdf": 4, "ai": 5, "derived": 6}
LOCATE_ON_ARTWORK = ("marketing_copy", "storage", "producer", "nutrition_footnote", "dietary_info")


def group_candidates(key: str, cands: List[Candidate]) -> List[List[Candidate]]:
    groups: Dict[str, List[Candidate]] = {}
    for c in cands:
        groups.setdefault(comparable(key, c.value), []).append(c)
    return list(groups.values())


def choose_nutrition_column(sheet: SheetFacts, artwork: Dict[str, List[Candidate]], net_weight: Optional[str]) -> Optional[str]:
    if not sheet.nutrition_columns:
        return None
    scores = {}
    for col, colmap in sheet.nutrition_columns.items():
        agree = 0
        for key, cand in colmap.items():
            for pc in artwork.get(key, []):
                if comparable(key, pc.value) == comparable(key, cand.value):
                    agree += 1
                    break
        scores[col] = agree
    best = max(scores, key=scores.get)
    if scores[best] > 0:
        return best
    if net_weight:
        for col in sheet.nutrition_columns:
            if comparable("net_weight", col) == comparable("net_weight", net_weight):
                return col
    return next(iter(sheet.nutrition_columns))


def build_fields(
    sheet_cands: Dict[str, List[Candidate]],
    sheet: SheetFacts,
    art_cands: Dict[str, List[Candidate]],
    art: ArtworkFacts,
    other_cands: Optional[Dict[str, List[Candidate]]] = None,
) -> tuple[List[BriefField], Optional[str]]:
    cands: Dict[str, List[Candidate]] = {}
    for src in (sheet_cands, other_cands or {}, art_cands):
        for k, lst in src.items():
            if not k.startswith("_"):
                cands.setdefault(k, []).extend(lst)

    # Nutrition values from the content-sheet table (column chosen by agreement with artwork)
    net = next((c.value for c in sheet_cands.get("net_weight", [])), None)
    column = choose_nutrition_column(sheet, art_cands, net)
    if column:
        for key, cand in sheet.nutrition_columns[column].items():
            cands.setdefault(key, []).insert(0, cand)

    # Find content-sheet copy on the artwork when no rule reads it directly
    blocks = art_cands.get("_blocks", [])
    for key in LOCATE_ON_ARTWORK:
        if any(c.source.kind == "pdf" for c in cands.get(key, [])):
            continue
        for sc in [c for c in cands.get(key, []) if c.source.kind != "pdf"]:
            best, score = None, 0.0
            for b in blocks:
                s = similarity(sc.value, b.value)
                if s > score:
                    best, score = b, s
            if best is not None and score >= 0.5:
                cands[key].append(best)

    fields: List[BriefField] = []
    for fd in FIELDS:
        lst = cands.get(fd.key, [])
        f = BriefField(key=fd.key, label=fd.label, section=fd.section, mandatory=fd.mandatory,
                       on_artwork=fd.on_artwork, candidates=lst)
        for src in sheet.notes.get(fd.key, []):
            f.notes.append(f"Content sheet note ({src.cell}): {src.note}")
        if fd.key in sheet.empty_with_note and not lst:
            e = sheet.empty_with_note[fd.key]
            f.notes.append(f"Content sheet value ({e.cell}): '{e.snippet}'")
        if lst:
            if fd.key == "claims":
                f.value = _merge_claims(lst)
                f.sources = [c.source for c in lst]
            else:
                groups = group_candidates(fd.key, lst)
                groups.sort(key=lambda g: min(SOURCE_PRECEDENCE.get(c.source.kind, 9) for c in g))
                chosen = groups[0]
                chosen.sort(key=lambda c: SOURCE_PRECEDENCE.get(c.source.kind, 9))
                f.value = chosen[0].value
                f.sources = [c.source for c in chosen]
                if len(groups) > 1:
                    f.notes.append("Sources disagree; the content-sheet value is shown until a person decides.")
        fields.append(f)
    return fields, column


def _merge_claims(cands: List[Candidate]) -> str:
    """The product spec's claim list wins; artwork-only claims are reported by a check."""
    ordered = sorted(cands, key=lambda c: SOURCE_PRECEDENCE.get(c.source.kind, 9))
    return ordered[0].value
