"""Shared context and helpers for the deterministic checks."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from pydantic import BaseModel

from app.models.brief import BriefField, BriefState, Issue, PassedCheck, SourceRef
from app.services.catalog import FIELD_BY_KEY, NUTRIENT_BY_KEY
from app.services.extract_fields import ArtworkFacts, SheetFacts
from app.services.values import amount_in, parse_amount


class CheckContext(BaseModel):
    """Facts saved at analysis time so checks can re-run after every human edit."""

    artwork: ArtworkFacts = ArtworkFacts()
    sheet: SheetFacts = SheetFacts()
    nutrition_column: Optional[str] = None
    ai_issues: List[Issue] = []
    question_text: Dict[str, Dict[str, str]] = {}  # AI rewording per question id


class Ctx:
    def __init__(self, state: BriefState, saved: CheckContext):
        self.state = state
        # New product: any artwork is a reference (often a sibling product), so artwork checks do not apply.
        self.art = ArtworkFacts() if state.case == "new_product" else saved.artwork
        self.sheet = saved.sheet
        self.column = saved.nutrition_column
        self.issues: List[Issue] = []
        self.passed: List[PassedCheck] = []

    # values -------------------------------------------------------------
    def f(self, key: str) -> Optional[BriefField]:
        return self.state.field(key)

    def v(self, key: str) -> Optional[str]:
        return self.state.value(key)

    def amt(self, key: str) -> Optional[float]:
        """Nutrient amount in the nutrient's own unit (g, mg, mcg)."""
        val = self.v(key)
        if key in NUTRIENT_BY_KEY:
            return amount_in(val, NUTRIENT_BY_KEY[key].unit)
        num, _ = parse_amount(val)
        return num

    def label(self, key: str) -> str:
        fd = FIELD_BY_KEY.get(key)
        return fd.label if fd else key

    def owner(self, key: str) -> str:
        fd = FIELD_BY_KEY.get(key)
        return fd.owner if fd else "Brand"

    def has_artwork(self) -> bool:
        return self.art.has_artwork

    # evidence ------------------------------------------------------------
    def ev(self, *keys: str, limit_per_field: int = 2) -> List[SourceRef]:
        out: List[SourceRef] = []
        for k in keys:
            f = self.f(k)
            if not f:
                continue
            for s in f.sources[:limit_per_field]:
                out.append(s)
        return out

    def all_values(self, key: str) -> List[tuple[str, SourceRef]]:
        """Every value read for a field (all sources), plus a user value if any."""
        f = self.f(key)
        if not f:
            return []
        out = [(c.value, c.source) for c in f.candidates]
        if f.user_confirmed and f.value is not None and all(v != f.value for v, _ in out):
            out.insert(0, (f.value, SourceRef(file="Reviewer", kind="user", snippet=f.value)))
        return out

    # output --------------------------------------------------------------
    def add(self, check: str, subject: Optional[str] = None, **kw) -> Issue:
        issue = Issue(id=f"{check}:{subject}" if subject else check, check=check, **kw)
        self.issues.append(issue)
        return issue

    def ok(self, check: str, title: str, detail: str, fields: Iterable[str] = ()) -> None:
        self.passed.append(PassedCheck(check=check, title=title, detail=detail, fields=list(fields)))


def src_label(s: SourceRef) -> str:
    if s.kind == "pdf":
        where = s.panel.replace("_", " ") if s.panel else f"page {s.page}"
        return f"Artwork ({where})"
    if s.kind == "excel":
        return f"Content sheet {s.cell}" if s.cell else "Content sheet"
    if s.kind == "user":
        return "Reviewer"
    if s.kind == "ai":
        return "AI vision reading"
    return s.file
