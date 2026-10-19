"""Value parsing and comparison helpers shared by merge and checks."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from app.services.catalog import NUTRIENT_BY_KEY

G_PER_OZ = 28.349523125


def parse_amount(text: Optional[str]) -> Tuple[Optional[float], Optional[str]]:
    """'15g' -> (15.0, 'g'); '2.2%*' -> (2.2, '%'); '85' -> (85.0, None)."""
    if text is None:
        return None, None
    t = str(text).strip().lower().replace("µg", "mcg").replace(",", "")
    m = re.search(r"(<\s*)?(\d+(?:\.\d+)?)\s*(mcg|mg|kg|g|kcal|kj|oz|lb|ml|l|%)?", t)
    if not m:
        return None, None
    return float(m.group(2)), m.group(3)


def amount_in(text: Optional[str], unit: str) -> Optional[float]:
    """Amount converted to the requested unit when the text states a compatible unit."""
    value, u = parse_amount(text)
    if value is None:
        return None
    u = u or unit
    mass = {"mcg": 1e-6, "mg": 1e-3, "g": 1.0, "kg": 1000.0, "oz": G_PER_OZ, "lb": 453.59237}
    if u in mass and unit in mass:
        return value * mass[u] / mass[unit]
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
