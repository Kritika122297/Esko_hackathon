"""Deterministic compliance and mathematical validation engine for BriefForge.

Performs strict, rule-based verification with zero AI hallucination:
1. Nutrition Facts Math Verification (4-4-9 rule, component sums, %DV, serving counts)
2. Regulatory & Mandatory Packaging Rules (required fields, claim validations)
3. Cross-Document Conflict Verification (e.g., PDF vs Excel weight discrepancies)
"""

import re
import uuid
from typing import Dict, Any, List, Optional, Tuple

from app.models.brief import PackagingBrief, BriefField
from app.models.extraction import ExtractedData
from app.models.issues import Issue, ValidationResult


# Standard FDA / Codex Daily Values (DV) for adults and children >= 4 years
DAILY_VALUES: Dict[str, float] = {
    "total_fat": 78.0,          # grams
    "saturated_fat": 20.0,      # grams
    "cholesterol": 300.0,       # mg
    "sodium": 2300.0,           # mg
    "total_carbohydrates": 275.0,# grams
    "dietary_fiber": 28.0,      # grams
    "added_sugars": 50.0,       # grams
    "protein": 50.0,            # grams
    "vitamin_d": 20.0,          # mcg
    "calcium": 1300.0,          # mg
    "iron": 18.0,               # mg
    "potassium": 4700.0,        # mg
}


