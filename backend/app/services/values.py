"""Value parsing and comparison helpers shared by merge and checks."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from app.services.catalog import NUTRIENT_BY_KEY

G_PER_OZ = 28.349523125


MASS = {"mcg": 1e-6, "mg": 1e-3, "g": 1.0, "kg": 1000.0, "oz": G_PER_OZ, "lb": 453.59237}
_AMOUNT = re.compile(r"(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|mcg|mg|kg|g|kcal|kj|oz|lbs?|ml|l|%)?(?![a-z])")
_LB_OZ = re.compile(r"(\d+(?:\.\d+)?)\s*lbs?\.?\s+(\d+(?:\.\d+)?)\s*oz\b")


def _normalise_numbers(text: str) -> str:
    """'1,000 g' -> '1000 g' (thousands); '3,5 g' -> '3.5 g' (European decimal comma)."""
    t = re.sub(r"(\d),(\d{3})(?!\d)", r"\1\2", text)
    return re.sub(r"(\d),(\d)", r"\1.\2", t)


def amounts(text: Optional[str]) -> List[Tuple[float, Optional[str]]]:
    """Every amount in the text, in order. '1 LB 4 OZ (567g)' -> [(20.0, 'oz'), (567.0, 'g')]; 'fl oz' is volume."""
    if text is None:
        return []
    t = _normalise_numbers(str(text).strip().lower().replace("µg", "mcg"))
    found: List[Tuple[int, float, Optional[str]]] = []
    for m in _LB_OZ.finditer(t):
        found.append((m.start(), float(m.group(1)) * 16 + float(m.group(2)), "oz"))
    t = _LB_OZ.sub(lambda m: " " * len(m.group(0)), t)  # same length, so positions stay comparable
    for m in _AMOUNT.finditer(t):
        unit = m.group(2)
        if unit:
            unit = "fl oz" if unit.startswith("fl") else ("lb" if unit.startswith("lb") else unit)
        found.append((m.start(), float(m.group(1)), unit))
    return [(v, u) for _, v, u in sorted(found)]


def parse_amount(text: Optional[str]) -> Tuple[Optional[float], Optional[str]]:
    """'15g' -> (15.0, 'g'); '2.2%*' -> (2.2, '%'); '85' -> (85.0, None); '3,5 g' -> (3.5, 'g')."""
    found = amounts(text)
    return found[0] if found else (None, None)


def amount_in(text: Optional[str], unit: str) -> Optional[float]:
    """Amount converted to the requested unit. A figure stated in that unit wins over a converted one:
    'NET WT 16.9 OZ (480g)' in grams is the declared 480, not 16.9 oz converted."""
    found = amounts(text)
    if not found:
        return None
    for value, u in found:
        if u == unit:
            return value
    for value, u in found:
        u = u or unit
        if u in MASS and unit in MASS:
            return value * MASS[u] / MASS[unit]
        if u == unit:
            return value
    return None


def grams(text: Optional[str]) -> Optional[float]:
    return amount_in(text, "g")


def norm_text(text: Optional[str]) -> str:
    t = (text or "").lower().replace("—", " ").replace("–", " ").replace("&", " and ")
    return " ".join(re.findall(r"[a-z0-9%.]+", t)).replace(" .", "").strip(" .")


def split_ingredients(text: Optional[str]) -> List[str]:
    """Splits on commas/periods that are not inside parentheses."""
    if not text:
        return []
    items, depth, buf = [], 0, ""
    for ch in text:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if ch in ",.;" and depth == 0:
            if ch == "." and buf and buf[-1].isdigit():
                buf += ch
                continue
            if buf.strip():
                items.append(buf.strip())
            buf = ""
            continue
        buf += ch
    if buf.strip():
        items.append(buf.strip())
    return [re.sub(r"\s+", " ", i) for i in items]


def ingredient_name(item: str) -> str:
    """'Honey (9%)' -> 'honey'; 'Dried Blueberries' -> 'dried blueberries'."""
    return norm_text(re.sub(r"\([^)]*\)", "", item))


def ingredient_percent(item: str) -> Optional[float]:
    m = re.search(r"\((\d+(?:\.\d+)?)\s*%\)", item)
    return float(m.group(1)) if m else None


NUMERIC_KEYS = {"calories", "servings_per_package", "net_weight", "serving_size"}


def is_numeric_key(key: str) -> bool:
    return key in NUMERIC_KEYS or key in NUTRIENT_BY_KEY or key.endswith("_dv")


def comparable(key: str, value: Optional[str]) -> str:
    """Canonical form used to decide whether two sources agree."""
    if value is None:
        return ""
    if key == "net_weight":
        g = grams(value)
        return f"{g:.1f}g" if g is not None else norm_text(value)
    if key.endswith("_dv"):
        v, _ = parse_amount(value)
        return f"{v:g}%" if v is not None else norm_text(value)
    if key in NUTRIENT_BY_KEY:
        unit = NUTRIENT_BY_KEY[key].unit
        v = amount_in(value, unit)
        return f"{v:g}{unit}" if v is not None else norm_text(value)
    if key in ("calories", "servings_per_package"):
        v, _ = parse_amount(value)
        return f"{v:g}" if v is not None else norm_text(value)
    if key in ("ingredients", "allergen_statement"):
        return "|".join(norm_text(i) for i in split_ingredients(value))
    return norm_text(value)


def similarity(a: str, b: str) -> float:
    ta, tb = set(norm_text(a).split()), set(norm_text(b).split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def fmt_num(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".")


def plural(n: int, word: str, many: str | None = None) -> str:
    """'1 decision', '3 decisions'; irregular forms through `many`."""
    return f"{n} {word if n == 1 else (many or word + 's')}"
