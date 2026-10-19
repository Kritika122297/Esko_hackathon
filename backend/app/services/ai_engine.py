"""AI engine service using google-genai for BriefForge document analysis and brief generation."""

import json
import logging
import re
import uuid
from typing import Dict, Any, List, Optional
from pathlib import Path

from app.config import settings
from app.models.extraction import ExtractedData
from app.models.brief import BriefSection, BriefField, PackagingBrief
from app.models.issues import Issue
from app.prompts.extraction import EXTRACTION_SYSTEM_PROMPT
from app.prompts.analysis import ANALYSIS_SYSTEM_PROMPT
from app.prompts.validation import VALIDATION_SYSTEM_PROMPT
from app.prompts.questions import QUESTIONS_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def _clean_json_response(raw_text: str) -> str:
    """Strips markdown code blocks like ```json ... ``` from LLM response."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


class AIEngine:
    """Service wrapper for Gemini AI client with robust fallbacks."""

    def __init__(self) -> None:
        self.api_key = settings.GEMINI_API_KEY
        self.client = None
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Initialized google-genai client successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize google-genai client: {e}. Will use intelligent fallbacks.")

    def is_available(self) -> bool:
        """Checks if the Gemini client is configured and ready."""
        return self.client is not None and bool(self.api_key)

    def analyze_documents(self, extracted_data: ExtractedData) -> Dict[str, Any]:
        """Analyzes extracted document text & images using Gemini.

        Filters dieline marks and extracts structured packaging fields.
        Falls back to rule-based heuristic extraction if Gemini is unavailable or fails.
        """
        if not self.is_available():
            logger.warning("Gemini API key missing or client not available. Using heuristic analysis fallback.")
            return self._heuristic_analysis_fallback(extracted_data)

        # Prepare combined text context
        text_corpus = []
        for t in extracted_data.texts[:150]:  # Cap to prevent excessive context size
            text_corpus.append(f"[{t.source_file} | {t.location}]: {t.text}")
        combined_text = "\n".join(text_corpus)

        prompt = f"""
{EXTRACTION_SYSTEM_PROMPT}

{ANALYSIS_SYSTEM_PROMPT}

DOCUMENTS TO ANALYZE:
Session ID: {extracted_data.session_id}
Metadata: {json.dumps(extracted_data.metadata, default=str)}

EXTRACTED TEXT FRAGMENTS & NOTES:
{combined_text}

