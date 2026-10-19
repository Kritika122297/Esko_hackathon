"""Source checks: files that disagree, missing content, and values the sources themselves doubt."""

from __future__ import annotations

from typing import List

from app.services.catalog import FIELD_BY_KEY, FIELDS, NUTRIENT_BY_KEY
from app.services.checks.base import Ctx, src_label
from app.services.merge import group_candidates
from app.services.values import ingredient_name, ingredient_percent, split_ingredients


def _ingredient_diff(a: str, b: str) -> str:
    ia, ib = split_ingredients(a), split_ingredients(b)
    na = {ingredient_name(x): x for x in ia}
    nb = {ingredient_name(x): x for x in ib}
    only_a = [na[k] for k in na if k not in nb]
    only_b = [nb[k] for k in nb if k not in na]
    changed = [f"{na[k]} vs {nb[k]}" for k in na if k in nb and ingredient_percent(na[k]) != ingredient_percent(nb[k])]
    parts = []
    if only_a:
        parts.append("only in first: " + ", ".join(only_a))
    if only_b:
        parts.append("only in second: " + ", ".join(only_b))
    if changed:
        parts.append("different percentages: " + "; ".join(changed))
    return "; ".join(parts)


def check_conflicts(ctx: Ctx) -> None:
    for f in ctx.state.fields:
        if f.key == "claims" or f.user_confirmed or len(f.candidates) < 2:
            continue
        groups = group_candidates(f.key, f.candidates)
        if len(groups) < 2:
            continue
        reps = [g[0] for g in groups]
        lines = [f"{src_label(c.source)}: '{c.value}'" for c in reps]
        desc = f"The files give different values for {f.label.lower()}. " + " | ".join(lines) + "."
        if f.key in ("ingredients", "allergen_statement") and len(reps) >= 2:
            diff = _ingredient_diff(reps[0].value, reps[1].value)
            if diff:
                desc += f" Differences ({src_label(reps[0].source)} vs {src_label(reps[1].source)}): {diff}."
        fd = FIELD_BY_KEY[f.key]
        critical = fd.mandatory or f.key.endswith("_dv") or f.key in NUTRIENT_BY_KEY
        doc_groups = [g for g in groups if any(c.source.kind != "ai" for c in g)]
        if len(doc_groups) < 2:
            # Only the AI vision reading disagrees with the documents: a human must look.
            ai_vals = [c for g in groups for c in g if c.source.kind == "ai"]
            ctx.add(
                "vision", f.key, severity="warning", kind="needs_human", category="extraction",
                title=f"Visible print may differ from the file text: {f.label}",
                description=f"The file's text layer reads '{f.value}', but the AI reading of the rendered artwork "
                            f"sees '{ai_vals[0].value}'. Text hidden under other artwork, or overlapping guide lines, "
                            "can cause this.",
                suggestion="Check the printed proof and confirm the value.",
                fields=[f.key], evidence=[c.source for g in groups for c in g], owner=fd.owner,
                detected_by="ai",
            )
            continue
        ctx.add(
            "conflict", f.key,
            severity="blocking" if critical else "warning",
            kind="definite",
            category="conflict",
            title=f"Files disagree: {f.label}",
            description=desc,
            suggestion="Confirm which value is correct. Until then the brief shows the content-sheet value.",
            fields=[f.key],
            evidence=[c.source for g in groups for c in g],
            owner=fd.owner,
            design_action="unknown",
        )


def check_missing(ctx: Ctx) -> None:
    for fd in FIELDS:
        if not fd.mandatory:
            continue
        f = ctx.f(fd.key)
        if f is None or f.value:
            continue
        note = next((n for n in f.notes), "")
        ctx.add(
            "missing", fd.key,
            severity="blocking",
            kind="definite",
            category="missing",
            title=f"Missing: {fd.label}",
            description=f"No source provides {fd.label.lower()}, and it must appear on the pack."
                        + (f" {note}" if note else ""),
            suggestion="Provide the value. The system does not fill it in.",
            fields=[fd.key],
            evidence=[ctx.sheet.empty_with_note[fd.key]] if fd.key in ctx.sheet.empty_with_note else [],
            owner=fd.owner,
            design_action="unknown",
        )

    optional_missing: List[str] = []
    for key in ("last_edited", "last_published", "registration"):
        f = ctx.f(key)
        if f is not None and not f.value:
            optional_missing.append(f.label.lower())
    if optional_missing:
        ctx.add(
            "missing.project_details",
            severity="info",
            kind="needs_human",
            category="missing",
            title="Project details not provided",
            description="Not available in any file: " + ", ".join(optional_missing)
                        + ". They are not printed on the pack, so they do not block the brief.",
            fields=["last_edited", "last_published", "registration"],
            evidence=[s for k, s in ctx.sheet.empty_with_note.items() if k in ("last_edited", "last_published", "registration")],
            owner="Brand",
        )


def check_assumptions(ctx: Ctx) -> None:
    """Values the content sheet itself marks as assumed or uncertain (highlight or note)."""
    covered = {k for i in ctx.issues if i.severity in ("blocking", "warning") for k in i.fields}
    for key, src in ctx.sheet.flagged.items():
        f = ctx.f(key)
        if f is None or not f.value or f.user_confirmed or key in covered:
            continue
        fd = FIELD_BY_KEY[key]
        ctx.add(
            "assumption", key,
            severity="warning" if fd.on_artwork else "info",
            kind="needs_human",
            category="assumption",
            title=f"Assumed value needs confirmation: {fd.label}",
            description=f"The content sheet marks '{f.value}' as uncertain."
                        + (f" Note in {src.cell}: \"{src.note}\"" if src.note else " The cell is highlighted for review."),
            suggestion="Confirm the value or replace it.",
            fields=[key],
            evidence=[src],
            owner=fd.owner,
        )


def check_sheet_table(ctx: Ctx) -> None:
    """Nutrition tables whose extra pack-size columns just scale per-serving values."""
    cols = ctx.sheet.nutrition_columns
    if len(cols) < 2 or not ctx.column:
        return
    base = cols[ctx.column].get("calories")
    if base is None:
        return
    from app.services.values import grams, parse_amount

    base_cal, _ = parse_amount(base.value)
    scaled = []
    for col, cmap in cols.items():
        if col == ctx.column or "calories" not in cmap:
            continue
        cal, _ = parse_amount(cmap["calories"].value)
        gb, gc = grams(ctx.column), grams(col)
        if base_cal and cal and gb and gc and abs(cal / base_cal - gc / gb) < 0.03:
            scaled.append((col, cal / base_cal, cmap["calories"].source))
    if not scaled:
        return
    net = ctx.v("net_weight")
    desc = (
        f"The content-sheet column '{ctx.column}' holds the values printed on the pack"
        + (f" (the pack is {net})" if net else "")
        + ". Columns " + ", ".join(f"'{c}' (x{r:.2f})" for c, r, _ in scaled)
        + " repeat those per-serving values multiplied by the pack-weight ratio. Per-serving values do not change"
          " with pack size, so these columns look like a spreadsheet error."
    )
    ctx.add(
        "sheet.scaled_columns",
        severity="warning",
        kind="likely",
        category="conflict",
        title="Content sheet nutrition columns look scaled by pack size",
        description=desc,
        suggestion=f"Use the '{ctx.column}' column (matches the artwork) and correct or remove the other columns.",
        fields=["calories"],
        evidence=[base.source] + [s for _, _, s in scaled],
        owner="R&D",
    )
