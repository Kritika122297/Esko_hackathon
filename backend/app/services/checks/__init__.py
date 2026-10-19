"""Runs every deterministic check against the current brief values."""

from __future__ import annotations

from typing import List, Tuple

from app.models.brief import BriefState, Issue, PassedCheck
from app.services.checks.base import CheckContext, Ctx
from app.services.checks.claims import check_claims, suggested_allergen_statement
from app.services.checks.market import check_artwork_leftovers, check_barcode, check_us_rules, us_net_weight_text
from app.services.checks.nutrition import check_nutrition, fda_round_calories, serving_grams
from app.services.checks.sources import check_assumptions, check_conflicts, check_missing, check_sheet_table

SEVERITY_ORDER = {"blocking": 0, "warning": 1, "info": 2}
KIND_ORDER = {"definite": 0, "likely": 1, "needs_human": 2}


def run_checks(state: BriefState, saved: CheckContext) -> Tuple[List[Issue], List[PassedCheck]]:
    ctx = Ctx(state, saved)
    check_conflicts(ctx)
    check_missing(ctx)
    check_nutrition(ctx)
    check_claims(ctx)
    check_barcode(ctx)
    check_us_rules(ctx)
    check_artwork_leftovers(ctx)
    check_sheet_table(ctx)
    check_assumptions(ctx)
    for ai_issue in saved.ai_issues:
        if all(state.field(k) and not state.field(k).user_confirmed for k in ai_issue.fields):
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