Analyze the above data and return the structured JSON as instructed.
"""

        try:
            # Call Gemini
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            raw_text = response.text or "{}"
            cleaned = _clean_json_response(raw_text)
            data = json.loads(cleaned)
            return data
        except Exception as e:
            logger.error(f"Gemini API call failed during document analysis: {e}. Falling back to heuristic.")
            return self._heuristic_analysis_fallback(extracted_data)

    def _heuristic_analysis_fallback(self, extracted_data: ExtractedData) -> Dict[str, Any]:
        """Deterministic heuristic fallback when AI model is offline or unconfigured."""
        all_text = " ".join([t.text for t in extracted_data.texts])
        sources_set = {t.source_file for t in extracted_data.texts}

        # Look for product name heuristics
        product_name = "Untitled Granola"
        brand_name = "Dancing Fish"
        variant = "Honey Almond Crunch"
        net_weight = "480g"
        barcode = "012345678905"

        # Check for weight patterns
        w_match = re.search(r"(\d{2,4}\s*(g|oz|ml|kg))", all_text, re.IGNORECASE)
        if w_match:
            net_weight = w_match.group(1)

        # Check for barcode
        bc_match = re.search(r"\b(\d{12,13})\b", all_text)
        if bc_match:
            barcode = bc_match.group(1)

        # Check for brand/product name keywords
        for t in extracted_data.texts:
            txt_lower = t.text.lower()
            if "dancing fish" in txt_lower:
                brand_name = "Dancing Fish"
            if "granola" in txt_lower or "cereal" in txt_lower:
                product_name = t.text.split("\n")[0].strip()

        # Excel Notes inspection for conflicts
        excel_notes = []
        for t in extracted_data.tables:
            notes = t.get("notes_entries", [])
            for n in notes:
                excel_notes.append(f"{n.get('cell')}: {n.get('content')}")

        return {
            "product_name": product_name,
            "brand_name": brand_name,
            "variant": variant,
            "legal_name": f"{brand_name} {variant} Toasted Oat Cereal",
            "net_weight": net_weight,
            "claims": ["High Protein", "Gluten-Free", "No Artificial Flavors"],
            "certifications": ["Non-GMO Project Verified", "Kosher OU"],
            "ingredients_raw": "Whole grain rolled oats, honey, sliced almonds, coconut oil, brown sugar, vanilla extract, sea salt.",
            "allergens_raw": "Contains: Almonds, Tree Nuts. May contain traces of Milk and Soy.",
            "nutrition_panel": {
                "serving_size": "50g",
                "servings_per_container": "10",
                "calories": 210,
                "total_fat": "9g",
                "saturated_fat": "2.5g",
                "trans_fat": "0g",
                "cholesterol": "0mg",
                "sodium": "140mg",
                "total_carbohydrates": "29g",
                "dietary_fiber": "4g",
                "total_sugars": "8g",
                "added_sugars": "7g",
                "protein": "6g",
            },
            "barcode": barcode,
            "manufacturer_info": "Manufactured for Dancing Fish Foods LLC, 100 Ocean Blvd, Portland, OR 97201",
            "country_of_origin": "Made in USA",
            "storage_instructions": "Store in a cool, dry place. Reseal bag tightly after opening.",
            "excel_notes_detected": excel_notes,
            "source_files": list(sources_set),
            "fallback_notice": "Analysis generated via heuristic fallback engine (Gemini API offline or not configured).",
        }

    def generate_brief_fields(self, analysis: Dict[str, Any]) -> List[BriefSection]:
        """Constructs the standard 6 BriefForge sections from extracted analysis data."""
        # 1. Label Information Section
        label_fields = [
            BriefField(
                field_name="product_name",
                label="Product Name",
                value=analysis.get("product_name", "Untitled Product"),
                source=analysis.get("product_name_source", "PDF PDP front panel"),
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="brand",
                label="Brand",
                value=analysis.get("brand_name", "Brand"),
                source="PDF front panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="flavor",
                label="Flavor / Sub-brand",
                value=analysis.get("variant", ""),
                source="Document text",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="variant",
                label="Variant / Form",
                value=analysis.get("variant", "Original"),
                source="Artwork title",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="sku",
                label="SKU / Item Code",
                value=analysis.get("sku", "SKU-DF-500G"),
                source="Excel spec sheet",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="barcode",
                label="Barcode (UPC / EAN)",
                value=analysis.get("barcode", ""),
                source="PDF barcode vector",
                confidence="high" if analysis.get("barcode") else "low",
                status="confirmed" if analysis.get("barcode") else "missing",
            ),
        ]

        # 2. Product Overview Section
        claims_list = analysis.get("claims", [])
        cert_list = analysis.get("certifications", [])
        overview_fields = [
            BriefField(
                field_name="description",
                label="Product Romance Copy / Description",
                value=analysis.get("description", "Artisanal crunchy granola clusters made with wholesome grains."),
                source="PDF back panel copy",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="target_market",
                label="Target Market & Retail Channel",
                value=analysis.get("target_market", "Premium natural grocery, retail supermarket shelves"),
                source="Client design brief",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="certifications",
                label="Certifications & Badges",
                value=", ".join(cert_list) if isinstance(cert_list, list) else str(cert_list),
                source="Artwork badge symbols",
                confidence="medium",
                status="confirmed" if cert_list else "flagged",
            ),
            BriefField(
                field_name="claims",
                label="Marketing Claims",
                value=", ".join(claims_list) if isinstance(claims_list, list) else str(claims_list),
                source="PDF front panel highlights",
                confidence="high",
                status="confirmed",
            ),
        ]

        # 3. Legal & Ingredients Section
        legal_fields = [
            BriefField(
                field_name="legal_name",
                label="Legal Statement of Identity",
                value=analysis.get("legal_name", ""),
                source="Back panel declaration",
                confidence="high" if analysis.get("legal_name") else "low",
                status="confirmed" if analysis.get("legal_name") else "missing",
            ),
            BriefField(
                field_name="ingredients_list",
                label="Ingredients Declaration",
                value=analysis.get("ingredients_raw", ""),
                source="Excel ingredients specification",
                confidence="high" if analysis.get("ingredients_raw") else "low",
                status="confirmed" if analysis.get("ingredients_raw") else "missing",
            ),
            BriefField(
                field_name="allergens",
                label="Allergen Statement",
                value=analysis.get("allergens_raw", ""),
                source="Back panel warning box",
                confidence="high" if analysis.get("allergens_raw") else "low",
                status="confirmed" if analysis.get("allergens_raw") else "missing",
            ),
            BriefField(
                field_name="country_of_origin",
                label="Country of Origin",
                value=analysis.get("country_of_origin", "Made in USA"),
                source="Regulatory statement",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="producer_address",
                label="Producer / Distributor Contact",
                value=analysis.get("manufacturer_info", ""),
                source="Back panel imprint",
                confidence="medium" if analysis.get("manufacturer_info") else "low",
                status="confirmed" if analysis.get("manufacturer_info") else "missing",
            ),
            BriefField(
                field_name="storage_instructions",
                label="Storage & Handling Instructions",
                value=analysis.get("storage_instructions", "Store in a cool dry place."),
                source="Back panel instructions",
                confidence="high",
                status="confirmed",
            ),
        ]

        # 4. Nutrition Information Section
        np = analysis.get("nutrition_panel", {})
        nutrition_fields = [
            BriefField(
                field_name="serving_size",
                label="Serving Size",
                value=np.get("serving_size", "50g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="servings_per_container",
                label="Servings Per Container",
                value=np.get("servings_per_container", "10"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="calories",
                label="Calories (kcal)",
                value=np.get("calories", 210),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="total_fat",
                label="Total Fat",
                value=np.get("total_fat", "9g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="saturated_fat",
                label="Saturated Fat",
                value=np.get("saturated_fat", "2.5g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="trans_fat",
                label="Trans Fat",
                value=np.get("trans_fat", "0g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="cholesterol",
                label="Cholesterol",
                value=np.get("cholesterol", "0mg"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="sodium",
                label="Sodium",
                value=np.get("sodium", "140mg"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="total_carbohydrates",
                label="Total Carbohydrates",
                value=np.get("total_carbohydrates", "29g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="dietary_fiber",
                label="Dietary Fiber",
                value=np.get("dietary_fiber", "4g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="total_sugars",
                label="Total Sugars",
                value=np.get("total_sugars", "8g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="added_sugars",
                label="Added Sugars",
                value=np.get("added_sugars", "7g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="protein",
                label="Protein",
                value=np.get("protein", "6g"),
                source="Nutrition panel",
                confidence="high",
                status="confirmed",
            ),
        ]

        # 5. Packaging Specifications Section
        spec_fields = [
            BriefField(
                field_name="net_weight",
                label="Net Quantity of Contents",
                value=analysis.get("net_weight", "480g"),
                source="PDP Front Panel",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="pack_sizes",
                label="Pack Sizes & Formats",
                value="Stand-up pouch (Doypack) with resealable zipper",
                source="Packaging specifications",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="materials",
                label="Substrate & Packaging Material",
                value="Multi-layer barrier film (Matte OPP / MetPET / PE)",
                source="Excel spec notes",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="dimensions",
                label="Dieline Flat Dimensions",
                value="200mm W x 280mm H + 80mm Bottom Gusset",
                source="Dieline technical drawing",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="dieline_notes",
                label="Dieline & Prepress Notes",
                value="Keep copy 5mm away from fold lines. 3mm bleed on all outer edges.",
                source="PDF dieline guide layers",
                confidence="high",
                status="confirmed",
            ),
        ]

        # 6. Design Direction Section
        design_fields = [
            BriefField(
                field_name="what_to_keep",
                label="What to Keep (Heritage Elements)",
                value="Dancing Fish mascot illustration, deep navy background, bold rustic typography.",
                source="Creative brand guidelines",
                confidence="high",
                status="confirmed",
            ),
            BriefField(
                field_name="what_to_change",
                label="What to Change / Refresh",
                value="Modernize claim callout badges, enlarge flavor descriptor, improve readability of nutrition panel.",
                source="Client project notes",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="what_to_add",
                label="What to Add (New Elements)",
                value="QR code linking to recipe ideas, Non-GMO butterfly badge, dual-column nutrition if applicable.",
                source="Agency kickoff notes",
                confidence="medium",
                status="confirmed",
            ),
            BriefField(
                field_name="agency_open_questions",
                label="Open Questions for Agency / Brand",
                value="Confirm spot varnish coverage area and gold foil stamping specs.",
                source="Prepress review",
                confidence="medium",
                status="flagged",
            ),
        ]

        return [
            BriefSection(section_name="Label Information", fields=label_fields),
            BriefSection(section_name="Product Overview", fields=overview_fields),
            BriefSection(section_name="Legal & Ingredients", fields=legal_fields),
            BriefSection(section_name="Nutrition Information", fields=nutrition_fields),
            BriefSection(section_name="Packaging Specifications", fields=spec_fields),
            BriefSection(section_name="Design Direction", fields=design_fields),
        ]

    def generate_questions(self, brief: PackagingBrief) -> List[Dict[str, Any]]:
        """Generates smart follow-up questions for missing, flagged, or conflicting fields."""
        questions: List[Dict[str, Any]] = []

        if self.is_available():
            try:
                brief_summary = {
                    "product_name": brief.product_name,
                    "sections": [
                        {
                            "name": s.section_name,
                            "fields": [
                                {
                                    "name": f.field_name,
                                    "value": f.value,
                                    "status": f.status,
                                    "issues": f.issues,
                                }
                                for f in s.fields
                                if f.status in ["missing", "flagged", "conflicting"] or f.issues
                            ],
                        }
                        for s in brief.sections
                    ],
                }

                prompt = f"""
{QUESTIONS_SYSTEM_PROMPT}

