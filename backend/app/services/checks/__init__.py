"""Runs every deterministic check against the current brief values."""

from __future__ import annotations

import re
import time
from typing import List, Tuple

from app.models.brief import BriefState, Issue, PassedCheck
from app.services.checks.base import CheckContext, Ctx
from app.services import trace
from app.services.guidelines import canonical_clause
from app.services.checks.claims import check_claims, suggested_allergen_statement
from app.services.checks.market import check_artwork_leftovers, check_barcode, check_us_rules, us_net_weight_text
from app.services.checks.nutrition import check_nutrition, fda_round_calories, serving_grams
from app.services.checks.sources import (check_assumptions, check_carryover, check_conflicts, check_missing,
                                         check_sheet_table)

SEVERITY_ORDER = {"blocking": 0, "warning": 1, "info": 2}
KIND_ORDER = {"definite": 0, "likely": 1, "needs_human": 2}


def _same_point(a: str, b: str) -> bool:
    """Two titles on the same field that share at least two content words say the same thing."""
    words = lambda t: {w for w in re.findall(r"[a-z]{4,}", t.lower())} - {"missing", "unclear", "check", "rule"}
    return len(words(a) & words(b)) >= 2


CHECK_STEPS = [
    ("Source conflicts", check_conflicts), ("Required fields", check_missing), ("Nutrition maths", check_nutrition),
    ("Claims and allergens", check_claims), ("Barcode", check_barcode), ("US label rules", check_us_rules),
    ("Artwork leftovers", check_artwork_leftovers), ("Content sheet tables", check_sheet_table),
    ("Assumed values", check_assumptions), ("New-market carry-over", check_carryover),
]


def run_checks(state: BriefState, saved: CheckContext) -> Tuple[List[Issue], List[PassedCheck]]:
    ctx = Ctx(state, saved)
    rec = trace.active()
    traced = bool(rec and rec.once("checks"))  # the first check pass of a brief build is shown in the trace
    for name, fn in CHECK_STEPS:
        if fn is check_nutrition and state.category != "food":  # Nutrition Facts maths applies to food only
            continue
        start, before = time.perf_counter(), len(ctx.issues)
        fn(ctx)
        if traced:
            new = ctx.issues[before:]
            worst = next((i for i in sorted(new, key=lambda i: SEVERITY_ORDER[i.severity])), None)
            cited = next((canonical_clause(c) for i in new for c in i.clauses), None)
            trace.event("checks", name, "warning" if any(i.severity in ("blocking", "warning") for i in new) else
                        "info" if new else "ok",
                        (f"{len(new)} finding{'s' if len(new) != 1 else ''}"
                         + (f", {n_block} blocking" if (n_block := sum(1 for i in new if i.severity == 'blocking')) else "")
                         + (f": {worst.title}" if worst else "")) if new else "No findings",
                        detail="; ".join(i.title for i in new[:8]) or None, citation=cited,
                        duration_ms=(time.perf_counter() - start) * 1000)
    for ai_issue in saved.ai_issues:
        # An AI point that repeats a code finding (same field and same clause) is merged into it.
        duplicate = any(set(ai_issue.fields) & set(c.fields)
                        and (({canonical_clause(x) for x in ai_issue.clauses} & {canonical_clause(x) for x in c.clauses})
                             or _same_point(ai_issue.title, c.title))
                        for c in ctx.issues if c.detected_by == "code")
        if not duplicate and all(state.field(k) and not state.field(k).user_confirmed for k in ai_issue.fields):
            ctx.issues.append(ai_issue.model_copy(deep=True))

    unique: dict[str, Issue] = {}
    for issue in ctx.issues:
        unique.setdefault(issue.id, issue)
    issues = list(unique.values())
    for issue in issues:
        if issue.id in state.acknowledgements:
            issue.state = "acknowledged"
            issue.acknowledgement = state.acknowledgements[issue.id]
    issues.sort(key=lambda i: (SEVERITY_ORDER[i.severity], KIND_ORDER[i.kind], i.resolution != "data", i.title))
    return issues, ctx.passed


__all__ = [
    "CheckContext",
    "run_checks",
    "suggested_allergen_statement",
    "us_net_weight_text",
    "fda_round_calories",
    "serving_grams",
]
