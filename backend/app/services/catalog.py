"""The standard brief schema: every field, its section, Excel synonyms and rules metadata."""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class FieldDef:
    key: str
    label: str
    section: str
    synonyms: Tuple[str, ...] = ()
    mandatory: bool = False
    on_artwork: bool = False
    owner: str = "Brand"


@dataclass(frozen=True)
class NutrientDef:
    key: str
    label: str
    unit: str
    synonyms: Tuple[str, ...]
    daily_value: Optional[float] = None  # FDA reference daily value, same unit
    has_dv_line: bool = True


SECTIONS: List[str] = [
    "Project",
    "Product",
    "Legal & Identity",
    "Ingredients & Allergens",
    "Claims & Certifications",
    "Quantity",
    "Nutrition",
    "Other Pack Copy",
]

# FDA 21 CFR 101.9 reference daily values (adults and children 4+)
NUTRIENTS: List[NutrientDef] = [
    NutrientDef("total_fat", "Total Fat", "g", ("total fat", "fat"), 78),
    NutrientDef("saturated_fat", "Saturated Fat", "g", ("saturated fat", "saturates"), 20),
    NutrientDef("trans_fat", "Trans Fat", "g", ("trans fat",), None, has_dv_line=False),
    NutrientDef("cholesterol", "Cholesterol", "mg", ("cholesterol",), 300),
    NutrientDef("sodium", "Sodium", "mg", ("sodium",), 2300),
    NutrientDef("total_carbohydrate", "Total Carbohydrate", "g", ("total carbohydrate", "carbohydrate", "total carbs"), 275),
    NutrientDef("dietary_fiber", "Dietary Fiber", "g", ("dietary fiber", "fibre", "fiber"), 28),
    NutrientDef("total_sugars", "Total Sugars", "g", ("total sugars", "sugars"), None, has_dv_line=False),
    NutrientDef("added_sugars", "Added Sugars", "g", ("incl. added sugars", "added sugars"), 50),
    NutrientDef("protein", "Protein", "g", ("protein",), None, has_dv_line=False),
    NutrientDef("vitamin_d", "Vitamin D", "mcg", ("vitamin d",), 20),
    NutrientDef("calcium", "Calcium", "mg", ("calcium",), 1300),
    NutrientDef("iron", "Iron", "mg", ("iron",), 18),
    NutrientDef("potassium", "Potassium", "mg", ("potassium",), 4700),
]
NUTRIENT_BY_KEY: Dict[str, NutrientDef] = {n.key: n for n in NUTRIENTS}


def dv_key(nutrient_key: str) -> str:
    return f"{nutrient_key}_dv"


_FIELDS: List[FieldDef] = [
    # Project
    FieldDef("label_id", "Label identifier", "Project", ("label identifier", "label id"), owner="Brand"),
    FieldDef("project_status", "Project status", "Project", ("status",), owner="Brand"),
    FieldDef("market", "Country of market", "Project", ("country of market", "market", "country"), mandatory=True, owner="Brand"),
    FieldDef("region", "Region / cluster", "Project", ("region/cluster", "region", "operating unit")),
    FieldDef("bpn", "BPN (product number)", "Project", ("bpn",), owner="Supply Chain"),
    FieldDef("registration", "Registration number", "Project", ("registration info / number", "registration info", "registration number")),
    FieldDef("last_edited", "Last edited date", "Project", ("last edited date",)),
    FieldDef("last_published", "Last published date", "Project", ("last published date",)),
    # Product
    FieldDef("brand", "Brand", "Product", ("brand",), mandatory=True, on_artwork=True),
    FieldDef("product_name", "Product name", "Product", ("product name",), mandatory=True, on_artwork=True),
    FieldDef("variant", "Flavour / variant", "Product", ("flavour", "flavor", "variant"), on_artwork=True),
    FieldDef("product_type", "Product type", "Product", ("product type",)),
    FieldDef("process_type", "Process", "Product", ("process type",)),
    FieldDef("end_use", "End use", "Product", ("end use",)),
    FieldDef("marketing_copy", "Marketing copy", "Product", ("marketing copy",), on_artwork=True),
    # Legal & identity
    FieldDef("statement_of_identity", "Statement of identity", "Legal & Identity",
             ("legal name / statement of identity", "statement of identity", "legal name"),
             mandatory=True, on_artwork=True, owner="Legal"),
    FieldDef("language", "Language(s)", "Legal & Identity", ("language(s)", "language")),
    FieldDef("producer", "Producer name and address", "Legal & Identity",
             ("producer", "manufacturer", "manufactured by", "distributed by"),
             mandatory=True, on_artwork=True, owner="Legal"),
    # Ingredients & allergens
    FieldDef("ingredients", "Ingredient list", "Ingredients & Allergens", ("ingredient list", "ingredients"),
             mandatory=True, on_artwork=True, owner="R&D"),
    FieldDef("allergen_statement", "Allergen statement", "Ingredients & Allergens",
             ("allergen information", "allergen statement", "allergens"), mandatory=True, on_artwork=True, owner="Legal"),
    FieldDef("dietary_info", "Dietary information", "Ingredients & Allergens", ("dietary information",),
             on_artwork=True, owner="Legal"),
    FieldDef("nutritive_sweetener", "Nutritive sweetener", "Ingredients & Allergens", ("nutritive sweetener",), owner="R&D"),
    # Claims
    FieldDef("claims", "Claims and certifications", "Claims & Certifications",
             ("front/back panel claims & certifications", "claims & certifications", "claims"),
             on_artwork=True, owner="Legal"),
    # Quantity
    FieldDef("net_weight", "Net weight", "Quantity", ("package size / net weight", "net weight", "portions selected"),
             mandatory=True, on_artwork=True, owner="Supply Chain"),
    FieldDef("servings_per_package", "Servings per package", "Quantity",
             ("number of servings per package", "servings per package", "servings per container"),
             mandatory=True, on_artwork=True, owner="R&D"),
    FieldDef("serving_size", "Serving size", "Quantity", ("serving size",), mandatory=True, on_artwork=True, owner="R&D"),
    FieldDef("package_type", "Package type", "Quantity", ("package type",), owner="Supply Chain"),
    # Nutrition
    FieldDef("nutrition_format", "Nutrition panel format", "Nutrition", ("nutrition panel format",), owner="Legal"),
    FieldDef("calories", "Calories", "Nutrition", ("calories",), mandatory=True, on_artwork=True, owner="R&D"),
]