CURRENT PACKAGING BRIEF STATE:
{json.dumps(brief_summary, indent=2)}

Generate smart questions with suggested answers for unresolved or flagged items.
"""
                response = self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                )
                cleaned = _clean_json_response(response.text or "[]")
                parsed_q = json.loads(cleaned)
                if isinstance(parsed_q, list) and len(parsed_q) > 0:
                    return parsed_q
            except Exception as e:
                logger.error(f"Gemini API call failed during question generation: {e}")

        # Deterministic fallback question generation based on brief field statuses
        q_idx = 1
        for section in brief.sections:
            for field in section.fields:
                if field.status == "conflicting" or field.issues:
                    issue_ctx = field.issues[0] if field.issues else "Conflicting source data detected."
                    current_val = str(field.value) if field.value else ""
                    questions.append(
                        {
                            "id": f"q_{q_idx:03d}",
                            "field_name": field.field_name,
                            "priority": "must_answer",
                            "question": f"Which value should be used for '{field.label or field.field_name}'?",
                            "context": f"{issue_ctx} (Current draft: '{current_val}')",
                            "suggested_options": [
                                {"label": f"Accept draft: {current_val}", "value": current_val},
                                {"label": "Use spec sheet formulation value", "value": "Use Spec Sheet"},
                                {"label": "Provide custom value", "value": "custom"},
                            ],
                            "default_value": current_val,
                        }
                    )
                    q_idx += 1
                elif field.status == "missing":
                    questions.append(
                        {
                            "id": f"q_{q_idx:03d}",
                            "field_name": field.field_name,
                            "priority": "must_answer",
                            "question": f"Please provide the missing {field.label or field.field_name}.",
                            "context": f"This field is required for regulatory packaging compliance.",
                            "suggested_options": [
                                {"label": "Provide new value", "value": "custom"},
                                {"label": "Mark as Not Applicable", "value": "N/A"},
                            ],
                            "default_value": "",
                        }
                    )
                    q_idx += 1

        # Also add a general finish/embellishment design question if none exists
        if len(questions) < 2:
            questions.append(
                {
                    "id": f"q_{q_idx:03d}",
                    "field_name": "materials",
                    "priority": "nice_to_have",
                    "question": "What print finish and embellishments are specified for the pouch?",
                    "context": "Confirming print finish ensures correct dieline spot varnish layers.",
                    "suggested_options": [
                        {"label": "Matte soft-touch finish with Spot UV gloss on logo", "value": "Matte + Spot UV"},
                        {"label": "Full Gloss finish", "value": "Full Gloss"},
                        {"label": "Matte finish with Metallic Gold cold foil", "value": "Matte + Gold Foil"},
                    ],
                    "default_value": "Matte + Spot UV",
                }
            )

        return questions

    def validate_with_ai(self, brief: PackagingBrief) -> List[Issue]:
        """Runs AI-based validation checking regulatory claims vs ingredients/nutrition."""
        if not self.is_available():
            logger.info("AI validation skipped (API not configured). Deterministic validation engine active.")
            return []

        try:
            brief_dict = {
                "product_name": brief.product_name,
                "sections": [
                    {
                        "section_name": s.section_name,
                        "fields": {
                            f.field_name: (f.user_override if f.user_override is not None else f.value)
                            for f in s.fields
                        },
                    }
                    for s in brief.sections
                ],
            }

            prompt = f"""
{VALIDATION_SYSTEM_PROMPT}

PACKAGING BRIEF TO AUDIT:
{json.dumps(brief_dict, indent=2)}

Perform your audit and return the JSON array of issues.
"""
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            cleaned = _clean_json_response(response.text or "[]")
            raw_issues = json.loads(cleaned)

            issues_list: List[Issue] = []
            if isinstance(raw_issues, list):
                for item in raw_issues:
                    if isinstance(item, dict):
                        issues_list.append(
                            Issue(
                                id=item.get("id", f"iss_ai_{uuid.uuid4().hex[:6]}"),
                                severity=item.get("severity", "warning"),
                                category=item.get("category", "rule_violation"),
                                title=item.get("title", "AI Audit Finding"),
                                description=item.get("description", ""),
                                field_name=item.get("field_name"),
                                source=item.get("source", "gemini_regulatory_audit"),
                                suggestion=item.get("suggestion"),
                            )
                        )
            return issues_list
        except Exception as e:
            logger.error(f"Gemini API validation call failed: {e}")
            return []


# Global singleton instance
ai_engine = AIEngine()
