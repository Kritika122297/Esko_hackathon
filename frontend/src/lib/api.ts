import {
  ExtractionData,
  Issue,
  PackagingBrief,
  SmartQuestion,
  UploadResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Fallback mock brief for offline demo & smooth testing
export const MOCK_BRIEF: PackagingBrief = {
  session_id: "demo-session-42",
  product_name: "EcoCrunch Organic Spiced Granola Bites (250g)",
  created_at: new Date().toISOString(),
  status: "draft",
  issues_summary: {
    critical: 2,
    warning: 2,
    info: 1,
  },
  open_questions: [
    "Confirm whether allergen statement should include 'May contain traces of tree nuts and sesame seeds'",
    "Clarify FSC certification logo code for tertiary paperboard packaging",
    "Verify if Net Weight declaration on Front Panel should include metric + US imperial units (250g / 8.8 oz)",
  ],
  sections: [
    {
      section_name: "Product Overview & Claims",
      fields: [
        {
          field_name: "Product Name",
          value: "EcoCrunch Organic Spiced Granola Bites",
          source: "PDF - Front Panel (Granola_Packaging_Spec_v2.pdf)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Brand / Sub-brand",
          value: "EcoCrunch Nature Organics",
          source: "PDF - Front Panel (Granola_Packaging_Spec_v2.pdf)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Net Quantity / Weight",
          value: "250g",
          source: "PDF - Front Panel (Granola_Packaging_Spec_v2.pdf)",
          confidence: "high",
          status: "flagged",
          issues: [
            "Serving size (30g) x Servings per pack (8) = 240g, mismatching declared Net Weight 250g.",
          ],
        },
        {
          field_name: "Dietary Claims",
          value: "100% Vegan, High Fiber, Non-GMO Certified",
          source: "DOCX - Section 2.1 (Brand_Styleguide_Claims.docx)",
          confidence: "medium",
          status: "conflicting",
          issues: [
            "Vegan claim conflicts with 'Wild Blossom Honey' found in Excel ingredient formulation.",
          ],
        },
        {
          field_name: "Target Market",
          value: "United Kingdom & European Union (EU Reg 1169/2011)",
          source: "DOCX - Brief Specs (Brand_Styleguide_Claims.docx)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
      ],
    },
    {
      section_name: "Nutrition Declaration",
      fields: [
        {
          field_name: "Serving Size",
          value: "30g",
          source: "Excel - Sheet 'Specs' Cell B4 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Servings Per Container",
          value: "8",
          source: "Excel - Sheet 'Specs' Cell B5 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "medium",
          status: "flagged",
          issues: [
            "8 servings * 30g = 240g, total net content is labeled as 250g.",
          ],
        },
        {
          field_name: "Energy (Calories)",
          value: "120 kcal / 502 kJ",
          source: "Excel - Sheet 'Specs' Cell B6 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "medium",
          status: "flagged",
          issues: [
            "Calculated energy from macronutrients: (2.5g fat * 9) + (15g carb * 4) + (4g protein * 4) = 98.5 kcal. Stated is 120 kcal.",
          ],
        },
        {
          field_name: "Total Carbohydrates",
          value: "15g",
          source: "Excel - Sheet 'Specs' Cell B8 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "low",
          status: "conflicting",
          issues: [
            "Mathematical impossibility: Total Sugars (18g) is greater than Total Carbohydrates (15g).",
          ],
        },
        {
          field_name: "Total Sugars",
          value: "18g",
          source: "PDF - Back Panel Table (Granola_Packaging_Spec_v2.pdf)",
          confidence: "low",
          status: "conflicting",
          issues: [
            "Contradicts Total Carbohydrates: Sugars cannot exceed total carbs.",
          ],
        },
        {
          field_name: "Total Fat",
          value: "2.5g",
          source: "Excel - Sheet 'Specs' Cell B7 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Protein",
          value: "4.0g",
          source: "Excel - Sheet 'Specs' Cell B11 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Sodium / Salt",
          value: "0.12g salt (48mg sodium)",
          source: "Excel - Sheet 'Specs' Cell B12 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
      ],
    },
    {
      section_name: "Ingredients & Allergen Statement",
      fields: [
        {
          field_name: "Ingredients List",
          value:
            "Wholegrain Rolled Oats (54%), Wild Blossom Honey (14%), Crispy Rice, Sunflower Oil, Chia Seeds, Ceylon Cinnamon (1.5%), Natural Vanilla Extract, Sea Salt.",
          source: "Excel - Sheet 'Specs' Cell B14 (Nutrition_Formula_Rev3.xlsx)",
          confidence: "high",
          status: "conflicting",
          issues: [
            "Contains 'Wild Blossom Honey' which invalidates the 100% Vegan claim.",
          ],
        },
        {
          field_name: "Allergen Statement",
          value:
            "Contains Gluten (Oats). Manufactured in a facility that also processes Peanuts, Tree Nuts, and Sesame.",
          source: "PDF - Back Panel (Granola_Packaging_Spec_v2.pdf)",
          confidence: "medium",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Storage Instructions",
          value: "Store in a cool, dry place away from direct sunlight. Reseal pouch after opening.",
          source: "DOCX - Section 4 (Brand_Styleguide_Claims.docx)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
      ],
    },
    {
      section_name: "Packaging & Regulatory Specifications",
      fields: [
        {
          field_name: "Packaging Format",
          value: "Stand-up Doypack Pouch with Zip-lock Reclosure",
          source: "PDF - Technical Drawing (Granola_Packaging_Spec_v2.pdf)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Dimensions",
          value: "160mm (W) x 230mm (H) + 70mm (Gusset)",
          source: "PDF - Technical Drawing (Granola_Packaging_Spec_v2.pdf)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Barcode (EAN-13 / GTIN)",
          value: "5060123456784",
          source: "AI Inferred from UPC Master database",
          confidence: "medium",
          status: "flagged",
          issues: ["Checksum needs validation against GS1 standard."],
        },
        {
          field_name: "Recycling Symbol",
          value: "Code 4 LDPE (Store drop-off / Recycle with carrier bags)",
          source: "DOCX - Packaging Guidelines (Brand_Styleguide_Claims.docx)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
        {
          field_name: "Manufacturer / Distributor",
          value: "EcoCrunch Foods Ltd, 45 Green Park Way, Bristol BS1 4QU, UK",
          source: "PDF - Back Panel Footer (Granola_Packaging_Spec_v2.pdf)",
          confidence: "high",
          status: "confirmed",
          issues: [],
        },
      ],
    },
  ],
};

export const MOCK_ISSUES: Issue[] = [
  {
    id: "iss-1",
    severity: "critical",
    category: "math_error",
    title: "Total Sugars Exceeds Total Carbohydrates",
    description:
      "Nutritional panel lists Total Sugars (18g) higher than Total Carbohydrates (15g). Since sugars are a sub-fraction of carbohydrates, this is a mathematical impossibility.",
    field_name: "Total Carbohydrates",
    source: "PDF vs Excel cross-validation",
    suggestion:
      "Review the laboratory test report. Usually either Total Carbs is 22g or Total Sugars is 8g.",
  },
  {
    id: "iss-2",
    severity: "critical",
    category: "conflict",
    title: "Vegan Claim Conflicts with Honey Ingredient",
    description:
      "The Front Panel states '100% Vegan', while the ingredient formulation list in Excel explicitly includes 'Wild Blossom Honey (14%)'. Honey is an animal-derived product under FDA and EU labeling laws.",
    field_name: "Dietary Claims",
    source: "DOCX claims vs Excel formulation",
    suggestion:
      "Replace honey with Organic Agave Nectar or Organic Maple Syrup, or change dietary claim from '100% Vegan' to 'Vegetarian Friendly'.",
  },
  {
    id: "iss-3",
    severity: "warning",
    category: "math_error",
    title: "Energy / Calorie Calculation Discrepancy",
    description:
      "Standard Atwater system: (2.5g fat x 9) + (15g carb x 4) + (4g protein x 4) = 98.5 kcal. Stated calorie count is 120 kcal (difference of >20%).",
    field_name: "Energy (Calories)",
    source: "Nutrition Calculator Validation",
    suggestion:
      "Recalculate total calories based on verified macronutrient levels after fixing carbohydrate value.",
  },
  {
    id: "iss-4",
    severity: "warning",
    category: "conflict",
    title: "Serving Size & Container Weight Mismatch",
    description:
      "Pack claims 8 servings of 30g each (total 240g), while declared Net Weight is 250g (10g unaccounted for).",
    field_name: "Servings Per Container",
    source: "Serving math check",
    suggestion:
      "Adjust servings to 'Approx. 8.3 servings' or update serving size to 31.25g.",
  },
  {
    id: "iss-5",
    severity: "info",
    category: "rule_violation",
    title: "GS1 Barcode Verification Needed",
    description:
      "GTIN-13 code 5060123456784 was extracted from draft artwork and has not been reconciled with the brand ERP master catalog.",
    field_name: "Barcode (EAN-13 / GTIN)",
    source: "Artwork inspection",
    suggestion:
      "Confirm with supply chain team that 5060123456784 is the registered GTIN for the UK 250g SKU.",
  },
];

export const MOCK_QUESTIONS: SmartQuestion[] = [
  {
    id: "q-1",
    question: "What is the correct value for Total Carbohydrates and Total Sugars?",
    context:
      "The current documents list 15g Total Carbohydrates and 18g Total Sugars. Sugars cannot exceed total carbohydrates on packaging nutritional labels.",
    suggested_answer: "Total Carbohydrates: 23g, of which Sugars: 12g",
    priority: "must_answer",
    related_field: "Total Carbohydrates",
  },
  {
    id: "q-2",
    question: "How should the conflict between '100% Vegan' and 'Honey' be resolved?",
    context:
      "Front-of-pack calls out '100% Vegan', but the recipe contains 14% Wild Blossom Honey. Honey prevents vegan certification in the UK/EU.",
    suggested_answer:
      "Substitute honey with Organic Agave Nectar to preserve the Vegan claim",
    priority: "must_answer",
    related_field: "Dietary Claims",
  },
  {
    id: "q-3",
    question: "Do you want to adjust the Net Weight or the Servings Per Pack?",
    context:
      "Declared Net Weight is 250g, but 8 servings x 30g equals 240g.",
    suggested_answer: "Keep 250g Net Weight and label as 'Approx. 8 servings (30g)'",
    priority: "nice_to_have",
    related_field: "Servings Per Container",
  },
  {
    id: "q-4",
    question: "Which recycling logo and text should be printed on the pouch reverse?",
    context:
      "UK OPRL guidelines have updated LDPE pouch classification for kerbside collection vs supermarket drop-off.",
    suggested_answer: "OPRL Recycle at large supermarket - Don't recycle at home",
    priority: "nice_to_have",
    related_field: "Recycling Symbol",
  },
];

export const MOCK_EXTRACTION: ExtractionData = {
  session_id: "demo-session-42",
  texts: [
    {
      text: "EcoCrunch Organic Spiced Granola Bites - 250g e",
      source_file: "Granola_Packaging_Spec_v2.pdf",
      location: "Front Panel / Die Cut Header",
      confidence: 0.98,
    },
    {
      text: "100% Certified Organic • Rich in Natural Fiber • Non-GMO Verified",
      source_file: "Granola_Packaging_Spec_v2.pdf",
      location: "Front Panel / Lower Banner",
      confidence: 0.95,
    },
    {
      text: "Wholegrain Rolled Oats (54%), Wild Blossom Honey (14%), Crispy Rice, Sunflower Oil, Chia Seeds, Ceylon Cinnamon (1.5%), Natural Vanilla Extract, Sea Salt.",
      source_file: "Granola_Packaging_Spec_v2.pdf",
      location: "Back Panel / Ingredients Block",
      confidence: 0.92,
    },
    {
      text: "Manufactured by EcoCrunch Foods Ltd, 45 Green Park Way, Bristol BS1 4QU, UK. Distributed in EU by EcoCrunch BV, Amsterdam.",
      source_file: "Granola_Packaging_Spec_v2.pdf",
      location: "Back Panel / Legal Footer",
      confidence: 0.99,
    },
    {
      text: "Packaging Doypack: LDPE 4 Monomaterial Barrier Film. Heat Seal Temp: 145C.",
      source_file: "Brand_Styleguide_Claims.docx",
      location: "Section 3.2 Packaging Constraints",
      confidence: 0.89,
    },
  ],
  tables: [
    {
      source_file: "Nutrition_Formula_Rev3.xlsx",
      title: "Nutrition Declaration per 100g and per 30g serving",
      headers: ["Nutrient", "Per 100g", "Per 30g Serving", "% RI* (30g)"],
      rows: [
        { Nutrient: "Energy (kJ/kcal)", "Per 100g": "1673 / 400", "Per 30g Serving": "502 / 120", "% RI* (30g)": "6%" },
        { Nutrient: "Fat (g)", "Per 100g": "8.3g", "Per 30g Serving": "2.5g", "% RI* (30g)": "4%" },
        { Nutrient: " of which saturates", "Per 100g": "1.1g", "Per 30g Serving": "0.3g", "% RI* (30g)": "2%" },
        { Nutrient: "Carbohydrate (g)", "Per 100g": "50.0g", "Per 30g Serving": "15.0g", "% RI* (30g)": "6%" },
        { Nutrient: " of which sugars", "Per 100g": "60.0g", "Per 30g Serving": "18.0g", "% RI* (30g)": "20%" },
        { Nutrient: "Fibre (g)", "Per 100g": "9.2g", "Per 30g Serving": "2.8g", "% RI* (30g)": "-" },
        { Nutrient: "Protein (g)", "Per 100g": "13.3g", "Per 30g Serving": "4.0g", "% RI* (30g)": "8%" },
        { Nutrient: "Salt (g)", "Per 100g": "0.40g", "Per 30g Serving": "0.12g", "% RI* (30g)": "2%" },
      ],
    },
  ],
  metadata: {
    language: "en-GB",
    detected_packaging_type: "Flexible Stand-up Pouch",
    standards_applied: ["EU Regulation 1169/2011", "FDA 21 CFR 101"],
  },
};

export const api = {
  // Upload files
  uploadFiles: async (files: File[]): Promise<UploadResponse> => {
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed on server");
      return await res.json();
    } catch (err) {
      console.warn("Backend not reached, using simulated upload response:", err);
      return {
        session_id: "session-" + Math.random().toString(36).substring(2, 9),
        files_processed: files.length,
        extraction_summary: {
          total_text_blocks: 24,
          total_tables: 3,
          total_images: 4,
          files: files.map((f) => ({
            name: f.name,
            type: f.name.split(".").pop()?.toUpperCase() || "FILE",
            status: "Parsed successfully",
            size: f.size,
          })),
        },
      };
    }
  },

  // Trigger analysis
  analyze: async (
    sessionId: string
  ): Promise<{ brief: PackagingBrief; issues: Issue[]; extraction: ExtractionData }> => {
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      return await res.json();
    } catch (err) {
      console.warn("Backend not reached, providing analysis mock:", err);
      return {
        brief: { ...MOCK_BRIEF, session_id: sessionId },
        issues: MOCK_ISSUES,
        extraction: { ...MOCK_EXTRACTION, session_id: sessionId },
      };
    }
  },

  // Get smart questions
  getQuestions: async (sessionId: string): Promise<SmartQuestion[]> => {
    try {
      const res = await fetch(`${API_BASE}/questions?session_id=${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return await res.json();
    } catch (err) {
      console.warn("Backend not reached, providing mock questions:", err);
      return MOCK_QUESTIONS;
    }
  },

  // Submit answers
  submitAnswers: async (
    sessionId: string,
    answers: Record<string, string>
  ): Promise<PackagingBrief> => {
    try {
      const res = await fetch(`${API_BASE}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, answers }),
      });
      if (!res.ok) throw new Error("Failed to submit answers");
      return await res.json();
    } catch (err) {
      console.warn("Backend not reached, applying answers locally to mock brief:", err);
      const updated = JSON.parse(JSON.stringify(MOCK_BRIEF)) as PackagingBrief;
      updated.session_id = sessionId;
      // Mark resolved issues if answers exist
      if (answers["q-1"]) {
        // Sugar carbs issue resolved
        updated.issues_summary.critical = Math.max(0, updated.issues_summary.critical - 1);
        const sec = updated.sections.find((s) => s.section_name === "Nutrition Declaration");
        const f1 = sec?.fields.find((f) => f.field_name === "Total Carbohydrates");
        if (f1) {
          f1.value = "23g";
          f1.status = "confirmed";
          f1.issues = [];
          f1.user_override = answers["q-1"];
        }
        const f2 = sec?.fields.find((f) => f.field_name === "Total Sugars");
        if (f2) {
          f2.value = "12g";
          f2.status = "confirmed";
          f2.issues = [];
        }
      }
      if (answers["q-2"]) {
        updated.issues_summary.critical = Math.max(0, updated.issues_summary.critical - 1);
        const secOverview = updated.sections.find(
          (s) => s.section_name === "Product Overview & Claims"
        );
        const fClaim = secOverview?.fields.find((f) => f.field_name === "Dietary Claims");
        if (fClaim) {
          fClaim.value = "100% Vegan (Agave Sweetened), High Fiber, Non-GMO Verified";
          fClaim.status = "confirmed";
          fClaim.issues = [];
          fClaim.user_override = answers["q-2"];
        }
      }
      return updated;
    }
  },

  // Get current brief
  getBrief: async (sessionId: string): Promise<PackagingBrief> => {
    try {
      const res = await fetch(`${API_BASE}/brief?session_id=${sessionId}`);
      if (!res.ok) throw new Error("Failed to get brief");
      return await res.json();
    } catch (err) {
      console.warn("Backend not reached, returning mock brief:", err);
      return { ...MOCK_BRIEF, session_id: sessionId };
    }
  },

  // Update brief field
  updateBrief: async (
    sessionId: string,
    updates: Record<string, any>
  ): Promise<PackagingBrief> => {
    try {
      const res = await fetch(`${API_BASE}/brief`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, updates }),
      });
      if (!res.ok) throw new Error("Failed to update brief");
      return await res.json();
    } catch (err) {
      console.warn("Backend not reached, updating locally:", err);
      return { ...MOCK_BRIEF, session_id: sessionId };
    }
  },

  // Export brief
  exportBrief: async (
    sessionId: string,
    format: "docx" | "pdf"
  ): Promise<Blob> => {
    try {
      const res = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, format }),
      });
      if (!res.ok) throw new Error("Export failed");
      return await res.blob();
    } catch (err) {
      console.warn("Backend not reached, generating client-side file blob for export:", err);
      const content = `BriefForge Packaging Design Brief\nSession: ${sessionId}\nFormat: ${format.toUpperCase()}\nGenerated at: ${new Date().toISOString()}\n\n---\nProduct: EcoCrunch Organic Spiced Granola Bites\nStatus: Finalized\nSections: 4\nValidated by: BriefForge AI & Deterministic Rule Engine.`;
      return new Blob([content], {
        type:
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }
  },

  // Get export preview
  getPreview: async (sessionId: string): Promise<PackagingBrief> => {
    return api.getBrief(sessionId);
  },
};
