"""Claims, ingredients and allergens: meaning checks backed by explicit word lists."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from app.models.brief import SourceRef
from app.services.checks.base import Ctx, src_label
from app.services.checks.market import is_us
from app.services.values import fmt_num, ingredient_name, ingredient_percent, split_ingredients

ANIMAL_DERIVED = ("honey", "milk", "whey", "casein", "lactose", "butter", "cream", "egg", "gelatin",
                  "beeswax", "carmine", "cochineal", "lanolin", "shellac", "anchovy", "fish")
SUGAR_INGREDIENTS = ("honey", "cane sugar", "coconut sugar", "brown sugar", "sugar", "syrup", "molasses",
                     "agave", "nectar", "dextrose", "maltodextrin", "juice concentrate", "treacle")
# US major food allergens (FALCPA + FASTER Act). Tree nuts are named individually.
ALLERGEN_WORDS: Dict[str, Tuple[str, str]] = {
    "almond": ("Almonds", "tree nut"), "brazil": ("Brazil nuts", "tree nut"), "cashew": ("Cashews", "tree nut"),
    "hazelnut": ("Hazelnuts", "tree nut"), "macadamia": ("Macadamia nuts", "tree nut"),
    "pecan": ("Pecans", "tree nut"), "pistachio": ("Pistachios", "tree nut"), "walnut": ("Walnuts", "tree nut"),
    "pine nut": ("Pine nuts", "tree nut"), "peanut": ("Peanuts", "peanut"), "milk": ("Milk", "milk"),
    "egg": ("Eggs", "egg"), "wheat": ("Wheat", "wheat"), "soy": ("Soy", "soy"), "sesame": ("Sesame", "sesame"),
    "fish": ("Fish", "fish"), "shrimp": ("Shellfish", "shellfish"), "crab": ("Shellfish", "shellfish"),
    "lobster": ("Shellfish", "shellfish"),
}
EU_ALLERGEN_WORDING = ("cereals containing gluten", "may contain nuts", "contain nuts")


def _has(word: str, text: str) -> bool:
    return re.search(rf"\b{re.escape(word)}", text.lower()) is not None


def _allergens_in(text: str) -> List[str]:
    found = []
    low = text.lower()
    for word, (name, _) in ALLERGEN_WORDS.items():
        if re.search(rf"\b{word}", low) and name not in found:
            found.append(name)
    return found


def _claim_sources(ctx: Ctx, pattern: str) -> List[SourceRef]:
    out: List[SourceRef] = []
    for claim, srcs in ctx.art.claims.items():
        if re.search(pattern, claim, re.I):
            out += srcs
    for key in ("claims", "dietary_info"):
        for value, src in ctx.all_values(key):
            if re.search(pattern, value, re.I) and src.kind != "pdf":
                out.append(src)
    return out


def _ingredient_lists(ctx: Ctx) -> List[Tuple[str, SourceRef]]:
    f = ctx.f("ingredients")
    if not f:
        return []
    if f.user_confirmed and f.value:
        return [(f.value, SourceRef(file="Reviewer", kind="user", snippet=f.value))]
    return ctx.all_values("ingredients")


def _matches(words, lists) -> Dict[str, List[SourceRef]]:
    out: Dict[str, List[SourceRef]] = {}
    for text, src in lists:
        for item in split_ingredients(text):
            low = item.lower()
            for w in words:
                if re.search(rf"\b{re.escape(w)}", low):
                    out.setdefault(item if "(" in item else w, []).append(src)
                    break
    return out


def check_claims(ctx: Ctx) -> None:
    lists = _ingredient_lists(ctx)
    claims_text = (ctx.v("claims") or "")
    vegan_src = _claim_sources(ctx, r"\bvegan")
    nas_src = _claim_sources(ctx, r"no\s+added\s+sugar")

    animal = _matches(ANIMAL_DERIVED, lists)
    if vegan_src and animal:
        names = sorted({k for k in animal})
        ctx.add("claim.vegan_animal", severity="blocking", kind="definite", category="claim",
                title="Vegan claim, but the ingredients include animal products",
                description=f"The pack is labelled vegan, but the ingredient list contains {', '.join(names)}. "
                            "Honey and other animal-derived ingredients are not vegan.",
                suggestion="Remove the vegan claim and Certified Vegan mark, or reformulate.",
                fields=["claims", "ingredients", "dietary_info"],
                evidence=vegan_src[:3] + [s for v in animal.values() for s in v][:2], owner="Legal",
                design_action="change")

    chol = ctx.amt("cholesterol")
    if vegan_src and chol is not None and chol > 0:
        ctx.add("claim.vegan_cholesterol", severity="blocking", kind="definite", category="claim",
                title="Vegan claim, but cholesterol is declared",
                description=f"Cholesterol is only found in animal products. The panel declares {fmt_num(chol)} mg "
                            "while the pack is labelled vegan.",
                suggestion="Confirm cholesterol (expected 0 mg for a vegan product) or remove the vegan claim.",
                fields=["cholesterol", "claims"], evidence=ctx.ev("cholesterol") + vegan_src[:2], owner="R&D",
                design_action="change")
    elif vegan_src and chol is not None:
        ctx.ok("claim.vegan_cholesterol", "Vegan claim consistent with cholesterol", "0 mg cholesterol", ["cholesterol"])

    sugary = _matches(SUGAR_INGREDIENTS, lists)
    if nas_src and sugary:
        ctx.add("claim.no_added_sugar", severity="blocking", kind="likely", category="claim",
                title="'No Added Sugar' claim, but sugars are added",
                description=f"The pack claims No Added Sugar, but the ingredients include {', '.join(sorted(sugary))}. "
                            "US rules (21 CFR 101.60(c)(2)) do not allow this claim when sugar-containing ingredients "
                            "such as honey or coconut sugar are added.",
                suggestion="Remove the 'No Added Sugar' badge unless Legal confirms otherwise.",
                fields=["claims", "ingredients"], evidence=nas_src[:2] + [s for v in sugary.values() for s in v][:2],
                owner="Legal", design_action="remove")

    added = ctx.amt("added_sugars")
    if added is not None and added == 0 and sugary:
        ctx.add("claim.added_sugars_zero", severity="warning", kind="likely", category="claim",
                title="0 g added sugars declared, but sugars are added",
                description=f"The Nutrition Facts say 0 g added sugars, but {', '.join(sorted(sugary))} count as "
                            "added sugars under FDA rules.",
                suggestion="Ask R&D to recalculate added sugars.",
                fields=["added_sugars", "added_sugars_dv"], evidence=ctx.ev("added_sugars") + ctx.ev("ingredients", limit_per_field=1),
                owner="R&D", design_action="change")

    # Ingredient list quality, per source
    for text, src in lists:
        items = split_ingredients(text)
        names = [ingredient_name(i) for i in items]
        dups = sorted({n for n in names if n and names.count(n) > 1})
        if dups:
            ctx.add("ingredients.duplicate", src.kind, severity="warning", kind="likely", category="claim",
                    title="Ingredient listed twice",
                    description=f"{src_label(src)} lists {', '.join(d.title() for d in dups)} more than once.",
                    suggestion="Remove the duplicate entry.", fields=["ingredients"], evidence=[src], owner="R&D",
                    design_action="change")
        pcts = [(i, ingredient_percent(it), it) for i, it in enumerate(items)]
        declared = [(i, p, it) for i, p, it in pcts if p is not None]
        if declared:
            lower_bounds = []
            for i in range(len(items)):
                later = [p for j, p, _ in declared if j >= i]
                lower_bounds.append(max(later) if later else 0)
            total = sum(lower_bounds)
            if total > 100.5:
                last_i, last_p, last_item = declared[-1]
                ctx.add("ingredients.percent_order", src.kind, severity="blocking", kind="definite", category="math",
                        title="Ingredient percentages are impossible",
                        description=f"In {src_label(src)}, '{last_item}' is declared at {fmt_num(last_p)}%. Ingredients are "
                                    f"listed by weight, so the {last_i} ingredients before it must each be at least "
                                    f"{fmt_num(last_p)}%. Together the minimum is {fmt_num(total)}%, which exceeds 100%.",
                        suggestion="Confirm the declared percentages with R&D.",
                        fields=["ingredients"], evidence=[src], owner="R&D", design_action="change")

    _check_allergens(ctx, lists)
    _check_dietary_wording(ctx)
    _check_claim_coverage(ctx, claims_text)


def suggested_allergen_statement(ctx: Ctx) -> Optional[str]:
    lists = _ingredient_lists(ctx)
    contains: List[str] = []
    for text, _ in lists:
        for a in _allergens_in(text):
            if a not in contains:
                contains.append(a)
    advisory: List[str] = []
    stmt = ctx.v("allergen_statement") or ""
    for m in re.finditer(r"may\s+contain\s+([^,.;]+)", stmt, re.I):
        for part in re.split(r"\s+or\s+|\s+and\s+", m.group(1)):
            for a in _allergens_in(part):
                if a not in contains and a not in advisory:
                    advisory.append(a)
    if not contains and not advisory:
        return None
    tree_nuts = {name for name, cat in ALLERGEN_WORDS.values() if cat == "tree nut"}
    tree = [a for a in contains if a in tree_nuts]
    other = [a for a in contains if a not in tree]
    parts = []
    if tree:
        parts.append(f"TREE NUTS ({', '.join(t.upper() for t in tree)})")
    parts += [o.upper() for o in other]
    out = f"CONTAINS: {', '.join(parts)}." if parts else ""
    if advisory:
        out += f" MAY CONTAIN: {', '.join(a.upper() for a in advisory)}."
    return out.strip()


def _check_allergens(ctx: Ctx, lists) -> None:
    stmts = ctx.all_values("allergen_statement")
    f = ctx.f("allergen_statement")
    if f and f.user_confirmed and f.value:
        stmts = [(f.value, SourceRef(file="Reviewer", kind="user", snippet=f.value))]
    in_ingredients: Dict[str, List[SourceRef]] = {}
    for text, src in lists:
        for a in _allergens_in(text):
            in_ingredients.setdefault(a, []).append(src)
    suggestion = suggested_allergen_statement(ctx)
    flagged_may = set()
    for stmt, ssrc in stmts:
        may = set()
        for m in re.finditer(r"may\s+contain\s+([^,.;]+)", stmt, re.I):
            may.update(_allergens_in(m.group(1)))
        both = sorted(a for a in may if a in in_ingredients)
        if both and not flagged_may:
            flagged_may.update(both)
            ctx.add("allergen.may_contain_present", severity="blocking", kind="definite", category="allergen",
                    title="'May contain' used for allergens that are ingredients",
                    description=f"The allergen statement says 'May contain' {', '.join(both)}, but "
                                f"{'they are' if len(both) > 1 else 'it is'} in the ingredient list "
                                f"({', '.join(sorted({src_label(s) for a in both for s in in_ingredients[a]}))}). "
                                "Allergens that are ingredients must be declared with 'Contains'.",
                    suggestion=f"Use: {suggestion}" if suggestion else "Declare these allergens with 'Contains'.",
                    fields=["allergen_statement", "ingredients"],
                    evidence=[ssrc] + [s for a in both for s in in_ingredients[a]][:2], owner="Legal",
                    design_action="change")
        mentioned = set(_allergens_in(stmt))
        undeclared = sorted(a for a in in_ingredients if a not in mentioned)
        if undeclared:
            ctx.add("allergen.undeclared", ssrc.kind, severity="blocking", kind="definite", category="allergen",
                    title="Allergen in ingredients but not in the allergen statement",
                    description=f"{', '.join(undeclared)} appear in the ingredients but not in {src_label(ssrc)}'s "
                                "allergen statement.",
                    suggestion=f"Use: {suggestion}" if suggestion else None,
                    fields=["allergen_statement"], evidence=[ssrc], owner="Legal", design_action="change")
        low = stmt.lower()
        eu = [w for w in EU_ALLERGEN_WORDING if w in low]
        if eu and ctx.state.market.upper() in ("US", "USA", "UNITED STATES"):
            ctx.add("allergen.eu_wording", severity="warning", kind="likely", category="market_rule",
                    title="Allergen wording follows EU style, not US",
                    description="The statement uses " + ", ".join(f"'{w}'" for w in eu) + ". US labels name each "
                                "major allergen (e.g. 'Wheat', each tree nut by name) instead of 'cereals containing "
                                "gluten' or 'nuts'. Oats are not a US major allergen.",
                    suggestion=f"Use: {suggestion}" if suggestion else None,
                    fields=["allergen_statement"], evidence=[ssrc], owner="Legal", design_action="change")
            break
    if not stmts and in_ingredients:
        ctx.add("allergen.no_statement", severity="blocking", kind="definite", category="allergen",
                title="Allergens present but no allergen statement",
                description=f"The ingredients contain {', '.join(sorted(in_ingredients))}.",
                suggestion=f"Add: {suggestion}" if suggestion else None,
                fields=["allergen_statement"], evidence=[s for v in in_ingredients.values() for s in v][:2],
                owner="Legal", design_action="add")


def _check_dietary_wording(ctx: Ctx) -> None:
    vegetarian: List[SourceRef] = []
    vegan: List[SourceRef] = []
    seen = set()
    candidates = [(s.snippet, s) for s in ctx.art.dietary_statements] + ctx.all_values("dietary_info")
    for text, src in candidates:
        key = (text, src.cell, tuple(src.bbox or []))
        if key in seen:
            continue
        seen.add(key)
        low = text.lower()
        if re.search(r"\bvegetarians?\b", low):
            vegetarian.append(src)
        if re.search(r"\bvegans?\b", low):
            vegan.append(src)
    if vegetarian and (vegan or _claim_sources(ctx, r"\bvegan")):
        ctx.add("claim.vegetarian_vs_vegan", severity="warning", kind="likely", category="claim",
                title="Pack says both 'vegetarian' and 'vegan'",
                description="Some statements say 'suitable for vegetarians' and others say 'vegan'. These are "
                            "different claims, and the copy should use one consistently.",
                suggestion="Decide on one dietary claim (and check it against the ingredients).",
                fields=["dietary_info", "claims"], evidence=(vegetarian + vegan)[:4], owner="Legal",
                design_action="change")


def _check_claim_coverage(ctx: Ctx, claims_text: str) -> None:
    sheet = claims_text.lower()
    if not sheet or not ctx.art.claims:
        return
    ignore = {"Vegan", "Vegetarian", "Organic", "Recyclable"}
    art_only = [c for c in ctx.art.claims if c not in ignore and c.lower().replace("-", " ") not in sheet.replace("-", " ")]
    if art_only:
        ctx.add("claim.artwork_only", severity="info", kind="needs_human", category="claim",
                title="Claims on the artwork that the content sheet does not list",
                description="The artwork shows " + ", ".join(f"'{c}'" for c in art_only)
                            + " but the content sheet's claim list does not include it.",
                suggestion="Confirm whether to keep these claims and add them to the claim list.",
                fields=["claims"], evidence=[s for c in art_only for s in ctx.art.claims[c]][:3], owner="Brand")
    organic = "organic" in sheet or "Organic" in ctx.art.claims
    texts = " ".join(v for f in ctx.state.fields for v, _ in ctx.all_values(f.key)).lower()
    if organic and "certified organic by" not in texts and is_us(ctx):
        ctx.add("us.organic_certifier", severity="warning", kind="likely", category="market_rule",
                title="Organic certifier statement not found",
                description="The pack carries the USDA Organic seal, but no 'Certified organic by <certifying agent>' "
                            "statement was found. USDA rules (7 CFR 205.303) require it on the information panel.",
                suggestion="Brand to supply the certifier name; agency adds the statement under the producer details.",
                fields=["claims"], evidence=_claim_sources(ctx, "organic")[:2], owner="Legal",
                design_action="add", resolution="design")
