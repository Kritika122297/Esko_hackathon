"""Nutrition math, done by code. Code results override any AI opinion on calculable values."""

from __future__ import annotations

from typing import Optional

from app.services.catalog import NUTRIENTS, dv_key
from app.services.checks.base import Ctx
from app.services.values import amount_in, fmt_num, parse_amount


def fda_round_calories(kcal: float) -> int:
    """21 CFR 101.9(c)(1): <5 -> 0; <=50 -> nearest 5; >50 -> nearest 10."""
    if kcal < 5:
        return 0
    if kcal <= 50:
        return int(5 * round(kcal / 5))
    return int(10 * round(kcal / 10))


def serving_grams(ctx: Ctx) -> Optional[float]:
    """Grams from the serving size text; '(60g)' or a bare number read as grams."""
    text = ctx.v("serving_size")
    if not text:
        return None
    import re

    m = re.search(r"(\d+(?:\.\d+)?)\s*g\b", text.lower())
    if m:
        return float(m.group(1))
    num, unit = parse_amount(text)
    return num if unit in (None, "g") else None


def check_nutrition(ctx: Ctx) -> None:
    fat, sat, trans = ctx.amt("total_fat"), ctx.amt("saturated_fat"), ctx.amt("trans_fat")
    carbs, fiber = ctx.amt("total_carbohydrate"), ctx.amt("dietary_fiber")
    sugars, added = ctx.amt("total_sugars"), ctx.amt("added_sugars")
    protein = ctx.amt("protein")
    calories = ctx.amt("calories")

    # Sugars are part of carbohydrate
    sugars_fail = False
    if sugars is not None and carbs is not None:
        if sugars > carbs + 0.5:
            sugars_fail = True
            ctx.add("math.sugars_gt_carbs", severity="blocking", kind="definite", category="math",
                    title="Total sugars are higher than total carbohydrate",
                    description=f"Total sugars ({fmt_num(sugars)} g) are part of total carbohydrate ({fmt_num(carbs)} g), "
                                "so they cannot be larger. At least one of the two values is wrong.",
                    suggestion="Confirm both values from the lab report or recipe calculation.",
                    fields=["total_sugars", "total_carbohydrate"], evidence=ctx.ev("total_sugars", "total_carbohydrate"),
                    owner="R&D", design_action="change")
        else:
            ctx.ok("math.sugars_gt_carbs", "Sugars within carbohydrate",
                   f"{fmt_num(sugars)} g sugars <= {fmt_num(carbs)} g carbohydrate", ["total_sugars", "total_carbohydrate"])

    if not sugars_fail and carbs is not None and fiber is not None and sugars is not None and fiber + sugars > carbs + 0.5:
        ctx.add("math.carb_parts", severity="blocking", kind="definite", category="math",
                title="Fibre plus sugars exceed total carbohydrate",
                description=f"Dietary fibre ({fmt_num(fiber)} g) + total sugars ({fmt_num(sugars)} g) = "
                            f"{fmt_num(fiber + sugars)} g, more than total carbohydrate ({fmt_num(carbs)} g).",
                suggestion="Confirm carbohydrate, fibre and sugar values.",
                fields=["total_carbohydrate", "dietary_fiber", "total_sugars"],
                evidence=ctx.ev("total_carbohydrate", "dietary_fiber", "total_sugars"), owner="R&D", design_action="change")

    if added is not None and sugars is not None:
        if added > sugars + 0.5:
            ctx.add("math.added_gt_total", severity="blocking", kind="definite", category="math",
                    title="Added sugars exceed total sugars",
                    description=f"Added sugars ({fmt_num(added)} g) cannot exceed total sugars ({fmt_num(sugars)} g).",
                    fields=["added_sugars", "total_sugars"], evidence=ctx.ev("added_sugars", "total_sugars"),
                    owner="R&D", design_action="change")
        else:
            ctx.ok("math.added_gt_total", "Added sugars within total sugars",
                   f"{fmt_num(added)} g <= {fmt_num(sugars)} g", ["added_sugars", "total_sugars"])

    if fat is not None and (sat is not None or trans is not None):
        parts = (sat or 0) + (trans or 0)
        if parts > fat + 0.5:
            ctx.add("math.fat_parts", severity="blocking", kind="definite", category="math",
                    title="Saturated plus trans fat exceed total fat",
                    description=f"Saturated ({fmt_num(sat or 0)} g) + trans ({fmt_num(trans or 0)} g) = {fmt_num(parts)} g, "
                                f"more than total fat ({fmt_num(fat)} g).",
                    fields=["total_fat", "saturated_fat", "trans_fat"],
                    evidence=ctx.ev("total_fat", "saturated_fat", "trans_fat"), owner="R&D", design_action="change")
        else:
            ctx.ok("math.fat_parts", "Fat breakdown adds up",
                   f"saturated + trans = {fmt_num(parts)} g <= total fat {fmt_num(fat)} g",
                   ["total_fat", "saturated_fat", "trans_fat"])

    # Calories from macronutrients (Atwater 9/4/4)
    if calories is not None and fat is not None and carbs is not None and protein is not None:
        calc = fat * 9 + carbs * 4 + protein * 4
        if abs(calories - calc) > max(20.0, 0.2 * calc):
            ctx.add("math.calories", severity="blocking", kind="definite", category="math",
                    title="Calories do not match fat, carbohydrate and protein",
                    description=f"Stated {fmt_num(calories)} kcal. Calculated: {fmt_num(fat)}×9 + {fmt_num(carbs)}×4 + "
                                f"{fmt_num(protein)}×4 = {fmt_num(calc)} kcal (FDA-rounded {fda_round_calories(calc)}).",
                    suggestion="Recalculate calories once fat, carbohydrate and protein are confirmed.",
                    fields=["calories", "total_fat", "total_carbohydrate", "protein"],
                    evidence=ctx.ev("calories", "total_fat", "total_carbohydrate", "protein"), owner="R&D",
                    design_action="change")
        else:
            ctx.ok("math.calories", "Calories consistent with nutrients",
                   f"{fmt_num(calories)} kcal vs calculated {fmt_num(calc)} kcal", ["calories"])

    # Servings x serving size vs net weight
    sg = serving_grams(ctx)
    servings, _ = parse_amount(ctx.v("servings_per_package"))
    net = amount_in(ctx.v("net_weight"), "g")
    if sg and servings and net:
        total = sg * servings
        if abs(total - net) > 0.05 * net:
            ctx.add("math.servings", severity="blocking", kind="definite", category="math",
                    title="Servings × serving size does not equal the net weight",
                    description=f"{fmt_num(servings)} servings × {fmt_num(sg)} g = {fmt_num(total)} g, but the net weight is "
                                f"{fmt_num(net)} g. If {fmt_num(servings)} servings is right the serving is about "
                                f"{fmt_num(net / servings)} g; if {fmt_num(sg)} g is right there are about "
                                f"{fmt_num(net / sg)} servings.",
                    suggestion="Confirm the serving size with R&D.",
                    fields=["serving_size", "servings_per_package", "net_weight"],
                    evidence=ctx.ev("serving_size", "servings_per_package", "net_weight"), owner="R&D",
                    design_action="change")
        else:
            ctx.ok("math.servings", "Servings match net weight",
                   f"{fmt_num(servings)} × {fmt_num(sg)} g ≈ {fmt_num(net)} g",
                   ["serving_size", "servings_per_package", "net_weight"])

    # Nutrients cannot weigh more than the serving
    if sg and fat is not None and carbs is not None and protein is not None:
        mass = fat + carbs + protein
        if mass > sg * 1.02:
            ctx.add("math.mass", severity="blocking", kind="definite", category="math",
                    title="Nutrients weigh more than the serving",
                    description=f"Fat + carbohydrate + protein = {fmt_num(mass)} g, more than the {fmt_num(sg)} g serving.",
                    fields=["total_fat", "total_carbohydrate", "protein", "serving_size"],
                    evidence=ctx.ev("total_fat", "total_carbohydrate", "protein", "serving_size"), owner="R&D",
                    design_action="change")

    # %Daily Value recalculated from the amounts
    wrong, right = [], []
    for n in NUTRIENTS:
        if not n.daily_value:
            continue
        amount = ctx.amt(n.key)
        stated, _ = parse_amount(ctx.v(dv_key(n.key)))
        if amount is None or stated is None:
            continue
        calc = amount / n.daily_value * 100
        if abs(stated - calc) > max(2.0, 0.1 * calc):
            wrong.append((n, amount, stated, calc))
        else:
            right.append(n.label)
    if wrong:
        lines = [f"{n.label} {fmt_num(a)}{n.unit} → {round(c)}% (printed {fmt_num(s)}%)" for n, a, s, c in wrong]
        ctx.add("math.dv", severity="blocking", kind="definite", category="math",
                title=f"{len(wrong)} of the % Daily Value figures do not match their amounts",
                description="Recalculated from FDA reference daily values: " + "; ".join(lines) + ".",
                suggestion="Replace the %DV figures with the recalculated values after the amounts are confirmed.",
                fields=[dv_key(n.key) for n, *_ in wrong],
                evidence=ctx.ev(*[dv_key(n.key) for n, *_ in wrong], limit_per_field=1), owner="R&D",
                design_action="change")
    if right:
        ctx.ok("math.dv", "%DV correct", ", ".join(right))

    # Plausibility (likely, not definite)
    if trans is not None and sat is not None and trans > max(sat, 0.5):
        ctx.add("plausibility.trans_fat", severity="warning", kind="likely", category="plausibility",
                title="Trans fat is unusually high",
                description=f"Trans fat ({fmt_num(trans)} g) is higher than saturated fat ({fmt_num(sat)} g). "
                            "That is very unusual for a product without partially hydrogenated oils.",
                suggestion="Ask R&D to confirm the trans fat figure.",
                fields=["trans_fat"], evidence=ctx.ev("trans_fat", "saturated_fat"), owner="R&D")
    if protein is not None and sg:
        ptype = (ctx.v("product_type") or ctx.v("product_name") or "").lower()
        limit = 0.25 if any(w in ptype for w in ("granola", "cereal", "muesli", "oat")) else 0.5
        if protein / sg > limit:
            ctx.add("plausibility.protein", severity="warning", kind="likely", category="plausibility",
                    title="Protein is unusually high for this product",
                    description=f"{fmt_num(protein)} g protein in a {fmt_num(sg)} g serving is "
                                f"{round(protein / sg * 100)}% protein by weight; typical granola is about 8–15%.",
                    suggestion="Ask R&D to confirm the protein value.",
                    fields=["protein"], evidence=ctx.ev("protein", "serving_size"), owner="R&D")
