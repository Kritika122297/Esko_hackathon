"""Smart questions: only for open decisions, ranked, with one-click answers computed by code."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Dict, List

from app.models.brief import BriefState, Issue, Question, QuestionOption
from app.services.catalog import FIELD_BY_KEY, NUTRIENTS, dv_key
from app.services.merge import group_candidates
from app.services.values import amount_in, fmt_num, ingredient_name, parse_amount, split_ingredients

SEVERITY_RANK = {"blocking": 0, "warning": 1, "info": 2}


def _without_claim(state, pattern: str) -> Dict[str, str]:
    """Updates that take a claim out everywhere the brief makes it: the claim list and the dietary statement.
    Removing it from the list alone leaves 'suitable for vegans' in the copy, and the check would rightly stay open."""
    updates = {"claims": _remove_claims(state.value("claims") or "", pattern)}
    diet = state.value("dietary_info") or ""
    if re.search(pattern, diet, re.I):
        cleaned = re.sub(rf"\s*\(\s*{pattern}s?\s*\)", "", diet, flags=re.I)
        sentences = re.split(r"(?<=[.!?])\s+", cleaned)
        updates["dietary_info"] = " ".join(x for x in sentences if not re.search(pattern, x, re.I)).strip()
    return updates


def _remove_claims(claims: str, pattern: str) -> str:
    parts = [p.strip() for p in claims.split(";") if p.strip()]
    return "; ".join(p for p in parts if not re.search(pattern, p, re.I))


def _source_label(src) -> str:
    from app.services.checks.base import src_label
    return src_label(src)


def _opt(i: int, label: str, updates: Dict[str, str] | None = None, ack: bool = False, rec: bool = False) -> QuestionOption:
    """The id comes from what the option does, not its position, so a choice made on screen still means the
    same answer after a re-check reorders or adds options. (`i` only orders options for display.)"""
    digest = hashlib.sha1(json.dumps([label, updates or {}, ack], sort_keys=True).encode()).hexdigest()[:8]
    return QuestionOption(id=f"o-{digest}", label=label, updates=updates or {}, acknowledge=ack, recommended=rec)


def _ack(i: int, who: str) -> QuestionOption:
    return _opt(i, f"Leave open: pass to the agency as an open question ({who} to confirm)", ack=True)


def _question_for(issue: Issue, state: BriefState, saved) -> Question | None:
    v = state.value
    check = issue.check
    key = issue.fields[0] if issue.fields else None
    opts: List[QuestionOption] = []
    q_text = issue.title + "?"
    custom = None

    if check == "conflict" and key:
        f = state.field(key)
        groups = group_candidates(key, f.candidates)
        for n, g in enumerate(groups, start=1):
            labels = ", ".join(sorted({_source_label(c.source) for c in g}))
            opts.append(_opt(n, f"{g[0].value}  ({labels})", {key: g[0].value}))
        q_text = f"Which {f.label.lower()} is correct?"
        custom = key
    elif check == "math.servings":
        net = amount_in(v("net_weight"), "g")
        servings, _ = parse_amount(v("servings_per_package"))
        from app.services.checks import serving_grams
        from app.services.checks.base import Ctx
        sg = serving_grams(Ctx(state, saved))
        if net and servings:
            opts.append(_opt(1, f"Serving size is {fmt_num(net / servings)}g ({fmt_num(net)}g ÷ {fmt_num(servings)} servings)",
                             {"serving_size": f"{fmt_num(net / servings)}g"}, rec=True))
        if net and sg:
            opts.append(_opt(2, f"Serving size is {fmt_num(sg)}g, so about {fmt_num(round(net / sg * 2) / 2)} servings",
                             {"serving_size": f"{fmt_num(sg)}g", "servings_per_package": f"about {fmt_num(round(net / sg * 2) / 2)}"}))
        q_text = "What is the correct serving size?"
        custom = "serving_size"
    elif check == "math.calories":
        from app.services.checks import fda_round_calories
        fat = amount_in(v("total_fat"), "g")
        carbs = amount_in(v("total_carbohydrate"), "g")
        prot = amount_in(v("protein"), "g")
        if None not in (fat, carbs, prot):
            calc = fda_round_calories(fat * 9 + carbs * 4 + prot * 4)
            opts.append(_opt(1, f"Use the calculated value: {calc} kcal", {"calories": str(calc)}))
        opts.append(_ack(2, "R&D"))
        q_text = "Which calorie value should be printed?"
        custom = "calories"
    elif check == "math.sugars_gt_carbs":
        f = state.field("total_carbohydrate")
        for n, c in enumerate([c for c in f.candidates if c.value != f.value], start=1):
            opts.append(_opt(n, f"Total carbohydrate is {c.value} ({_source_label(c.source)})", {"total_carbohydrate": c.value}))
        opts.append(_ack(9, "R&D"))
        q_text = f"Total sugars ({v('total_sugars')}) exceed total carbohydrate ({v('total_carbohydrate')}). Which value is correct?"
        custom = "total_carbohydrate"
    elif check == "math.dv":
        updates = {}
        for n in NUTRIENTS:
            if n.daily_value and dv_key(n.key) in issue.fields:
                amt = amount_in(v(n.key), n.unit)
                if amt is not None:
                    updates[dv_key(n.key)] = f"{round(amt / n.daily_value * 100)}%"
        opts.append(_opt(1, "Replace with the recalculated %DV values: " + ", ".join(
            f"{FIELD_BY_KEY[k].label.replace(' %DV', '')} {val}" for k, val in updates.items()), updates, rec=True))
        opts.append(_ack(2, "R&D"))
        q_text = "Should the %Daily Value figures be recalculated from the amounts?"
    elif check == "claim.vegan_animal":
        upd = _without_claim(state, r"\bvegan")
        where = " and the dietary statement" if "dietary_info" in upd else ""
        opts.append(_opt(1, f"Remove the vegan claim from the claim list{where} (keep the recipe)", upd, rec=True))
        opts.append(_ack(2, "R&D (reformulation without honey)"))
        q_text = "The recipe contains honey. Should the vegan claim be removed?"
    elif check == "claim.vegan_cholesterol":
        opts.append(_opt(1, "Cholesterol is 0mg (correct the panel)", {"cholesterol": "0mg", dv_key("cholesterol"): "0%"}, rec=True))
        opts.append(_opt(2, "Remove the vegan claim", _without_claim(state, r"\bvegan")))
        q_text = f"Cholesterol is declared as {v('cholesterol')} on a vegan product. Which is correct?"
        custom = "cholesterol"
    elif check == "claim.no_added_sugar":
        opts.append(_opt(1, "Remove the 'No Added Sugar' claim", _without_claim(state, r"no\s+added\s+sugar"), rec=True))
        opts.append(_ack(2, "Legal"))
        q_text = "Honey and coconut sugar are added. Should 'No Added Sugar' be removed?"
    elif check == "claim.added_sugars_zero":
        opts.append(_ack(1, "R&D"))
        q_text = "What is the correct added sugars amount?"
        custom = "added_sugars"
    elif check in ("allergen.may_contain_present", "allergen.eu_wording", "allergen.undeclared", "allergen.no_statement"):
        m = re.search(r"Use: (.+)$|Add: (.+)$", issue.suggestion or "")
        if m:
            stmt = m.group(1) or m.group(2)
            opts.append(_opt(1, f"Use: {stmt}", {"allergen_statement": stmt}, rec=True))
        opts.append(_ack(2, "Legal"))
        q_text = "What allergen statement should the pack carry?"
        custom = "allergen_statement"
    elif check == "ingredients.duplicate":
        f = state.field("ingredients")
        items, seen = [], set()
        for it in split_ingredients(f.value or ""):
            name = ingredient_name(it)
            if name not in seen:
                seen.add(name)
                items.append(it)
        opts.append(_opt(1, "Remove the duplicate from the ingredient list", {"ingredients": ", ".join(items) + "."}, rec=True))
        q_text = "Remove the duplicated ingredient?"
        custom = "ingredients"
    elif check == "ingredients.percent_order":
        f = state.field("ingredients")
        for n, c in enumerate([c for c in f.candidates if c.value != f.value], start=1):
            opts.append(_opt(n, f"Use the ingredient list from {_source_label(c.source)}", {"ingredients": c.value}))
        q_text = "The declared ingredient percentages cannot be right. Which ingredient list is correct?"
        custom = "ingredients"
    elif check == "us.net_weight_oz":
        m = re.search(r"Use '(.+)'", issue.suggestion or "")
        if m:
            opts.append(_opt(1, f"Use '{m.group(1)}'", {"net_weight": m.group(1)}, rec=True))
        q_text = "Add ounces to the net weight?"
        custom = "net_weight"
    elif check == "us.serving_size_format":
        opts.append(_ack(1, "R&D"))
        q_text = "What is the serving size as it should be printed (household measure and grams)?"
        custom = "serving_size"
    elif check == "us.producer_address":
        opts.append(_ack(1, "Legal"))
        q_text = "What is the producer's full name and address?"
        custom = "producer"
    elif check in ("assumption", "plausibility.trans_fat", "plausibility.protein") and key:
        val = v(key)
        opts.append(_opt(1, f"Confirm '{val}' is correct", {key: val or ""}))
        opts.append(_ack(2, issue.owner))
        q_text = f"Is {FIELD_BY_KEY[key].label.lower()} '{val}' correct?"
        custom = key
    elif check == "carryover" and key and len(issue.fields) > 1:
        updates = {k: v(k) for k in issue.fields if v(k)}
        opts.append(_opt(1, f"Confirm all {len(updates)} values for {state.market}", updates))
        opts.append(_ack(2, issue.owner))
        q_text = f"Are the nutrition values from the old pack right for {state.market}?"
    elif check == "carryover" and key:
        val = v(key)
        opts.append(_opt(1, f"Confirm '{val}' for {state.market}", {key: val or ""}))
        opts.append(_ack(2, issue.owner))
        q_text = f"Is the {FIELD_BY_KEY[key].label.lower()} from the old pack right for {state.market}?"
        custom = key
    elif check == "claim.artwork_only":
        extra = re.findall(r"'([^']+)'", issue.description)
        claims = v("claims") or ""
        if extra:
            opts.append(_opt(1, f"Keep on pack and add to the claim list: {', '.join(extra)}",
                             {"claims": "; ".join([claims] + extra) if claims else "; ".join(extra)}))
        opts.append(_ack(2, "Brand"))
        q_text = "Keep the artwork-only claims?"
    elif check == "missing" and key:
        opts.append(_ack(1, issue.owner))
        q_text = f"What is the {FIELD_BY_KEY[key].label.lower()}?"
        custom = key
    elif check == "sheet.scaled_columns":
        opts.append(_ack(1, "R&D"))
        q_text = "Acknowledge the content-sheet nutrition column problem?"
    else:
        return None

    return Question(
        id=f"q:{issue.id}",
        issue_ids=[issue.id],
        fields=issue.fields,
        question=q_text,
        why=issue.description,
        owner=issue.owner,
        priority="must_answer" if issue.severity == "blocking" else "should_answer",
        options=opts,
        custom_field=custom,
    )


def build_questions(state: BriefState, saved) -> List[Question]:
    out: List[Question] = []
    by_field: Dict[str, Question] = {}
    for issue in sorted(state.issues, key=lambda i: SEVERITY_RANK[i.severity]):
        if issue.state != "open" or issue.resolution != "data":
            continue
        if issue.severity == "info" and issue.check != "claim.artwork_only":
            continue
        q = _question_for(issue, state, saved)
        if q is None:
            continue
        # One question per field decision: later issues on the same field join the first question.
        existing = by_field.get(q.custom_field) if q.custom_field else None
        if existing is not None:
            existing.issue_ids.append(issue.id)
            existing.why += f" Also: {issue.title}."
            labels = {o.label for o in existing.options}
            for o in q.options:
                if o.label not in labels:
                    existing.options.append(o)
            continue
        if q.custom_field:
            by_field[q.custom_field] = q
        out.append(q)
    for q in out:
        acks = [o for o in q.options if o.acknowledge]
        q.options = [o for o in q.options if not o.acknowledge] + acks[:1]
    return out
