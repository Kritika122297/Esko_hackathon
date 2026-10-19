# BriefForge — Backend API

Production-grade FastAPI backend for **BriefForge**, an intelligent packaging assistant that transforms messy product specification sheets, artwork dielines (PDFs), formulation spreadsheets (Excel), and marketing drafts into structured packaging design briefs.

---

## 📁 Architecture & File Layout

```
backend/
├── .env.example              # Environment variables template
├── requirements.txt          # Python dependencies
├── README.md                 # System documentation
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI application setup, CORS, lifespan, routes
│   ├── config.py             # Settings and environment configuration
│   ├── session_store.py      # Thread-safe in-memory session manager
│   ├── models/               # Pydantic v2 data models
│   │   ├── __init__.py
│   │   ├── brief.py          # BriefField, BriefSection, PackagingBrief
│   │   ├── extraction.py     # ExtractedText, ExtractedData
│   │   └── issues.py         # Issue, ValidationResult
│   ├── prompts/              # Packaging engineering prompt templates
│   │   ├── __init__.py
│   │   ├── extraction.py     # Dieline filtering & panel extraction
│   │   ├── analysis.py       # Cross-document source attribution & conflict detection
│   │   ├── validation.py     # Regulatory & claims consistency auditing
│   │   └── questions.py      # Smart follow-up questionnaire generation
│   ├── services/             # Core business logic & parsing
│   │   ├── __init__.py
│   │   ├── file_parser.py    # PyMuPDF (fitz), openpyxl, python-docx, Pillow
│   │   ├── ai_engine.py      # Gemini integration with fallback heuristic analysis
│   │   ├── checker.py        # Deterministic math, regulatory, and conflict checker
│   │   ├── brief_builder.py  # Standard 6-section brief compiler
│   │   └── brief_exporter.py # Professional DOCX and PDF export generators
│   └── routers/              # Modular API endpoints
│       ├── __init__.py
│       ├── upload.py         # POST /api/upload
│       ├── analyze.py        # POST /api/analyze/{session_id}
│       ├── questions.py      # GET & POST /api/questions/{session_id}
│       ├── review.py         # GET & PUT /api/brief/{session_id}
│       └── export.py         # POST & GET /api/export/{session_id}
```

---

## 🚀 Key Features

1. **Multi-Source Ingestion & Dieline Filtering:**
   - Parses PDF dielines via PyMuPDF (`fitz`), capturing text block coordinates, panel positions (PDP vs back panel), and rendering high-resolution page previews.
   - Ignores printer/cutter guide marks ("Art orientation", "Copy free", "Bleed lines", "Registration marks").
   - Parses Excel specification sheets via `openpyxl`, explicitly capturing cell references and preserving the **"Notes"** / **"Comments"** column.
   - Parses Word briefs (`python-docx`) and image packaging renders (`Pillow`).

2. **Deterministic Compliance & Math Engine (`checker.py`):**
   - **4-4-9 Atwater Rule:** Verifies stated calories vs `(Fat × 9) + (Carbs × 4) + (Protein × 4)`.
   - **Component Sums:** Ensures `Saturated Fat + Trans Fat <= Total Fat` and `Dietary Fiber + Total Sugars <= Total Carbohydrates`.
   - **Sugars:** Confirms `Added Sugars <= Total Sugars`.
   - **Sodium to Salt:** Checks `Salt ≈ Sodium (g) × 2.54`.
   - **%DV Verification:** Validates stated %DV against FDA / Codex standards (`Fat: 78g`, `Sodium: 2300mg`, `Carbs: 275g`, `Fiber: 28g`, `Protein: 50g`, etc.).
   - **Serving Math:** Compares `Net Weight` vs `Serving Size × Servings per Container`.
   - **Conflict Detection:** Identifies contradictions between files (e.g., PDF PDP states `480g` while Excel spec states `500g`).
   - **Regulatory Rules:** Validates mandatory fields and marketing claims (`"Gluten-Free"`, `"Vegan"`, `"Sugar-Free"`, `"Low-Fat"`, `"High Protein"`, `"Organic"`).

3. **6 Standard Packaging Brief Sections (`brief_builder.py`):**
   1. **Label Information:** Product name, brand, flavor, variant, SKU, barcode (UPC/EAN).
   2. **Product Overview:** Description/romance copy, target market, certifications, marketing claims.
   3. **Legal & Ingredients:** Statement of identity, ingredients list, allergen declaration, country of origin, producer address, storage directions.
   4. **Nutrition Information:** Serving size, servings per container, calories, nutrient breakdown, %DV.
   5. **Packaging Specifications:** Pack sizes, materials/substrates, dieline flat dimensions, prepress notes.
   6. **Design Direction:** What to keep, what to change, what to add, open agency questions.

4. **Multi-Format Export (`brief_exporter.py`):**
   - **DOCX:** Complete formatted Word document with section tables, status badges, severity-coded issues list, open questions, and prepress sign-off table.
   - **PDF:** Generated via `reportlab` with clean typography, tables, and brand styling.

---

## 🛠️ API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | System status & docs link |
| `GET` | `/api/health` | Service health & Gemini configuration status |
| `POST` | `/api/upload` | Multipart file upload (PDF, Excel, DOCX, Images). Returns `session_id` and extraction counts. |
| `POST` | `/api/analyze/{session_id}` | Runs AI synthesis, builds initial brief, and executes deterministic validation checks. |
| `GET` | `/api/questions/{session_id}` | Generates smart follow-up questions targeting missing or conflicting fields with suggested options. |
| `POST` | `/api/questions/{session_id}` | Submits user answers, applies field overrides, and re-validates brief. |
| `GET` | `/api/brief/{session_id}` | Retrieves full brief state and validation issues. |
| `PUT` | `/api/brief/{session_id}` | Updates specific fields or entire brief, re-running validation checks. |
| `GET` | `/api/export/{session_id}/preview` | Returns brief as structured JSON for UI preview. |
| `POST` | `/api/export/{session_id}?format=docx` | Downloads finalized Brief document as `.docx` or `.pdf`. |

---

## 💻 Installation & Setup

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   copy .env.example .env
   # Edit .env and supply your GEMINI_API_KEY if available
   ```

4. **Run the server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Access Swagger UI:**
   Navigate to `http://localhost:8000/api/docs` in your browser.