for _n in NUTRIENTS:
    _FIELDS.append(FieldDef(_n.key, _n.label, "Nutrition", _n.synonyms, mandatory=True, on_artwork=True, owner="R&D"))
    if _n.has_dv_line:
        _FIELDS.append(FieldDef(dv_key(_n.key), f"{_n.label} %DV", "Nutrition", (), mandatory=False, on_artwork=True, owner="R&D"))

_FIELDS += [
    FieldDef("nutrition_footnote", "Nutrition panel footnote", "Nutrition",
             ("nutrition panel bottom statement",), on_artwork=True, owner="Legal"),
    # Other copy
    FieldDef("barcode", "UPC / barcode", "Other Pack Copy", ("upc / barcode", "upc", "barcode", "gtin", "ean"),
             mandatory=True, on_artwork=True, owner="Supply Chain"),
    FieldDef("storage", "Storage instructions", "Other Pack Copy", ("storage instructions", "storage"), on_artwork=True),
    FieldDef("other_marks", "Other marks and text", "Other Pack Copy", ("other text",), on_artwork=True, owner="Agency"),
]

# Fields used by the non-food categories (cosmetics, medicines, devices, household, pet food, India).
# They are only asked for when a rule pack for the chosen market and category requires them.
_FIELDS += [
    FieldDef("responsible_person", "Responsible person / authorisation holder", "Legal & Identity",
             ("responsible person", "importer", "marketing authorisation holder", "marketing authorization holder", "mah"),
             on_artwork=True, owner="Legal"),
    FieldDef("country_of_origin", "Country of origin", "Legal & Identity", ("country of origin", "made in", "origin"),
             on_artwork=True, owner="Legal"),
    FieldDef("licence_number", "Licence / registration number", "Legal & Identity",
             ("fssai licence", "fssai license", "licence number", "license number", "manufacturing licence",
              "manufacturing license", "mfg lic no"), on_artwork=True, owner="Legal"),
    FieldDef("mrp", "Maximum retail price (MRP)", "Legal & Identity", ("mrp", "maximum retail price", "price"),
             on_artwork=True, owner="Supply Chain"),
    FieldDef("veg_logo", "Vegetarian / non-vegetarian mark", "Legal & Identity",
             ("veg logo", "vegetarian mark", "veg/non-veg mark", "veg / non-veg"), on_artwork=True, owner="Legal"),
    FieldDef("ce_marking", "CE marking", "Legal & Identity", ("ce marking", "ce mark"), on_artwork=True, owner="Legal"),
    FieldDef("udi", "Unique device identifier (UDI)", "Legal & Identity", ("udi", "unique device identifier"),
             on_artwork=True, owner="Supply Chain"),
    FieldDef("target_species", "Target species", "Product", ("target species", "species"), on_artwork=True, owner="R&D"),
    FieldDef("feed_type", "Type of feed", "Product", ("type of feed", "feed type"), on_artwork=True, owner="R&D"),
    FieldDef("dosage_form", "Pharmaceutical form", "Product", ("dosage form", "pharmaceutical form"),
             on_artwork=True, owner="R&D"),
    FieldDef("inci_ingredients", "Ingredients (INCI)", "Ingredients & Allergens",
             ("ingredients (inci)", "inci", "inci list", "inci ingredients"), on_artwork=True, owner="R&D"),
    FieldDef("active_ingredients", "Active ingredient(s)", "Ingredients & Allergens",
             ("active ingredient", "active ingredients", "active substance", "active substances"),
             on_artwork=True, owner="R&D"),
    FieldDef("excipients", "Excipients / inactive ingredients", "Ingredients & Allergens",
             ("excipients", "inactive ingredients"), on_artwork=True, owner="R&D"),
    FieldDef("strength", "Strength / dose", "Quantity", ("strength", "dosage strength", "dose"),
             on_artwork=True, owner="R&D"),
    FieldDef("guaranteed_analysis", "Guaranteed / analytical constituents", "Nutrition",
             ("guaranteed analysis", "analytical constituents"), on_artwork=True, owner="R&D"),
    FieldDef("feeding_guidelines", "Feeding guidelines", "Nutrition",
             ("feeding guidelines", "feeding instructions", "feeding directions"), on_artwork=True, owner="R&D"),
    FieldDef("nutritional_adequacy", "Nutritional adequacy statement", "Nutrition",
             ("nutritional adequacy", "nutritional adequacy statement"), on_artwork=True, owner="Legal"),
    FieldDef("batch_lot", "Batch / lot number", "Other Pack Copy", ("batch number", "lot number", "batch/lot", "batch no"),
             on_artwork=True, owner="Supply Chain"),
    FieldDef("manufacture_date", "Manufacturing date", "Other Pack Copy",
             ("manufacturing date", "date of manufacture", "mfg date"), on_artwork=True, owner="Supply Chain"),
    FieldDef("expiry_date", "Expiry / best-before date", "Other Pack Copy",
             ("expiry date", "best before", "use by", "exp", "date of minimum durability"), on_artwork=True,
             owner="Supply Chain"),
    FieldDef("pao_symbol", "Period after opening (PAO)", "Other Pack Copy", ("period after opening", "pao"),
             on_artwork=True, owner="Brand"),
    FieldDef("warnings", "Warnings and precautions", "Other Pack Copy",
             ("warnings", "precautions", "caution", "warnings and precautions"), on_artwork=True, owner="Legal"),
    FieldDef("directions", "Directions for use", "Other Pack Copy",
             ("directions", "directions for use", "how to use", "method of use", "instructions for use"),
             on_artwork=True, owner="R&D"),
    FieldDef("first_aid", "First aid", "Other Pack Copy", ("first aid",), on_artwork=True, owner="Legal"),
    FieldDef("hazard_pictograms", "Hazard pictograms", "Other Pack Copy", ("hazard pictograms", "pictograms", "ghs pictograms"),
             on_artwork=True, owner="Legal"),
    FieldDef("signal_word", "Signal word", "Other Pack Copy", ("signal word",), on_artwork=True, owner="Legal"),
    FieldDef("hazard_statements", "Hazard statements", "Other Pack Copy", ("hazard statements", "h statements"),
             on_artwork=True, owner="Legal"),
    FieldDef("precautionary_statements", "Precautionary statements", "Other Pack Copy",
             ("precautionary statements", "p statements"), on_artwork=True, owner="Legal"),
]

FIELDS: List[FieldDef] = _FIELDS
FIELD_BY_KEY: Dict[str, FieldDef] = {f.key: f for f in FIELDS}


def match_label(label: str) -> Optional[str]:
    """Maps a content-sheet label to a field key (exact synonym first, then prefix)."""
    norm = " ".join(label.lower().replace("\n", " ").split()).strip(" :")
    for f in FIELDS:
        if norm in f.synonyms:
            return f.key
    for f in FIELDS:
        for s in f.synonyms:
            if len(s) > 4 and norm.startswith(s):
                return f.key
    return None


def match_nutrient(label: str) -> Optional[str]:
    norm = " ".join(label.lower().split()).strip(" :")
    if norm in ("calories", "energy"):
        return "calories"
    for n in NUTRIENTS:
        if norm in n.synonyms:
            return n.key
    return None