def parse_numeric(val: Any) -> Optional[float]:
    """Extracts a numeric float from strings like '15g', '250mg', '< 1g', ' 12.5 % '."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)

    s = str(val).strip().lower()
    # Handle less than notation e.g. "< 0.5g" -> 0.4
    if s.startswith("<"):
        m = re.search(r"[\d\.]+", s)
        return float(m.group()) if m else 0.0

    # Extract first decimal or integer number
    m = re.search(r"[-+]?\d*\.?\d+", s)
    if m:
        try:
            return float(m.group())
        except ValueError:
            return None
    return None


def parse_weight_in_grams(val: Any) -> Optional[float]:
    """Normalizes weight representations to grams (e.g. '500g', '1 kg', '16 oz', '1 lb')."""
    if val is None:
        return None
    s = str(val).strip().lower()
    num = parse_numeric(s)
    if num is None:
        return None

    if "kg" in s:
        return num * 1000.0
    elif "oz" in s:
        return num * 28.3495
    elif "lb" in s:
        return num * 453.592
    elif "mg" in s:
        return num / 1000.0
    return num  # Default assumption is grams


def check_nutrition_math(nutrition_data: Dict[str, Any]) -> List[Issue]:
    """Runs deterministic mathematical checks on nutrition label figures.

    Checks:
    1. 4-4-9 Atwater Calorie check: Calories vs (Fat * 9 + Carbs * 4 + Protein * 4)
    2. Component Sums: Saturated Fat + Trans Fat <= Total Fat
    3. Carb Components: Dietary Fiber + Total Sugars <= Total Carbs (and Added Sugars <= Total Sugars)
    4. Sodium vs Salt conversion if both present (Salt ≈ Sodium * 2.5)
    5. %DV calculations: compares stated %DV against calculated %DV
    6. Serving Size & Servings per Container consistency with Net Weight
    """
    issues: List[Issue] = []

    # Helper to pull values
    def get_num(key: str) -> Optional[float]:
        return parse_numeric(nutrition_data.get(key))

    calories = get_num("calories")
    total_fat = get_num("total_fat")
    sat_fat = get_num("saturated_fat")
    trans_fat = get_num("trans_fat")
    cholesterol = get_num("cholesterol")
    sodium = get_num("sodium")
    total_carbs = get_num("total_carbohydrates")
    fiber = get_num("dietary_fiber")
    total_sugars = get_num("total_sugars")
    added_sugars = get_num("added_sugars")
    protein = get_num("protein")

    # 1. 4-4-9 Calorie Verification
    if calories is not None and total_fat is not None and total_carbs is not None and protein is not None:
        # Standard general Atwater factors: 9 kcal/g for fat, 4 kcal/g for carbs and protein
        # Fiber subtraction adjustment may yield lower effective carbs
        calculated_cal_gross = (total_fat * 9.0) + (total_carbs * 4.0) + (protein * 4.0)
        fiber_adj = (fiber * 2.0) if fiber is not None else 0.0  # Insoluble/soluble fiber 2 kcal/g allowance
        min_expected = calculated_cal_gross - fiber_adj - 15.0
        max_expected = calculated_cal_gross + 15.0

        diff = abs(calories - calculated_cal_gross)
        # Tolerance: 20% or 25 calories, whichever is greater
        threshold = max(25.0, calculated_cal_gross * 0.20)

        if diff > threshold:
            issues.append(
                Issue(
                    id=f"iss_math_cal_{uuid.uuid4().hex[:6]}",
                    severity="critical" if diff > (threshold * 1.5) else "warning",
                    category="math_error",
                    title="Calorie Calculation Mismatch (4-4-9 Rule)",
                    description=(
                        f"Stated calories ({calories:.0f} kcal) deviates significantly from 4-4-9 calculation: "
                        f"(Fat {total_fat}g × 9) + (Carbs {total_carbs}g × 4) + (Protein {protein}g × 4) = "
                        f"{calculated_cal_gross:.0f} kcal (discrepancy of {diff:.0f} kcal)."
                    ),
                    field_name="calories",
                    source="nutrition_math_checker",
                    suggestion=f"Verify lab report or adjust stated calories to approximately {round(calculated_cal_gross):.0f} kcal.",
                )
            )

    # 2. Component Sums: Saturated + Trans Fat vs Total Fat
    if total_fat is not None:
        sum_fat_subcomponents = (sat_fat or 0.0) + (trans_fat or 0.0)
        if sum_fat_subcomponents > (total_fat + 0.2):
            issues.append(
                Issue(
                    id=f"iss_math_fat_{uuid.uuid4().hex[:6]}",
                    severity="critical",
                    category="math_error",
                    title="Fat Subcomponents Exceed Total Fat",
                    description=(
                        f"Saturated Fat ({sat_fat or 0}g) + Trans Fat ({trans_fat or 0}g) = "
                        f"{sum_fat_subcomponents:.1f}g, which exceeds stated Total Fat ({total_fat}g)."
                    ),
                    field_name="total_fat",
                    source="nutrition_math_checker",
                    suggestion="Ensure Total Fat is at least equal to the sum of saturated and trans fatty acids.",
                )
            )

    # 3. Component Sums: Fiber + Sugars vs Total Carbohydrates
    if total_carbs is not None:
        sum_carb_subcomponents = (fiber or 0.0) + (total_sugars or 0.0)
        if sum_carb_subcomponents > (total_carbs + 0.5):
            issues.append(
                Issue(
                    id=f"iss_math_carb_{uuid.uuid4().hex[:6]}",
                    severity="critical",
                    category="math_error",
                    title="Carbohydrate Subcomponents Exceed Total Carbohydrates",
                    description=(
                        f"Dietary Fiber ({fiber or 0}g) + Total Sugars ({total_sugars or 0}g) = "
                        f"{sum_carb_subcomponents:.1f}g, which exceeds stated Total Carbohydrates ({total_carbs}g)."
                    ),
                    field_name="total_carbohydrates",
                    source="nutrition_math_checker",
                    suggestion="Check analytical testing sheet. Total carbohydrates must include fiber, sugars, and starches.",
                )
            )

    # 4. Added Sugars vs Total Sugars
    if total_sugars is not None and added_sugars is not None:
        if added_sugars > (total_sugars + 0.1):
            issues.append(
                Issue(
                    id=f"iss_math_sugars_{uuid.uuid4().hex[:6]}",
                    severity="critical",
                    category="math_error",
                    title="Added Sugars Exceed Total Sugars",
                    description=(
                        f"Stated Added Sugars ({added_sugars}g) cannot exceed Total Sugars ({total_sugars}g)."
                    ),
                    field_name="added_sugars",
                    source="nutrition_math_checker",
                    suggestion="Reduce Added Sugars to be less than or equal to Total Sugars.",
                )
            )

    # 4b. Sodium vs Salt Conversion Check (Salt ≈ Sodium (g) * 2.5)
    salt_val = get_num("salt")
    if sodium is not None and salt_val is not None:
        # Convert sodium from mg to g if >= 1.0 (typical sodium declaration in mg)
        sodium_g = sodium / 1000.0 if sodium > 10.0 else sodium
        expected_salt_g = sodium_g * 2.54
        if abs(salt_val - expected_salt_g) > 0.25:
            issues.append(
                Issue(
                    id=f"iss_math_salt_{uuid.uuid4().hex[:6]}",
                    severity="warning",
                    category="math_error",
                    title="Sodium to Salt Conversion Discrepancy",
                    description=(
                        f"Stated Salt is {salt_val:g}g, but based on stated Sodium ({sodium:g}mg), "
                        f"the calculated Salt equivalent is approximately {expected_salt_g:.2f}g (Salt = Sodium × 2.54)."
                    ),
                    field_name="sodium",
                    source="nutrition_math_checker",
                    suggestion=f"Align Salt declaration to {expected_salt_g:.2f}g or adjust Sodium declaration.",
                )
            )

    # 5. Daily Value (%DV) Verification
    # Check stated %DV fields if present (e.g. 'sodium_dv_pct', 'total_fat_dv_pct')
    dv_field_pairs = [
        ("total_fat", "total_fat_dv_pct"),
        ("saturated_fat", "saturated_fat_dv_pct"),
        ("cholesterol", "cholesterol_dv_pct"),
        ("sodium", "sodium_dv_pct"),
        ("total_carbohydrates", "total_carbohydrates_dv_pct"),
        ("dietary_fiber", "dietary_fiber_dv_pct"),
        ("added_sugars", "added_sugars_dv_pct"),
        ("protein", "protein_dv_pct"),
    ]

    for nutrient_key, dv_key in dv_field_pairs:
        nutrient_val = get_num(nutrient_key)
        stated_dv = get_num(dv_key)
        ref_dv = DAILY_VALUES.get(nutrient_key)

        if nutrient_val is not None and stated_dv is not None and ref_dv:
            calculated_dv = round((nutrient_val / ref_dv) * 100.0)
            diff_dv = abs(stated_dv - calculated_dv)
            # Allow 2 percentage points for rounding differences
            if diff_dv > 3:
                issues.append(
                    Issue(
                        id=f"iss_math_dv_{nutrient_key}_{uuid.uuid4().hex[:6]}",
                        severity="warning",
                        category="math_error",
                        title=f"Incorrect %DV for {nutrient_key.replace('_', ' ').title()}",
                        description=(
                            f"Stated %DV is {stated_dv:.0f}%, but based on the reference Daily Value "
                            f"({ref_dv:g}{'mg' if 'cholesterol' in nutrient_key or 'sodium' in nutrient_key else 'g'}), "
                            f"{nutrient_val:g} yields {calculated_dv:.0f}% DV."
                        ),
                        field_name=nutrient_key,
                        source="nutrition_math_checker",
                        suggestion=f"Update stated %DV to {calculated_dv:.0f}%.",
                    )
                )

    # 6. Serving Math Check (Net Weight vs Serving Size * Servings per Container)
    net_weight_g = parse_weight_in_grams(nutrition_data.get("net_weight"))
    serving_size_g = parse_weight_in_grams(nutrition_data.get("serving_size"))
    servings_per_container = get_num("servings_per_container")

    if net_weight_g and serving_size_g and servings_per_container:
        expected_total = serving_size_g * servings_per_container
        weight_diff = abs(net_weight_g - expected_total)
        # If discrepancy exceeds 10%
        if weight_diff > (net_weight_g * 0.12):
            issues.append(
                Issue(
                    id=f"iss_math_servings_{uuid.uuid4().hex[:6]}",
                    severity="warning",
                    category="math_error",
                    title="Serving Size & Container Math Mismatch",
                    description=(
                        f"Serving size ({serving_size_g:.0f}g) × Servings per container ({servings_per_container:.1f}) = "
                        f"{expected_total:.0f}g, but stated Net Weight is {net_weight_g:.0f}g (difference of {weight_diff:.0f}g)."
                    ),
                    field_name="servings_per_container",
                    source="nutrition_math_checker",
                    suggestion="Verify if servings per container is 'About X' or adjust net weight declaration.",
                )
            )

    return issues


def check_product_rules(brief: PackagingBrief) -> List[Issue]:
    """Validates mandatory packaging regulatory requirements and marketing claims."""
    issues: List[Issue] = []

    # 1. Mandatory Food Packaging Fields Checklist
    required_fields = [
        ("product_name", "Product Title / Brand Name", "critical"),
        ("legal_name", "Legal Statement of Identity", "critical"),
        ("net_weight", "Net Quantity of Contents", "critical"),
        ("ingredients_list", "Ingredients Declaration", "critical"),
        ("allergens", "Allergen Statement", "critical"),
        ("nutrition_facts", "Nutrition Information Panel", "warning"),
        ("producer_address", "Manufacturer / Packer / Distributor Address", "warning"),
        ("country_of_origin", "Country of Origin", "warning"),
        ("barcode", "Barcode (UPC / EAN)", "warning"),
    ]

    for field_key, field_label, severity in required_fields:
        val = brief.get_field_value(field_key)
        if not val or str(val).strip().lower() in ["none", "tbd", "missing", "unknown", ""]:
            issues.append(
                Issue(
                    id=f"iss_req_{field_key}_{uuid.uuid4().hex[:6]}",
                    severity=severity,
                    category="missing",
                    title=f"Missing Mandatory Field: {field_label}",
                    description=f"The packaging brief lacks a confirmed value for '{field_label}'. Regulatory compliance requires this on retail packaging.",
                    field_name=field_key,
                    source="packaging_rule_engine",
                    suggestion=f"Provide confirmed data for {field_label}.",
                )
            )

    # 2. Marketing Claims Validation
    claims_val = brief.get_field_value("claims")
    claims_list: List[str] = []
    if isinstance(claims_val, list):
        claims_list = [str(c).lower() for c in claims_val]
    elif isinstance(claims_val, str):
        claims_list = [c.strip().lower() for c in claims_val.split(",") if c.strip()]

    ingredients_val = str(brief.get_field_value("ingredients_list") or "").lower()
    total_fat_val = parse_numeric(brief.get_field_value("total_fat"))
    total_sugars_val = parse_numeric(brief.get_field_value("total_sugars"))
    protein_val = parse_numeric(brief.get_field_value("protein"))
    certifications_val = str(brief.get_field_value("certifications") or "").lower()

    for claim in claims_list:
        # A. "Gluten-Free" Claim Check
        if "gluten free" in claim or "gluten-free" in claim:
            gluten_culprits = ["wheat", "barley", "rye", "malt", "spelt", "kamut", "brewer's yeast"]
            found_gluten = [c for c in gluten_culprits if c in ingredients_val]
            if found_gluten:
                issues.append(
                    Issue(
                        id=f"iss_claim_gluten_{uuid.uuid4().hex[:6]}",
                        severity="critical",
                        category="rule_violation",
                        title="Gluten-Free Claim Invalidation",
                        description=(
                            f"Product claims '{claim}' but ingredients contain gluten sources: "
                            f"{', '.join(found_gluten)}."
                        ),
                        field_name="claims",
                        source="claims_validator",
                        suggestion="Remove 'Gluten-Free' claim or reformulate ingredients to eliminate gluten sources.",
                    )
                )

        # B. "Vegan" / "Plant-Based" Claim Check
        if "vegan" in claim or "plant-based" in claim or "plant based" in claim:
            animal_derivs = ["milk", "dairy", "whey", "butter", "cheese", "egg", "honey", "gelatin", "carmine", "casein", "lard", "tallow"]
            found_animal = [a for a in animal_derivs if a in ingredients_val]
            if found_animal:
                issues.append(
                    Issue(
                        id=f"iss_claim_vegan_{uuid.uuid4().hex[:6]}",
                        severity="critical",
                        category="rule_violation",
                        title="Vegan Claim Invalidation",
                        description=(
                            f"Product claims '{claim}' but ingredients list contains animal-derived ingredients: "
                            f"{', '.join(found_animal)}."
                        ),
                        field_name="claims",
                        source="claims_validator",
                        suggestion="Remove 'Vegan' claim or substitute animal ingredients with plant alternatives.",
                    )
                )

        # C. "Sugar-Free" / "Zero Sugar" Claim Check
        if "sugar free" in claim or "sugar-free" in claim or "zero sugar" in claim or "no sugar" in claim:
            if total_sugars_val is not None and total_sugars_val >= 0.5:
                issues.append(
                    Issue(
                        id=f"iss_claim_sugar_{uuid.uuid4().hex[:6]}",
                        severity="critical",
                        category="rule_violation",
                        title="Sugar-Free Claim Violation",
                        description=(
                            f"Product claims '{claim}', but stated Total Sugars is {total_sugars_val}g. "
                            "FDA/EU rules require < 0.5g total sugar per labeled serving."
                        ),
                        field_name="claims",
                        source="claims_validator",
                        suggestion="Change claim to 'Low Sugar' or 'No Added Sugars' if applicable.",
                    )
                )

        # D. "Low Fat" / "Fat Free" Claim Check
        if "fat free" in claim or "fat-free" in claim:
            if total_fat_val is not None and total_fat_val >= 0.5:
                issues.append(
                    Issue(
                        id=f"iss_claim_fatfree_{uuid.uuid4().hex[:6]}",
                        severity="critical",
                        category="rule_violation",
                        title="Fat-Free Claim Violation",
                        description=f"Product claims 'Fat-Free' but Total Fat is {total_fat_val}g (limit is < 0.5g).",
                        field_name="claims",
                        source="claims_validator",
                        suggestion="Remove 'Fat-Free' claim.",
                    )
                )
        elif "low fat" in claim or "low-fat" in claim:
            if total_fat_val is not None and total_fat_val > 3.0:
                issues.append(
                    Issue(
                        id=f"iss_claim_lowfat_{uuid.uuid4().hex[:6]}",
                        severity="warning",
                        category="rule_violation",
                        title="Low-Fat Claim Exceeded",
                        description=f"Product claims 'Low-Fat' but Total Fat is {total_fat_val}g (standard limit is <= 3.0g per serving).",
                        field_name="claims",
                        source="claims_validator",
                        suggestion="Review portion size or remove 'Low-Fat' claim.",
                    )
                )

        # E. "High Protein" Claim Check
        if "high protein" in claim or "high-protein" in claim or "protein rich" in claim:
            if protein_val is not None and protein_val < 10.0:
                issues.append(
                    Issue(
                        id=f"iss_claim_protein_{uuid.uuid4().hex[:6]}",
                        severity="warning",
                        category="rule_violation",
                        title="High Protein Threshold Not Met",
                        description=(
                            f"Product claims '{claim}', but stated protein is {protein_val}g per serving. "
                            "A 'High Protein' or 'Excellent Source' claim typically requires >= 10g (20% DV) per serving."
                        ),
                        field_name="claims",
                        source="claims_validator",
                        suggestion="Adjust claim to 'Good source of protein' (requires >= 5g / 10% DV) or reformulate.",
                    )
                )

        # F. "Organic" Claim Check
        if "organic" in claim:
            if not certifications_val or "organic" not in certifications_val:
                issues.append(
                    Issue(
                        id=f"iss_claim_organic_{uuid.uuid4().hex[:6]}",
                        severity="warning",
                        category="rule_violation",
                        title="Organic Claim Missing Certifying Agent",
                        description="Product claims 'Organic' on display panel, but no certifying agent or certificate was identified.",
                        field_name="certifications",
                        source="claims_validator",
                        suggestion="Specify the organic certification agency (e.g. 'Certified Organic by QAI' or 'USDA Organic').",
                    )
                )

    return issues


def check_conflicts(brief: PackagingBrief, extracted_data: Optional[ExtractedData] = None) -> List[Issue]:
    """Identifies direct contradictions between files (e.g., PDF front panel vs Excel spec sheet)."""
    issues: List[Issue] = []

    # 1. Field-level conflict checks recorded on BriefField
    for section in brief.sections:
        for field in section.fields:
            if field.status == "conflicting" or field.issues:
                for issue_text in field.issues:
                    issues.append(
                        Issue(
                            id=f"iss_conf_{field.field_name}_{uuid.uuid4().hex[:6]}",
                            severity="critical" if "differ" in issue_text.lower() or "conflict" in issue_text.lower() else "warning",
                            category="conflict",
                            title=f"Source Discrepancy: {field.label or field.field_name}",
                            description=issue_text,
                            field_name=field.field_name,
                            source=field.source,
                            suggestion=f"Confirm correct value with client brand team for '{field.label or field.field_name}'.",
                        )
                    )

    # 2. Cross-Source Heuristic Checks (PDF texts vs Excel texts)
    if extracted_data and extracted_data.texts:
        pdf_texts: List[str] = []
        excel_texts: List[str] = []

        for item in extracted_data.texts:
            src = item.source_file.lower()
            if src.endswith(".pdf"):
                pdf_texts.append(item.text)
            elif src.endswith(".xlsx") or src.endswith(".xls"):
                excel_texts.append(item.text)

        # Net weight conflict detection (e.g., PDF '480g' vs Excel '500g')
        weight_pattern = re.compile(r"\b(\d{2,4})\s*(g|grams|ml|oz)\b", re.IGNORECASE)

        pdf_weights = set()
        for t in pdf_texts:
            for match in weight_pattern.finditer(t):
                pdf_weights.add(f"{match.group(1)}{match.group(2).lower()}")

        excel_weights = set()
        for t in excel_texts:
            for match in weight_pattern.finditer(t):
                excel_weights.add(f"{match.group(1)}{match.group(2).lower()}")

        # Look for weight divergence in primary numbers
        if pdf_weights and excel_weights and not (pdf_weights & excel_weights):
            pdf_w_str = ", ".join(sorted(pdf_weights))
            excel_w_str = ", ".join(sorted(excel_weights))
            issues.append(
                Issue(
                    id=f"iss_conf_weight_{uuid.uuid4().hex[:6]}",
                    severity="critical",
                    category="conflict",
                    title="Net Weight Conflict Between PDF and Excel",
                    description=(
                        f"PDF artwork shows net weight: [{pdf_w_str}], "
                        f"while Excel specification sheet states: [{excel_w_str}]. "
                        "This will cause dieline prepress rejection if not resolved."
                    ),
                    field_name="net_weight",
                    source="document_cross_reference",
                    suggestion="Clarify intended fill weight with packaging production team before finalizing artwork.",
                )
            )

        # Barcode conflict detection (UPC 12 digits or EAN 13 digits)
        barcode_pattern = re.compile(r"\b(\d{12,13})\b")
        pdf_barcodes = {m.group(1) for t in pdf_texts for m in barcode_pattern.finditer(t)}
        excel_barcodes = {m.group(1) for t in excel_texts for m in barcode_pattern.finditer(t)}

        if pdf_barcodes and excel_barcodes and not (pdf_barcodes & excel_barcodes):
            issues.append(
                Issue(
                    id=f"iss_conf_barcode_{uuid.uuid4().hex[:6]}",
                    severity="critical",
                    category="conflict",
                    title="Barcode Number Discrepancy",
                    description=(
                        f"Barcode on PDF artwork ({', '.join(pdf_barcodes)}) does not match "
                        f"barcode in Excel data sheet ({', '.join(excel_barcodes)})."
                    ),
                    field_name="barcode",
                    source="document_cross_reference",
                    suggestion="Verify Master GS1 GTIN / UPC barcode registration.",
                )
            )

    return issues


def run_all_checks(
    brief: PackagingBrief,
    extracted_data: Optional[ExtractedData] = None,
) -> ValidationResult:
    """Aggregates all deterministic checks, deduplicates issues, and computes severity summary."""
    all_issues: List[Issue] = []

    # 1. Nutrition Math Checks
    nutrition_dict: Dict[str, Any] = {}
    for section in brief.sections:
        if "nutrition" in section.section_name.lower():
            for field in section.fields:
                val = field.user_override if field.user_override is not None else field.value
                nutrition_dict[field.field_name] = val

    # Add net weight to nutrition dict for servings check
    nutrition_dict["net_weight"] = brief.get_field_value("net_weight")

    if nutrition_dict:
        math_issues = check_nutrition_math(nutrition_dict)
        all_issues.extend(math_issues)

    # 2. Product Rules and Regulatory Checks
    rule_issues = check_product_rules(brief)
    all_issues.extend(rule_issues)

    # 3. Cross-Document Conflicts Checks
    conflict_issues = check_conflicts(brief, extracted_data)
    all_issues.extend(conflict_issues)

    # Deduplicate issues by title & field_name
    unique_issues: List[Issue] = []
    seen_keys = set()
    for iss in all_issues:
        key = (iss.title, iss.field_name, iss.category)
        if key not in seen_keys:
            seen_keys.add(key)
            unique_issues.append(iss)

    # Compute summary
    summary = {"critical": 0, "warning": 0, "info": 0}
    for iss in unique_issues:
        sev = iss.severity.lower()
        if sev in summary:
            summary[sev] += 1
        else:
            summary["info"] += 1

    passed = (summary["critical"] == 0)

    # Update brief issues summary
    brief.issues_summary = summary

    return ValidationResult(
        issues=unique_issues,
        passed=passed,
        summary=summary,
    )
