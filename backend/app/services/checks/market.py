"""Target-market label rules (a small, explicit US rule list) and artwork-file hygiene."""

from __future__ import annotations

import re
from typing import Optional

from app.services.catalog import NUTRIENTS
from app.services.checks.base import Ctx
from app.services.values import G_PER_OZ, amount_in, fmt_num

US_NAMES = ("US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA")


def is_us(ctx: Ctx) -> bool:
    market = (ctx.state.market or ctx.v("market") or "").upper()
    return market in US_NAMES


def upc_check_digit_ok(code: str) -> Optional[bool]:
    digits = re.sub(r"\D", "", code)
    if len(digits) not in (8, 12, 13, 14):
        return None
    body, check = digits[:-1], int(digits[-1])
    total = 0
    for i, ch in enumerate(reversed(body)):
        total += int(ch) * (3 if i % 2 == 0 else 1)
    return (10 - total % 10) % 10 == check


def us_net_weight_text(grams: float) -> str:
    return f"NET WT {grams / G_PER_OZ:.1f} OZ ({fmt_num(grams)}g)"


def check_barcode(ctx: Ctx) -> None:
    code = ctx.v("barcode")
    if not code:
        return
    ok = upc_check_digit_ok(code)
    if ok is None:
        ctx.add("barcode.format", severity="blocking", kind="definite", category="math",
                title="Barcode number has an invalid length",
                description=f"'{code}' is not a valid UPC/EAN length (8, 12, 13 or 14 digits).",
                fields=["barcode"], evidence=ctx.ev("barcode"), owner="Supply Chain", design_action="unknown")
    elif not ok:
        ctx.add("barcode.check_digit", severity="blocking", kind="definite", category="math",
                title="Barcode check digit is wrong",
                description=f"The last digit of '{code}' does not match the GS1 check-digit calculation.",
                suggestion="Confirm the registered GTIN with Supply Chain.",
                fields=["barcode"], evidence=ctx.ev("barcode"), owner="Supply Chain", design_action="unknown")
    else:
        ctx.ok("barcode.check_digit", "Barcode check digit valid", f"{code} passes the GS1 check-digit test", ["barcode"])
    if ctx.has_artwork() and not ctx.art.barcode_text_found:
        ctx.add("barcode.unverified", severity="info", kind="needs_human", category="extraction",
                title="Barcode digits could not be read from the artwork",
                description=f"The barcode on the artwork is an image, so its digits could not be compared with "
                            f"the content sheet ({code}).",
                suggestion="Agency to confirm the printed digits match.",
                fields=["barcode"], evidence=ctx.ev("barcode"), owner="Agency", resolution="design")


