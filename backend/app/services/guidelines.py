"""The guideline library: label-law clauses stored as data, selected by market and product category.

Each clause has an id (e.g. 'US-FDA/21CFR101.105'), its text, keywords, and the brief fields it requires.
Clauses are curated excerpts, not live scraping. Code uses them to decide what must be present;
every finding that comes from a clause cites its id.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

GUIDELINE_DIR = Path(__file__).resolve().parent.parent / "guidelines"
DEFAULT_CATEGORY = "food"


class Requirement(BaseModel):
    field: str
    severity: str = "blocking"
    owner: str = "Brand"
    any_of: List[str] = Field(default_factory=list, description="Other fields that satisfy this requirement instead")


class Clause(BaseModel):
    id: str
    standard: str
    standard_name: str = ""
    section: str = ""
    text: str
    keywords: List[str] = Field(default_factory=list)
    source: Optional[Dict[str, str]] = Field(None, description="Where the rule comes from: name and url (to check against)")
    requires: List[Requirement] = Field(default_factory=list)


class Standard(BaseModel):
    standard: str
    name: str
    status: str = "draft"  # draft until someone has checked every clause against the official text
    version: str = "0.1"
    ui_markets: List[Dict[str, str]] = Field(default_factory=list)
    markets: List[str]
    categories: List[str]
    clauses: List[Clause]


@lru_cache(maxsize=1)
def load_standards() -> Dict[str, Standard]:
    out: Dict[str, Standard] = {}
    for path in sorted(GUIDELINE_DIR.glob("*.json")):
        if path.name == "categories.json":
            continue
        raw = json.loads(path.read_text(encoding="utf-8"))
        scope = raw.get("applies_to", {})
        clauses = [Clause(standard=raw["standard"], standard_name=raw.get("name", ""), **c) for c in raw["clauses"]]
        out[raw["standard"]] = Standard(
            standard=raw["standard"], name=raw.get("name", raw["standard"]), status=raw.get("status", "draft"),
            version=str(raw.get("version", "0.1")), ui_markets=raw.get("ui_markets", []),
            markets=[m.upper() for m in scope.get("markets", ["*"])],
            categories=[c.lower() for c in scope.get("categories", ["*"])], clauses=clauses)
    return out


def standards_for(market: str, category: str = DEFAULT_CATEGORY, selected: Optional[List[str]] = None) -> List[Standard]:
    """Explicitly selected standards, or every standard matching the market and category.
    The 'base' standard always applies."""
    market, category = (market or "").upper(), (category or DEFAULT_CATEGORY).lower()
    chosen: List[Standard] = []
    for std in load_standards().values():
        if std.standard == "base":
            chosen.append(std)
        elif selected:
            if std.standard in selected:
                chosen.append(std)
        elif ("*" in std.markets or market in std.markets) and ("*" in std.categories or category in std.categories):
            chosen.append(std)
    return chosen


def clauses_for(market: str, category: str = DEFAULT_CATEGORY, selected: Optional[List[str]] = None) -> List[Clause]:
    return [c for s in standards_for(market, category, selected) for c in s.clauses]


def has_market_rules(market: str, category: str = DEFAULT_CATEGORY, selected: Optional[List[str]] = None) -> bool:
    """False when only the base standard matched, so the UI can say that only general checks ran."""
    return any(s.standard != "base" for s in standards_for(market, category, selected))


def requirements(market: str, category: str = DEFAULT_CATEGORY, selected: Optional[List[str]] = None,
                 extra: Optional[List[Clause]] = None) -> Dict[str, List[Tuple[Clause, Requirement]]]:
    """Field key -> every (clause, requirement) pair that requires it. `extra` adds a brief's own company rules."""
    out: Dict[str, List[Tuple[Clause, Requirement]]] = {}
    for clause in clauses_for(market, category, selected) + list(extra or []):
        for req in clause.requires:
            out.setdefault(req.field, []).append((clause, req))
    return out


def market_options() -> List[Dict[str, str]]:
    """Markets a user can pick, taken from the loaded packs."""
    seen: Dict[str, str] = {}
    for std in load_standards().values():
        for m in std.ui_markets:
            seen.setdefault(m["code"], m["label"])
    return [{"code": c, "label": l} for c, l in seen.items()]


@lru_cache(maxsize=1)
def category_labels() -> Dict[str, str]:
    """Category id -> label, from categories.json (the single list the app and the rule packs share)."""
    return json.loads((GUIDELINE_DIR / "categories.json").read_text(encoding="utf-8"))


def normalize_category(value: Optional[str]) -> Optional[str]:
    """'household' or 'Household & cleaning products' -> 'household'; an unknown value -> None. Empty -> default."""
    v = (value or "").strip()
    if not v:
        return DEFAULT_CATEGORY
    labels = category_labels()
    if v.lower() in labels:
        return v.lower()
    by_label = {label.lower(): cid for cid, label in labels.items()}
    return by_label.get(v.lower())


def category_options() -> List[Dict]:
    """Categories to pick from. Those without a rule pack are listed too, and run on the general checks only."""
    labels = json.loads((GUIDELINE_DIR / "categories.json").read_text(encoding="utf-8"))
    with_rules = {c for s in load_standards().values() if s.standard != "base" for c in s.categories if c != "*"}
    return [{"id": k, "label": v, "has_rules": k in with_rules} for k, v in labels.items()]


def summary(market: str, category: str = DEFAULT_CATEGORY, selected: Optional[List[str]] = None) -> Dict:
    """Which packs would apply, with their status and size, for the upload screen and the report."""
    packs = [{"standard": s.standard, "name": s.name, "status": s.status, "version": s.version,
              "clauses": len(s.clauses)} for s in standards_for(market, category, selected)]
    return {"packs": packs, "market_rules": has_market_rules(market, category, selected),
            "all_verified": all(p["status"] == "verified" for p in packs)}


def checklist(market: str, category: str = DEFAULT_CATEGORY, selected: Optional[List[str]] = None) -> List[Dict]:
    """The fields the rules require, with who owns each and which clause asks for it."""
    from app.services.catalog import FIELD_BY_KEY

    rows = []
    for key, pairs in requirements(market, category, selected).items():
        fd = FIELD_BY_KEY.get(key)
        if fd is None:
            continue
        alts = [FIELD_BY_KEY[a].label for _, r in pairs for a in r.any_of if a in FIELD_BY_KEY]
        rows.append({"key": key, "label": fd.label, "section": fd.section, "owner": pairs[0][1].owner,
                     "severity": pairs[0][1].severity, "clauses": [c.id for c, _ in pairs],
                     "or": sorted(set(alts))})
    return rows