def check_us_rules(ctx: Ctx) -> None:
    if not is_us(ctx):
        return

    net = ctx.v("net_weight")
    g = amount_in(net, "g") if net else None
    if net and g and "oz" not in net.lower():
        ctx.add("us.net_weight_oz", clauses=["US-FDA/21CFR101.105"], severity="blocking", kind="definite", category="market_rule",
                title="Net weight is missing ounces",
                description=f"The net weight reads '{net}'. US labels must state it in both US customary and metric "
                            f"units (21 CFR 101.105), e.g. '{us_net_weight_text(g)}'.",
                suggestion=f"Use '{us_net_weight_text(g)}'.",
                fields=["net_weight"], evidence=ctx.ev("net_weight", limit_per_field=3), owner="Legal",
                design_action="change")
    elif net and "oz" in net.lower():
        ctx.ok("us.net_weight_oz", "Net weight in dual units", net, ["net_weight"])

    front = ctx.art.front_panel_id
    if ctx.has_artwork() and front and ctx.art.net_weight_panels and front not in ctx.art.net_weight_panels:
        panels = ", ".join(sorted({p.replace("_", " ") for p in ctx.art.net_weight_panels if p}))
        ctx.add("us.net_weight_pdp", clauses=["US-FDA/21CFR101.105"], severity="blocking", kind="definite", category="market_rule",
                title="Net weight is not on the front panel",
                description=f"The net weight appears only on the {panels} panel. US rules require it on the principal "
                            "display panel, in the bottom 30% of the panel.",
                suggestion="Agency to place the net weight statement in the bottom 30% of the front panel.",
                fields=["net_weight"], evidence=ctx.art.net_weight_sources[:2], owner="Agency",
                design_action="add", resolution="design")

    ss = ctx.v("serving_size")
    if ctx.state.category == "food" and ss and not re.search(r"\d\s*(g|ml)\b", ss.lower()):
        ctx.add("us.serving_size_format", clauses=["US-FDA/21CFR101.9-servings"], severity="blocking", kind="definite", category="market_rule",
                title="Serving size has no unit",
                description=f"The serving size reads '{ss}'. US Nutrition Facts state a household measure and the "
                            "metric amount, e.g. '2/3 cup (60g)'.",
                suggestion="R&D to supply the household measure and grams.",
                fields=["serving_size"], evidence=ctx.ev("serving_size"), owner="R&D", design_action="change")

    producer = ctx.v("producer")
    if producer and not re.search(r"\b\d{5}\b|,\s*[A-Z]{2}\b", producer):
        ctx.add("us.producer_address", clauses=["US-FDA/21CFR101.5"], severity="blocking", kind="definite", category="market_rule",
                title="Producer statement has no address",
                description=f"'{producer}' gives a name only. US labels must show the name and place of business "
                            "(city, state and ZIP code) of the manufacturer, packer or distributor (21 CFR 101.5).",
                suggestion="Legal to supply the full producer statement, e.g. 'Produced by ... , City, ST 00000'.",
                fields=["producer"], evidence=ctx.ev("producer"), owner="Legal", design_action="change")

    if ctx.has_artwork() and ctx.state.category == "food":
        missing = [n.label for n in NUTRIENTS if not any(c.source.kind == "pdf" for c in (ctx.f(n.key).candidates if ctx.f(n.key) else []))]
        if missing and len(missing) < len(NUTRIENTS):
            ctx.add("us.nutrition_lines", clauses=["US-FDA/21CFR101.9-nutrients"], severity="blocking", kind="definite", category="market_rule",
                    title="Nutrition Facts lines missing on the artwork",
                    description="Not found on the Nutrition Facts panel: " + ", ".join(missing) + ".",
                    fields=[n.key for n in NUTRIENTS if n.label in missing], owner="Legal", design_action="add",
                    resolution="design")
        elif not missing:
            ctx.ok("us.nutrition_lines", "All mandatory Nutrition Facts lines present", "14 of 14 nutrient lines found")

    if ctx.art.reference_intakes:
        ri = ctx.art.reference_intakes
        ctx.add("us.eu_reference_intakes", severity="warning", kind="likely", category="market_rule",
                title="EU-style reference-intake icons on a US pack",
                description=f"The {ri.panel.replace('_', ' ') if ri.panel else ''} panel shows front-of-pack "
                            f"reference-intake icons ('{ri.snippet[:80]}'). These are an EU format; their values also "
                            "do not match the US Nutrition Facts.",
                suggestion="Remove the icons for the US version.",
                evidence=[ri], owner="Agency", design_action="remove", resolution="design")


def check_artwork_leftovers(ctx: Ctx) -> None:
    for i, hb in enumerate(ctx.art.hidden_blocks):
        if len(hb.snippet) < 6:
            continue
        nutrition_like = re.search(r"per\s*100\s*g|energy|kj|carbohydrate|of\s*which", hb.snippet, re.I)
        ctx.add("artwork.hidden_text", str(i), severity="warning", kind="needs_human", category="extraction",
                title="Hidden text found in the artwork file" + (" (an EU nutrition table)" if nutrition_like else ""),
                description=f"The file contains text that is covered by other artwork and does not show in print: "
                            f"'{hb.snippet[:140]}'. Leftover content like this can reappear when the file is edited.",
                suggestion="Agency to delete the hidden content from the native artwork file.",
                evidence=[hb], owner="Agency", design_action="remove", resolution="design")
